from __future__ import annotations

import asyncio
import json
import os
import re
from uuid import uuid4

from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from battle_manager import BattleManager, battles
from personas import PERSONAS, KOL_META, add_persona

load_dotenv()
_api_key = os.getenv("ANTHROPIC_API_KEY")
_api_url = os.getenv("ANTHROPIC_API_URL")
_client_kwargs: dict = {"api_key": _api_key}
if _api_url:
    _client_kwargs["base_url"] = _api_url

app = FastAPI(title="KOL Battle API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# ---------- Models ----------

class BattleStartRequest(BaseModel):
    topic: str
    kol_ids: list[str]
    rounds: int = 3
    max_tokens: int = Field(default=600)
    length: str = Field(default="standard")


class InjectRequest(BaseModel):
    text: str


# ---------- Routes ----------

@app.get("/api/kols")
def list_kols():
    result = []
    for kid, p in PERSONAS.items():
        meta = KOL_META.get(kid, {})
        result.append({
            "id": kid,
            "name": p["name"],
            "title": meta.get("title", ""),
            "tags": meta.get("tags", []),
            "color": meta.get("color", "#888"),
            "bgColor": meta.get("bgColor", "#111"),
        })
    return result


DISTILL_SYSTEM_PROMPT = """你是一个KOL性格蒸馏专家。根据提供的KOL信息，生成一份详细的人格系统提示词（system prompt），用于让AI在辩论中扮演这个博主。

你需要生成以下内容：
1. 一段简介（1-2句）
2. 【五大核心心智模型】— 每个模型包含名称和解释
3. 【说话风格】— 语气、句式、常用词
4. 【标志性句式】— 至少5个
5. 【攻击风格】— 如何在辩论中与人交锋
6. 【约束】— 包含"每次发言不超过 200 字"

输出格式为纯文本，不要用markdown代码块。开头以"你正在扮演{name}。"开始。"""


def _generate_system_prompt(name: str, domains: list[str], url: str = "", platform: str = "", file_content: str = "") -> str:
    client = Anthropic(**_client_kwargs)
    user_parts = [f"请为以下博主生成蒸馏人格提示词：\n\n博主名字：{name}"]
    if domains:
        user_parts.append(f"所在领域：{', '.join(domains)}")
    if platform:
        user_parts.append(f"平台：{platform}")
    if url:
        user_parts.append(f"主页链接：{url}")
    if file_content:
        user_parts.append(f"参考配置文件内容：\n{file_content[:3000]}")

    resp = client.messages.create(
        model="bedrock-claude-sonnet",
        max_tokens=2000,
        system=DISTILL_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": "\n".join(user_parts)}],
    )
    return resp.content[0].text


@app.post("/api/kols/distill")
async def distill_kol(
    name: str = Form(...),
    mode: str = Form("url"),
    url: str = Form(""),
    platform: str = Form(""),
    domains: str = Form("[]"),
    file: UploadFile | None = File(None),
    avatar: UploadFile | None = File(None),
):
    if not name.strip():
        raise HTTPException(status_code=400, detail="Name is required")

    domain_list: list[str] = json.loads(domains) if domains else []

    file_content = ""
    if file and mode == "file":
        raw = await file.read()
        file_content = raw.decode("utf-8", errors="ignore")

    _ = avatar  # accepted but not persisted (no storage backend)

    kol_id = re.sub(r"[^a-z0-9]", "_", name.strip().lower())
    if not kol_id or kol_id in PERSONAS:
        kol_id = f"custom_{uuid4().hex[:8]}"

    title = "蒸馏博主"
    if domain_list:
        title = " / ".join(domain_list[:2]) + " 博主"

    loop = asyncio.get_event_loop()
    system_prompt = await loop.run_in_executor(
        None, _generate_system_prompt, name.strip(), domain_list, url.strip(), platform.strip(), file_content,
    )

    result = add_persona(
        kol_id=kol_id,
        name=name.strip(),
        system_prompt=system_prompt,
        title=title,
        tags=domain_list[:3],
    )
    return result


@app.delete("/api/kols/{kol_id}")
def delete_kol(kol_id: str):
    if kol_id not in PERSONAS:
        raise HTTPException(status_code=404, detail="KOL not found")
    del PERSONAS[kol_id]
    KOL_META.pop(kol_id, None)
    return {"status": "deleted", "id": kol_id}


@app.post("/api/battle/start")
def start_battle(req: BattleStartRequest):
    if len(req.kol_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 KOLs required")

    for kid in req.kol_ids:
        if kid not in PERSONAS:
            raise HTTPException(status_code=400, detail=f"Unknown KOL: {kid}")

    battle_id = uuid4().hex
    bm = BattleManager(
        topic=req.topic,
        agent_ids=req.kol_ids,
        battle_id=battle_id,
        max_tokens=req.max_tokens,
        length=req.length,
    )
    bm._total_rounds = req.rounds
    battles[battle_id] = bm

    return {"battle_id": battle_id, "status": "created"}


def _stream_rounds(bm: BattleManager, rounds: int):
    """Generator that yields SSE events for the given number of rounds."""
    try:
        for round_num in range(1, rounds + 1):
            bm.current_round += 1
            current = bm.current_round

            yield sse_event("round_start", {"round": current})

            for agent_id in bm.get_round_agents():
                agent_name = PERSONAS[agent_id]["name"]
                yield sse_event("agent_start", {
                    "agent_id": agent_id,
                    "agent_name": agent_name,
                    "round": current,
                })

                full_text = ""
                for chunk in bm.agent_speak_stream(agent_id):
                    full_text += chunk
                    yield sse_event("token", {
                        "agent_id": agent_id,
                        "token": chunk,
                    })

                yield sse_event("agent_done", {
                    "agent_id": agent_id,
                    "full_text": full_text,
                })

            yield sse_event("round_end", {"round": current})

        yield sse_event("battle_end", {"rounds_completed": bm.current_round})
    except Exception as e:
        print(f"[stream] Error during battle: {e}")
        yield sse_event("error", {"message": str(e)})


@app.get("/api/battle/{battle_id}/stream")
def battle_stream(battle_id: str):
    bm = battles.get(battle_id)
    if not bm:
        raise HTTPException(status_code=404, detail="Battle not found")

    rounds = getattr(bm, "_total_rounds", 3)
    return StreamingResponse(
        _stream_rounds(bm, rounds),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/battle/{battle_id}/inject")
def inject_opinion(battle_id: str, req: InjectRequest):
    bm = battles.get(battle_id)
    if not bm:
        raise HTTPException(status_code=404, detail="Battle not found")

    bm.inject_user_opinion(req.text)
    return {"status": "injected"}


def _do_summarize(bm: BattleManager) -> dict[str, str]:
    summaries: dict[str, str] = {}
    for agent_id in bm.agent_ids:
        agent_name = PERSONAS[agent_id]["name"]
        agent_msgs = [t["text"] for t in bm.battle_history if t["speaker"] == agent_id]
        if not agent_msgs:
            summaries[agent_id] = "暂无观点"
            continue

        combined = "\n\n".join(f"[第{i+1}次发言]\n{msg}" for i, msg in enumerate(agent_msgs))
        try:
            resp = bm.client.messages.create(
                model="bedrock-claude-sonnet",
                max_tokens=500,
                system="你是一个中立的观点总结助手。请把以下辩手的所有发言总结成简洁的 bullet point 观点列表。每个观点用 - 开头，一行一个，使用中文。只输出 bullet point，不要加标题或额外说明。",
                messages=[
                    {"role": "user", "content": f"辩手 {agent_name} 在辩题 {bm.topic} 中的所有发言:\n\n{combined}"}
                ],
            )
            summaries[agent_id] = resp.content[0].text
        except Exception as e:
            print(f"[summarize] Error for {agent_id}: {e}")
            summaries[agent_id] = f"总结失败: {e}"
    return summaries


@app.post("/api/battle/{battle_id}/summarize")
async def summarize_battle(battle_id: str):
    bm = battles.get(battle_id)
    if not bm:
        raise HTTPException(status_code=404, detail="Battle not found")

    loop = asyncio.get_event_loop()
    summaries = await loop.run_in_executor(None, _do_summarize, bm)
    return {"summaries": summaries}


def _stream_summarize(bm: BattleManager):
    """Generator that yields SSE events for streaming summarization, one KOL at a time."""
    try:
        for agent_id in bm.agent_ids:
            agent_name = PERSONAS[agent_id]["name"]
            agent_msgs = [t["text"] for t in bm.battle_history if t["speaker"] == agent_id]

            yield sse_event("summary_start", {"agent_id": agent_id, "agent_name": agent_name})

            if not agent_msgs:
                yield sse_event("summary_token", {"agent_id": agent_id, "token": "暂无观点"})
                yield sse_event("summary_done", {"agent_id": agent_id, "full_text": "暂无观点"})
                continue

            combined = "\n\n".join(f"[第{i+1}次发言]\n{msg}" for i, msg in enumerate(agent_msgs))
            try:
                full_text = ""
                with bm.client.messages.stream(
                    model="bedrock-claude-sonnet",
                    max_tokens=500,
                    system="你是一个中立的观点总结助手。请把以下辩手的所有发言总结成简洁的 bullet point 观点列表。每个观点用 - 开头，一行一个，使用中文。只输出 bullet point，不要加标题或额外说明。",
                    messages=[
                        {"role": "user", "content": f"辩手 {agent_name} 在辩题 {bm.topic} 中的所有发言:\n\n{combined}"}
                    ],
                ) as stream:
                    for chunk in stream.text_stream:
                        full_text += chunk
                        yield sse_event("summary_token", {"agent_id": agent_id, "token": chunk})

                yield sse_event("summary_done", {"agent_id": agent_id, "full_text": full_text})
            except Exception as e:
                print(f"[summarize-stream] Error for {agent_id}: {e}")
                err_text = f"总结失败: {e}"
                yield sse_event("summary_done", {"agent_id": agent_id, "full_text": err_text})

        yield sse_event("summarize_end", {})
    except Exception as e:
        print(f"[summarize-stream] Error: {e}")
        yield sse_event("error", {"message": str(e)})


@app.post("/api/battle/{battle_id}/summarize-stream")
def summarize_battle_stream(battle_id: str):
    bm = battles.get(battle_id)
    if not bm:
        raise HTTPException(status_code=404, detail="Battle not found")

    return StreamingResponse(
        _stream_summarize(bm),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/battle/{battle_id}/continue")
def continue_battle(battle_id: str):
    bm = battles.get(battle_id)
    if not bm:
        raise HTTPException(status_code=404, detail="Battle not found")

    return StreamingResponse(
        _stream_rounds(bm, 1),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)

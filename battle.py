
import os
from dotenv import load_dotenv
from anthropic import Anthropic
from personas import PERSONAS

load_dotenv()

api_key = os.getenv("ANTHROPIC_API_KEY")
api_url = os.getenv("ANTHROPIC_API_URL", "https://api.anthropic.com/v1")

if not api_key:
    raise ValueError("ANTHROPIC_API_KEY not set in .env")

client = Anthropic(api_key=api_key, base_url=api_url)

# 颜色标记，多人时循环使用
COLORS = ["🔴", "🔵", "🟢", "🟡", "🟠", "🟣"]

# 共享 Battle 历史（上帝视角完整记录）
battle_history = []  # [{"speaker": "agent_id", "text": "..."}]


def select_heroes() -> list[str]:
    """交互式选英雄，返回 agent_id 列表"""
    keys = list(PERSONAS.keys())

    print("\n可选英雄：")
    for i, key in enumerate(keys):
        print(f"  {i + 1}. {PERSONAS[key]['name']}  ({key})")

    print("\n请输入英雄编号，用空格分隔（至少2个，例如：1 3）：")
    while True:
        raw = input(">>> ").strip()
        parts = raw.split()
        try:
            indices = [int(p) - 1 for p in parts]
        except ValueError:
            print("请输入数字编号")
            continue

        if len(indices) < 2:
            print("至少选2个英雄")
            continue

        if any(i < 0 or i >= len(keys) for i in indices):
            print(f"编号范围是 1~{len(keys)}，请重新输入")
            continue

        selected = [keys[i] for i in indices]
        # 去重保序
        seen = set()
        unique = []
        for s in selected:
            if s not in seen:
                seen.add(s)
                unique.append(s)

        if len(unique) < 2:
            print("至少选2个不同的英雄")
            continue

        return unique


def build_messages_for(agent_id: str, topic: str) -> list[dict]:
    """把共享历史翻译成 agent_id 视角的 messages 数组"""
    messages = []

    messages.append({
        "role": "user",
        "content": f"【本场辩题】{topic}\n\n请开始你的发言。"
    })

    for turn in battle_history:
        if turn["speaker"] == agent_id:
            messages.append({"role": "assistant", "content": turn["text"]})
        elif turn["speaker"] == "__user__":
            messages.append({"role": "user", "content": f"[观众]: {turn['text']}"})
        else:
            speaker_name = PERSONAS[turn["speaker"]]["name"]
            messages.append({"role": "user", "content": f"[{speaker_name}]: {turn['text']}"})

    if messages[-1]["role"] == "assistant":
        messages.append({"role": "user", "content": "（轮到你回应了）"})

    return messages


def agent_speak(agent_id: str, topic: str) -> str:
    persona = PERSONAS[agent_id]
    messages = build_messages_for(agent_id, topic)

    response = client.messages.create(
        model="bedrock-claude-sonnet",
        max_tokens=200,
        system=persona["system_prompt"],
        messages=messages
    )

    text = response.content[0].text
    battle_history.append({"speaker": agent_id, "text": text})
    return text


def run_round(agents: list[str], topic: str, color_map: dict):
    """跑一轮：所有英雄按顺序各发言一次"""
    for agent_id in agents:
        text = agent_speak(agent_id, topic)
        icon = color_map[agent_id]
        print(f"\n{icon} {PERSONAS[agent_id]['name']}:")
        print(f"   {text}")


def run_battle(agents: list[str], topic: str, rounds: int = 3):
    color_map = {agent_id: COLORS[i % len(COLORS)] for i, agent_id in enumerate(agents)}
    names = "  vs  ".join(
        f"{color_map[a]}{PERSONAS[a]['name']}" for a in agents
    )

    print(f"\n{'='*55}")
    print(f"辩题：{topic}")
    print(f"参赛：{names}")
    print(f"回合：{rounds}")
    print(f"{'='*55}")

    for round_num in range(1, rounds + 1):
        print(f"\n━━━━━━━━ Round {round_num} ━━━━━━━━")
        run_round(agents, topic, color_map)

    print(f"\n{'='*55}")
    print("Battle 结束！")
    print(f"{'='*55}")

    while True:
        print("\n请选择：")
        print("  1. 输入你的观点，让所有人回应")
        print("  2. 继续辩论一轮")
        print("  3. 结束对话")
        choice = input(">>> ").strip()

        if choice == "1":
            user_input = input("你的观点：").strip()
            if not user_input:
                continue
            battle_history.append({"speaker": "__user__", "text": user_input})
            run_round(agents, topic, color_map)

        elif choice == "2":
            run_round(agents, topic, color_map)

        elif choice == "3":
            print("\n对话结束，再见！")
            break

        else:
            print("无效输入，请输入 1、2 或 3")


# ============ 入口 ============
if __name__ == "__main__":
    topic = input("请输入辩题：").strip()
    if not topic:
        print("辩题不能为空")
        exit(1)

    agents = select_heroes()

    print(f"\n已选英雄：{' vs '.join(PERSONAS[a]['name'] for a in agents)}")

    run_battle(agents=agents, topic=topic, rounds=3)

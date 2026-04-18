from __future__ import annotations

import os
import re
from typing import Generator
from uuid import uuid4

from anthropic import Anthropic
from dotenv import load_dotenv
from personas import PERSONAS

load_dotenv()

api_key = os.getenv("ANTHROPIC_API_KEY")
api_url = os.getenv("ANTHROPIC_API_URL")

if not api_key:
    raise ValueError("ANTHROPIC_API_KEY not set in .env")


LENGTH_CHAR_LIMITS = {
    "short": 100,
    "standard": 200,
    "long": 400,
}


class BattleManager:
    def __init__(
        self,
        topic: str,
        agent_ids: list[str],
        battle_id: str | None = None,
        max_tokens: int = 600,
        length: str = "standard",
    ):
        self.battle_id = battle_id or uuid4().hex
        self.topic = topic
        self.agent_ids = agent_ids
        self.max_tokens = max_tokens
        self.length = length
        self.char_limit = LENGTH_CHAR_LIMITS.get(length, 500)
        self.battle_history: list[dict] = []
        self.current_round = 0
        client_kwargs = {"api_key": api_key}
        if api_url:
            client_kwargs["base_url"] = api_url
        self.client = Anthropic(**client_kwargs)

    def _adjusted_system_prompt(self, agent_id: str) -> str:
        prompt = PERSONAS[agent_id]["system_prompt"]
        return re.sub(
            r"每次发言不超过\s*\d+\s*字",
            f"每次发言不超过 {self.char_limit} 字",
            prompt,
        )

    def build_messages_for(self, agent_id: str) -> list[dict]:
        messages: list[dict] = [
            {
                "role": "user",
                "content": f"【本场辩题】{self.topic}\n\n请开始你的发言。",
            }
        ]

        for turn in self.battle_history:
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

    def agent_speak(self, agent_id: str) -> str:
        messages = self.build_messages_for(agent_id)
        system_prompt = self._adjusted_system_prompt(agent_id)

        response = self.client.messages.create(
            model="bedrock-claude-sonnet",
            max_tokens=self.max_tokens,
            system=system_prompt,
            messages=messages,
        )

        text = response.content[0].text
        self.battle_history.append({"speaker": agent_id, "text": text})
        return text

    def agent_speak_stream(self, agent_id: str) -> Generator[str, None, None]:
        messages = self.build_messages_for(agent_id)
        system_prompt = self._adjusted_system_prompt(agent_id)

        full_text = ""
        with self.client.messages.stream(
            model="bedrock-claude-sonnet",
            max_tokens=self.max_tokens,
            system=system_prompt,
            messages=messages,
        ) as stream:
            for chunk in stream.text_stream:
                full_text += chunk
                yield chunk

        self.battle_history.append({"speaker": agent_id, "text": full_text})

    def inject_user_opinion(self, text: str):
        self.battle_history.append({"speaker": "__user__", "text": text})

    def get_round_agents(self) -> list[str]:
        return list(self.agent_ids)


battles: dict[str, BattleManager] = {}

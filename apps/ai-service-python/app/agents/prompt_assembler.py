import json
from pathlib import Path
from typing import Any

PROMPT_DIR = Path(__file__).resolve().parents[1] / "prompts"


class PromptAssembler:
    """Assembles system prompt + user memory + session context + scene prompt."""

    def __init__(self) -> None:
        self.system_prompt = self._read_prompt("system_prompt.md")
        self.task_prompts = {
            "daily_plan": self._read_prompt("daily_plan.md"),
            "speaking": self._read_prompt("speaking.md"),
            "writing": self._read_prompt("writing.md"),
            "word_review": self._read_prompt("word_review.md"),
            "qa": self._read_prompt("qa.md"),
        }

    def build_messages(
        self,
        scene: str,
        user_memory: dict[str, Any],
        context: list[dict[str, str]],
        user_input: str,
    ) -> list[dict[str, str]]:
        task_prompt = self.task_prompts.get(scene, self.task_prompts["qa"])
        memory_block = json.dumps(user_memory, ensure_ascii=False, indent=2)

        messages: list[dict[str, str]] = [
            {"role": "system", "content": self.system_prompt},
            {"role": "system", "content": f"用户长期学习档案如下，必须用于个性化教学：\n{memory_block}"},
            {"role": "system", "content": task_prompt},
        ]
        messages.extend(context)
        messages.append({"role": "user", "content": user_input})
        return messages

    @staticmethod
    def _read_prompt(filename: str) -> str:
        path = PROMPT_DIR / filename
        return path.read_text(encoding="utf-8")


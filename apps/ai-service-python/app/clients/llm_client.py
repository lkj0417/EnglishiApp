from openai import OpenAI

from app.core.config import settings


class LLMClient:
    """OpenAI-compatible LLM wrapper. Falls back to deterministic mock when no key is configured."""

    def __init__(self) -> None:
        self.client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
        self.model = settings.llm_model

    def chat(self, messages: list[dict[str, str]]) -> str:
        if self.client is None:
            return self._mock_response(messages)

        completion = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.4,
        )
        return completion.choices[0].message.content or ""

    @staticmethod
    def _mock_response(messages: list[dict[str, str]]) -> str:
        user_input = messages[-1]["content"] if messages else ""
        return (
            "收到，我会根据你的学习档案进行自适应指导。\n\n"
            "**本轮建议**：先用一个简单句表达你的想法，然后我会帮你优化。\n\n"
            f"你刚才的输入是：{user_input}\n\n"
            "**练习**：请再用英文补充一句相关表达。"
        )


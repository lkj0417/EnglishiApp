import json
from typing import Any

from redis import Redis

from app.core.config import settings


class ContextManager:
    """Keeps short-term session memory in Redis with TTL to avoid prompt overflow."""

    def __init__(self, redis_client: Redis):
        self.redis = redis_client
        self.ttl_seconds = settings.context_ttl_seconds

    def load_context(self, user_id: int, session_id: str, scene: str) -> list[dict[str, str]]:
        raw = self.redis.get(self._key(user_id, session_id, scene))
        if not raw:
            return []
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return []

    def append_turn(self, user_id: int, session_id: str, scene: str, role: str, content: str) -> None:
        key = self._key(user_id, session_id, scene)
        context = self.load_context(user_id, session_id, scene)
        context.append({"role": role, "content": content})
        # Keep the latest 12 turns to protect the model context window.
        context = context[-12:]
        self.redis.setex(key, self.ttl_seconds, json.dumps(context, ensure_ascii=False))

    def clear(self, user_id: int, session_id: str, scene: str) -> None:
        self.redis.delete(self._key(user_id, session_id, scene))

    @staticmethod
    def _key(user_id: int, session_id: str, scene: str) -> str:
        return f"ctx:{user_id}:{scene}:{session_id}"


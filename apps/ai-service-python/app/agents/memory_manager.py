from typing import Any

from app.repositories.profile_repository import ProfileRepository


class MemoryManager:
    """Loads trusted long-term learner memory from MySQL."""

    def __init__(self, repository: ProfileRepository):
        self.repository = repository

    def load_user_memory(self, user_id: int) -> dict[str, Any]:
        profile = self.repository.get_learning_profile(user_id)
        if profile is None:
            return {
                "user_id": user_id,
                "cefr_level": "A1",
                "learning_goal": "通用英语提升",
                "daily_minutes": 20,
                "pain_points": [],
                "weak_grammar_points": [],
                "error_prone_words": [],
                "speaking_weaknesses": [],
                "writing_weaknesses": [],
                "ability_scores": {},
            }
        return profile


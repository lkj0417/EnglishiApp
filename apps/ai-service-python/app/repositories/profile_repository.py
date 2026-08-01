import json
from collections.abc import Mapping
from typing import Any, cast

from sqlalchemy import text
from sqlalchemy.orm import Session


class ProfileRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_learning_profile(self, user_id: int) -> dict[str, Any] | None:
        row = self.db.execute(
            text(
                """
                SELECT
                  user_id,
                  cefr_level,
                  learning_goal,
                  daily_minutes,
                  pain_points,
                  material_preferences,
                  weak_grammar_points,
                  error_prone_words,
                  speaking_weaknesses,
                  writing_weaknesses,
                  ability_scores
                FROM user_learning_profile
                WHERE user_id = :user_id
                LIMIT 1
                """
            ),
            {"user_id": user_id},
        ).mappings().first()
        if row is None:
            return None
        row_map = cast(Mapping[str, Any], row)
        data: dict[str, Any] = {
            "user_id": row_map["user_id"],
            "cefr_level": row_map["cefr_level"],
            "learning_goal": row_map["learning_goal"],
            "daily_minutes": row_map["daily_minutes"],
            "pain_points": row_map["pain_points"],
            "material_preferences": row_map["material_preferences"],
            "weak_grammar_points": row_map["weak_grammar_points"],
            "error_prone_words": row_map["error_prone_words"],
            "speaking_weaknesses": row_map["speaking_weaknesses"],
            "writing_weaknesses": row_map["writing_weaknesses"],
            "ability_scores": row_map["ability_scores"],
        }
        for key in (
            "pain_points",
            "material_preferences",
            "weak_grammar_points",
            "error_prone_words",
            "speaking_weaknesses",
            "writing_weaknesses",
            "ability_scores",
        ):
            data[key] = self._decode_json(data.get(key))
        return data

    def save_error_record(
        self,
        user_id: int,
        source_type: str,
        original_content: str,
        corrected_content: str,
        error_type: str,
        explanation: str,
        knowledge_points: list[str],
    ) -> None:
        self.db.execute(
            text(
                """
                INSERT INTO user_error_record
                  (user_id, source_type, original_content, corrected_content, error_type, explanation, knowledge_points)
                VALUES
                  (:user_id, :source_type, :original_content, :corrected_content, :error_type, :explanation, :knowledge_points)
                """
            ),
            {
                "user_id": user_id,
                "source_type": source_type,
                "original_content": original_content,
                "corrected_content": corrected_content,
                "error_type": error_type,
                "explanation": explanation,
                "knowledge_points": json.dumps(knowledge_points, ensure_ascii=False),
            },
        )
        self.db.commit()

    def save_word(self, user_id: int, word: str, meaning: str, example_sentence: str = "") -> None:
        self.db.execute(
            text(
                """
                INSERT INTO user_word (user_id, word, meaning, example_sentence)
                VALUES (:user_id, :word, :meaning, :example_sentence)
                ON DUPLICATE KEY UPDATE
                  meaning = VALUES(meaning),
                  example_sentence = VALUES(example_sentence),
                  updated_at = CURRENT_TIMESTAMP(3)
                """
            ),
            {
                "user_id": user_id,
                "word": word,
                "meaning": meaning,
                "example_sentence": example_sentence,
            },
        )
        self.db.commit()

    def replace_daily_tasks(self, user_id: int, task_date: str, tasks: list[dict[str, Any]]) -> None:
        self.db.execute(
            text(
                """
                DELETE FROM user_daily_task
                WHERE user_id = :user_id AND task_date = :task_date AND status = 'pending'
                """
            ),
            {"user_id": user_id, "task_date": task_date},
        )
        for task in tasks:
            self.db.execute(
                text(
                    """
                    INSERT INTO user_daily_task
                      (user_id, task_date, task_type, title, payload, estimated_minutes, status)
                    VALUES
                      (:user_id, :task_date, :task_type, :title, :payload, :estimated_minutes, 'pending')
                    """
                ),
                {
                    "user_id": user_id,
                    "task_date": task_date,
                    "task_type": task["taskType"],
                    "title": task["title"],
                    "payload": json.dumps(task, ensure_ascii=False),
                    "estimated_minutes": task["estimatedMinutes"],
                },
            )
        self.db.commit()

    @staticmethod
    def _decode_json(value: Any) -> Any:
        if value in (None, ""):
            return []
        if isinstance(value, (dict, list)):
            return value
        try:
            return json.loads(value)
        except (TypeError, json.JSONDecodeError):
            return value


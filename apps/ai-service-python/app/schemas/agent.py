from dataclasses import dataclass
from datetime import date
from typing import Any

VALID_SCENES = {"daily_plan", "speaking", "writing", "word_review", "qa"}


@dataclass(frozen=True)
class TutorChatRequest:
    user_id: int
    session_id: str
    scene: str
    message: str

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "TutorChatRequest":
        user_id = int(payload.get("userId") or payload.get("user_id") or 0)
        session_id = str(payload.get("sessionId") or payload.get("session_id") or "").strip()
        scene = str(payload.get("scene") or "qa").strip()
        message = str(payload.get("message") or "").strip()

        if user_id <= 0:
            raise ValueError("userId must be greater than 0")
        if not session_id or len(session_id) > 128:
            raise ValueError("sessionId is required and must be <= 128 characters")
        if scene not in VALID_SCENES:
            raise ValueError("scene must be one of daily_plan, speaking, writing, word_review, qa")
        if not message or len(message) > 8000:
            raise ValueError("message is required and must be <= 8000 characters")
        return cls(user_id=user_id, session_id=session_id, scene=scene, message=message)


@dataclass(frozen=True)
class TutorChatData:
    reply: str
    scene: str
    persisted: dict[str, int | bool]


@dataclass(frozen=True)
class ClearContextRequest:
    user_id: int
    session_id: str
    scene: str

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "ClearContextRequest":
        user_id = int(payload.get("userId") or payload.get("user_id") or 0)
        session_id = str(payload.get("sessionId") or payload.get("session_id") or "").strip()
        scene = str(payload.get("scene") or "qa").strip()
        if user_id <= 0:
            raise ValueError("userId must be greater than 0")
        if not session_id or len(session_id) > 128:
            raise ValueError("sessionId is required and must be <= 128 characters")
        if scene not in VALID_SCENES:
            raise ValueError("scene must be one of daily_plan, speaking, writing, word_review, qa")
        return cls(user_id=user_id, session_id=session_id, scene=scene)


@dataclass(frozen=True)
class DailyPlanRequest:
    user_id: int
    task_date: str
    session_id: str
    available_minutes: int

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "DailyPlanRequest":
        user_id = int(payload.get("userId") or payload.get("user_id") or 0)
        task_date = str(payload.get("taskDate") or payload.get("task_date") or date.today().isoformat()).strip()
        session_id = str(payload.get("sessionId") or payload.get("session_id") or f"daily-plan-{task_date}").strip()
        available_minutes = int(payload.get("availableMinutes") or payload.get("available_minutes") or 20)

        if user_id <= 0:
            raise ValueError("userId must be greater than 0")
        try:
            date.fromisoformat(task_date)
        except ValueError as exc:
            raise ValueError("taskDate must be YYYY-MM-DD") from exc
        if not session_id or len(session_id) > 128:
            raise ValueError("sessionId is required and must be <= 128 characters")
        if available_minutes < 5 or available_minutes > 240:
            raise ValueError("availableMinutes must be between 5 and 240")
        return cls(
            user_id=user_id,
            task_date=task_date,
            session_id=session_id,
            available_minutes=available_minutes,
        )


@dataclass(frozen=True)
class WritingCorrectRequest:
    user_id: int
    session_id: str
    title: str
    content: str

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "WritingCorrectRequest":
        user_id = int(payload.get("userId") or payload.get("user_id") or 0)
        session_id = str(payload.get("sessionId") or payload.get("session_id") or "writing-default").strip()
        title = str(payload.get("title") or "Untitled Writing").strip()
        content = str(payload.get("content") or payload.get("originalContent") or "").strip()

        if user_id <= 0:
            raise ValueError("userId must be greater than 0")
        if not session_id or len(session_id) > 128:
            raise ValueError("sessionId is required and must be <= 128 characters")
        if not title or len(title) > 255:
            raise ValueError("title is required and must be <= 255 characters")
        if len(content) < 10 or len(content) > 12000:
            raise ValueError("content length must be between 10 and 12000 characters")
        return cls(user_id=user_id, session_id=session_id, title=title, content=content)


@dataclass(frozen=True)
class SpeakingChatRequest:
    user_id: int
    session_id: str
    message: str
    audio_asset_id: int | None
    audio_url: str | None

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "SpeakingChatRequest":
        user_id = int(payload.get("userId") or payload.get("user_id") or 0)
        session_id = str(payload.get("sessionId") or payload.get("session_id") or "speaking-default").strip()
        message = str(payload.get("message") or payload.get("transcript") or "").strip()
        audio_asset_id_raw = payload.get("audioAssetId") or payload.get("audio_asset_id")
        audio_asset_id = int(audio_asset_id_raw) if audio_asset_id_raw else None
        audio_url = payload.get("audioUrl") or payload.get("audio_url")
        audio_url = str(audio_url).strip() if audio_url else None

        if user_id <= 0:
            raise ValueError("userId must be greater than 0")
        if not session_id or len(session_id) > 128:
            raise ValueError("sessionId is required and must be <= 128 characters")
        if not message and not audio_url:
            raise ValueError("message or audioUrl is required")
        if len(message) > 4000:
            raise ValueError("message must be <= 4000 characters")
        return cls(
            user_id=user_id,
            session_id=session_id,
            message=message,
            audio_asset_id=audio_asset_id,
            audio_url=audio_url,
        )


@dataclass(frozen=True)
class WritingCorrectRequest:
    user_id: int
    session_id: str
    title: str
    content: str

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "WritingCorrectRequest":
        user_id = int(payload.get("userId") or payload.get("user_id") or 0)
        session_id = str(payload.get("sessionId") or payload.get("session_id") or "writing-default").strip()
        title = str(payload.get("title") or "Untitled Writing").strip()
        content = str(payload.get("content") or payload.get("originalContent") or "").strip()

        if user_id <= 0:
            raise ValueError("userId must be greater than 0")
        if not session_id or len(session_id) > 128:
            raise ValueError("sessionId is required and must be <= 128 characters")
        if not title or len(title) > 255:
            raise ValueError("title is required and must be <= 255 characters")
        if len(content) < 10 or len(content) > 12000:
            raise ValueError("content length must be between 10 and 12000 characters")
        return cls(user_id=user_id, session_id=session_id, title=title, content=content)


@dataclass(frozen=True)
class SpeakingChatRequest:
    user_id: int
    session_id: str
    message: str
    audio_asset_id: int | None
    audio_url: str | None

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> "SpeakingChatRequest":
        user_id = int(payload.get("userId") or payload.get("user_id") or 0)
        session_id = str(payload.get("sessionId") or payload.get("session_id") or "speaking-default").strip()
        message = str(payload.get("message") or payload.get("transcript") or "").strip()
        audio_asset_id_raw = payload.get("audioAssetId") or payload.get("audio_asset_id")
        audio_asset_id = int(audio_asset_id_raw) if audio_asset_id_raw else None
        audio_url = payload.get("audioUrl") or payload.get("audio_url")
        audio_url = str(audio_url).strip() if audio_url else None

        if user_id <= 0:
            raise ValueError("userId must be greater than 0")
        if not session_id or len(session_id) > 128:
            raise ValueError("sessionId is required and must be <= 128 characters")
        if not message and not audio_url:
            raise ValueError("message or audioUrl is required")
        if len(message) > 4000:
            raise ValueError("message must be <= 4000 characters")
        return cls(
            user_id=user_id,
            session_id=session_id,
            message=message,
            audio_asset_id=audio_asset_id,
            audio_url=audio_url,
        )



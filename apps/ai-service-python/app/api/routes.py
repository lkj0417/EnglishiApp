from typing import Any

from fastapi import APIRouter, Body, Depends, Header
from redis import Redis
from sqlalchemy.orm import Session

from app.agents.context_manager import ContextManager
from app.agents.memory_manager import MemoryManager
from app.agents.prompt_assembler import PromptAssembler
from app.clients.llm_client import LLMClient
from app.core.config import settings
from app.core.response import ok
from app.repositories.mysql import get_db
from app.repositories.profile_repository import ProfileRepository
from app.schemas.agent import ClearContextRequest, DailyPlanRequest, SpeakingChatRequest, TutorChatRequest, WritingCorrectRequest
from app.services.agent_service import AgentService

router = APIRouter()


def get_redis() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


def get_agent_service(db: Session = Depends(get_db)) -> AgentService:
    repository = ProfileRepository(db)
    return AgentService(
        memory_manager=MemoryManager(repository),
        prompt_assembler=PromptAssembler(),
        context_manager=ContextManager(get_redis()),
        llm_client=LLMClient(),
        repository=repository,
    )


@router.get("/health")
def health(x_trace_id: str = Header(default="", alias="X-Trace-Id")) -> dict:
    return ok({"service": settings.app_name, "status": "ok"}, x_trace_id)


@router.post("/v1/chat/tutor")
def tutor_chat(
    payload: dict[str, Any] = Body(...),
    x_trace_id: str = Header(default="", alias="X-Trace-Id"),
    agent_service: AgentService = Depends(get_agent_service),
) -> dict:
    request = TutorChatRequest.from_payload(payload)
    return ok(agent_service.tutor_chat(request), x_trace_id)


@router.post("/v1/plan/generate")
def generate_daily_plan(
    payload: dict[str, Any] = Body(...),
    x_trace_id: str = Header(default="", alias="X-Trace-Id"),
    agent_service: AgentService = Depends(get_agent_service),
) -> dict:
    request = DailyPlanRequest.from_payload(payload)
    return ok(agent_service.generate_daily_plan(request), x_trace_id)


@router.post("/v1/writing/correct")
def correct_writing(
    payload: dict[str, Any] = Body(...),
    x_trace_id: str = Header(default="", alias="X-Trace-Id"),
    agent_service: AgentService = Depends(get_agent_service),
) -> dict:
    request = WritingCorrectRequest.from_payload(payload)
    return ok(agent_service.correct_writing(request), x_trace_id)


@router.post("/v1/speaking/chat")
def speaking_chat(
    payload: dict[str, Any] = Body(...),
    x_trace_id: str = Header(default="", alias="X-Trace-Id"),
    agent_service: AgentService = Depends(get_agent_service),
) -> dict:
    request = SpeakingChatRequest.from_payload(payload)
    return ok(agent_service.speaking_chat(request), x_trace_id)


@router.post("/v1/context/clear")
def clear_context(
    payload: dict[str, Any] = Body(...),
    x_trace_id: str = Header(default="", alias="X-Trace-Id"),
    agent_service: AgentService = Depends(get_agent_service),
) -> dict:
    request = ClearContextRequest.from_payload(payload)
    agent_service.clear_context(request.user_id, request.session_id, request.scene)
    return ok({"cleared": True}, x_trace_id)


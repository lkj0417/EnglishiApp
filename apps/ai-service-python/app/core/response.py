from typing import Any

from fastapi.responses import JSONResponse


def ok(data: Any, trace_id: str = "") -> dict[str, Any]:
    return {"code": 0, "message": "success", "data": data, "traceId": trace_id}


def fail(status_code: int, code: int, message: str, trace_id: str = "") -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"code": code, "message": message, "data": {}, "traceId": trace_id},
    )


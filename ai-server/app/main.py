import logging

from fastapi import Depends, FastAPI

from app.api import (
    agent_steps,
    answers,
    briefings,
    documents,
    internal,
    outlooks,
    paths,
    plan_followups,
    summaries,
    text_changes,
    text_events,
)
from app.core.config import load_llm_settings
from app.core.errors import register_error_handlers
from app.core.internal_auth import (
    internal_auth_dependency,
    load_internal_token,
    validate_internal_token,
)
from app.core.trace import TraceIdMiddleware, install_log_record_factory
from app.llm import LlmClient

LOG_FORMAT = "%(asctime)s %(levelname)5s [%(trace_id)s] %(name)s - %(message)s"


def setup_logging() -> None:
    install_log_record_factory()
    app_logger = logging.getLogger("app")
    if not app_logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(LOG_FORMAT))
        app_logger.addHandler(handler)
    app_logger.setLevel(logging.INFO)


def create_app(llm_client: LlmClient | None = None, internal_token: str | None = None) -> FastAPI:
    """llm_client를 넘기지 않으면 환경변수(LLM_PROVIDER 등)로 만든다.

    테스트는 가짜 응답을 넘긴다.
    """
    setup_logging()
    app = FastAPI(title="Dart Insight AI Server", version="0.0.1")
    app.state.llm_client = llm_client or LlmClient.from_settings(load_llm_settings())
    app.add_middleware(TraceIdMiddleware)
    register_error_handlers(app)

    @app.get(paths.HEALTH)
    def health() -> dict[str, str]:
        return {"status": "UP"}

    expected_token = (
        validate_internal_token(internal_token)
        if internal_token is not None
        else load_internal_token()
    )
    internal_dependencies = [Depends(internal_auth_dependency(expected_token))]
    app.include_router(internal.router, dependencies=internal_dependencies)
    app.include_router(documents.router, dependencies=internal_dependencies)
    app.include_router(text_changes.router, dependencies=internal_dependencies)
    app.include_router(text_events.router, dependencies=internal_dependencies)
    app.include_router(summaries.router, dependencies=internal_dependencies)
    app.include_router(answers.router, dependencies=internal_dependencies)
    app.include_router(briefings.router, dependencies=internal_dependencies)
    app.include_router(outlooks.router, dependencies=internal_dependencies)
    app.include_router(plan_followups.router, dependencies=internal_dependencies)
    app.include_router(agent_steps.router, dependencies=internal_dependencies)
    return app


app = create_app()

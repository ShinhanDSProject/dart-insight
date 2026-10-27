import logging

from fastapi import FastAPI

from app.api import (
    answers,
    briefings,
    documents,
    internal,
    outlooks,
    paths,
    summaries,
    text_changes,
)
from app.core.config import load_llm_settings
from app.core.errors import register_error_handlers
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


def create_app(llm_client: LlmClient | None = None) -> FastAPI:
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

    app.include_router(internal.router)
    app.include_router(documents.router)
    app.include_router(text_changes.router)
    app.include_router(summaries.router)
    app.include_router(answers.router)
    app.include_router(briefings.router)
    app.include_router(outlooks.router)
    return app


app = create_app()

import logging

from fastapi import FastAPI

from app.api import internal
from app.core.errors import register_error_handlers
from app.core.trace import TraceIdMiddleware, install_log_record_factory

LOG_FORMAT = "%(asctime)s %(levelname)5s [%(trace_id)s] %(name)s - %(message)s"


def setup_logging() -> None:
    install_log_record_factory()
    app_logger = logging.getLogger("app")
    if not app_logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(LOG_FORMAT))
        app_logger.addHandler(handler)
    app_logger.setLevel(logging.INFO)


def create_app() -> FastAPI:
    setup_logging()
    app = FastAPI(title="Dart Insight AI Server", version="0.0.1")
    app.add_middleware(TraceIdMiddleware)
    register_error_handlers(app)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "UP"}

    app.include_router(internal.router)
    return app


app = create_app()

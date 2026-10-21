from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="Dart Insight AI Server", version="0.0.1")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "UP"}

    return app


app = create_app()

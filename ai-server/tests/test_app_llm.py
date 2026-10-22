from app.core.config import LlmSettings
from app.llm import FakeProvider, LlmClient
from app.main import create_app


def test_app_without_llm_setting_has_no_provider(monkeypatch) -> None:
    monkeypatch.delenv("LLM_PROVIDER", raising=False)

    app = create_app()

    assert not app.state.llm_client.available


def test_app_uses_given_llm_client() -> None:
    client = LlmClient(FakeProvider(), LlmSettings(provider="fake"))

    app = create_app(llm_client=client)

    assert app.state.llm_client is client

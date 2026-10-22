from fastapi.testclient import TestClient

from app.documents.parser import PARSER_VERSION
from app.main import create_app
from tests.test_document_parser import RCEPT, SAMPLE, make_zip

client = TestClient(create_app())


def test_parser_version_is_published() -> None:
    response = client.get("/internal/documents/parser")

    assert response.json() == {"parserVersion": PARSER_VERSION}


def test_zip_is_structured_with_positions() -> None:
    data = make_zip({f"{RCEPT}.xml": SAMPLE.encode("utf-8")})

    response = client.post(f"/internal/documents/{RCEPT}/structure", content=data,
                           headers={"Content-Type": "application/zip", "X-Trace-Id": "doc-1"})

    assert response.status_code == 200
    assert response.headers["X-Trace-Id"] == "doc-1"
    body = response.json()
    assert body["status"] == "STRUCTURED"
    assert body["parserVersion"] == PARSER_VERSION
    assert body["mainFile"] == f"{RCEPT}.xml"
    section = body["sections"][2]
    assert section["title"] == "1. 회사의 개요"
    assert section["parentNo"] == 2
    table = section["blocks"][1]
    assert table["type"] == "TABLE"
    assert table["rows"][0][0] == {"text": "구분", "header": True, "colspan": 2}
    assert body["counts"]["cells"] == body["counts"]["sourceCells"]


def test_unreadable_file_is_a_failed_result_not_an_error() -> None:
    response = client.post(f"/internal/documents/{RCEPT}/structure", content=b"not a zip")

    assert response.status_code == 200
    assert response.json()["status"] == "FAILED"
    assert response.json()["failureCode"] == "INVALID_ZIP"


def test_bad_receipt_number_is_rejected() -> None:
    response = client.post("/internal/documents/123/structure", content=b"x")

    assert response.status_code == 400
    assert response.json()["code"] == "COMMON_INVALID_INPUT"


def test_empty_body_is_rejected() -> None:
    response = client.post(f"/internal/documents/{RCEPT}/structure", content=b"")

    assert response.status_code == 400

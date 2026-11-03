from fastapi.testclient import TestClient

from app.main import create_app

client = TestClient(create_app())

SECTIONS = [
    {"sectionNo": 1, "parentNo": None, "level": 1, "title": "II. 사업의 내용"},
    {"sectionNo": 2, "parentNo": 1, "level": 2, "title": "1. 사업의 개요"},
]


def body(prev_text: str, cur_text: str) -> dict:
    return {
        "previous": {
            "rceptNo": "20250311000001",
            "sections": SECTIONS,
            "blocks": [{"blockNo": 5, "sectionNo": 2, "type": "PARAGRAPH", "text": prev_text}],
        },
        "current": {
            "rceptNo": "20260310000001",
            "sections": SECTIONS,
            "blocks": [{"blockNo": 7, "sectionNo": 2, "type": "PARAGRAPH", "text": cur_text}],
        },
    }


def test_changes_come_back_with_positions() -> None:
    response = client.post(
        "/internal/text-changes",
        json=body("메모리를 만듭니다.", "메모리와 파운드리를 만듭니다."),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["diffVersion"] == "text-diff-2"
    (change,) = data["changes"]
    assert change["changeType"] == "MODIFIED"
    assert change["previous"] == {"sectionNo": 2, "blockNo": 5}
    assert change["current"] == {"sectionNo": 2, "blockNo": 7}
    assert change["sectionPath"] == "II. 사업의 내용 > 1. 사업의 개요"
    assert change["numbersOnly"] is False
    assert change["previousSectionPath"] is None
    assert data["priorityVersion"] == "priority-3"
    assert change["priority"]["level"] in {"HIGH", "MEDIUM", "LOW"}
    assert change["priority"]["reasons"][0].startswith("사업의 내용 섹션")


def test_changes_come_back_with_list_classification() -> None:
    response = client.post(
        "/internal/text-changes",
        json=body("메모리를 만듭니다.", "메모리와 파운드리를 만듭니다."),
    )

    data = response.json()
    assert data["listVersion"] == "text-list-1"
    assert "BUSINESS" not in data["missingFields"]
    assert "LITIGATION" in data["missingFields"]
    (change,) = data["changes"]
    assert change["listGroup"] == "MAIN"
    assert change["field"] == "BUSINESS"
    assert change["raisedFromNote"] is False
    assert change["noteScope"] is None


def table_body(prev_text: str, cur_text: str) -> dict:
    data = body(prev_text, cur_text)
    data["previous"]["blocks"][0]["type"] = "TABLE"
    data["current"]["blocks"][0]["type"] = "TABLE"
    return data


def test_modified_table_comes_back_with_its_row_comparison() -> None:
    response = client.post(
        "/internal/text-changes",
        json=table_body(
            "사건번호 | 진행상황\n2025가합1 | 진행 중\n2025가합2 | 진행 중\n2025가합3 | 진행 중",
            "사건번호 | 진행상황\n2025가합1 | 화해권고\n2025가합3 | 진행 중\n2026가합9 | 진행 중",
        ),
    )

    (change,) = response.json()["changes"]
    assert change["rowDiff"] == {
        "status": "COMPARED",
        "keyColumn": "사건번호",
        "counts": {"changed": 1, "added": 1, "missing": 1, "same": 1},
        "pairedPrevious": None,
        "changedRows": [
            {
                "key": "2025가합1",
                "cells": [{"column": "진행상황", "previous": "진행 중", "current": "화해권고"}],
            }
        ],
        "addedKeys": ["2026가합9"],
        "missingKeys": ["2025가합2"],
    }


def test_table_that_cannot_be_compared_says_so_with_empty_values() -> None:
    response = client.post(
        "/internal/text-changes",
        json=table_body("구분 | 값\n가 | 1\n가 | 1", "구분 | 값\n가 | 1\n가 | 1\n가 | 1"),
    )

    (change,) = response.json()["changes"]
    assert change["rowDiff"] == {
        "status": "NOT_COMPARED",
        "keyColumn": None,
        "counts": None,
        "pairedPrevious": None,
        "changedRows": [],
        "addedKeys": [],
        "missingKeys": [],
    }


def test_paragraph_has_no_row_comparison() -> None:
    response = client.post(
        "/internal/text-changes",
        json=body("메모리를 만듭니다.", "메모리와 파운드리를 만듭니다."),
    )

    (change,) = response.json()["changes"]
    assert change["rowDiff"] is None


def test_moved_change_has_both_locations_and_previous_section_path() -> None:
    sections = [*SECTIONS, {"sectionNo": 3, "parentNo": 1, "level": 2, "title": "2. 주요 제품"}]
    text = "당사는 미국 텍사스주에 반도체 공장을 짓고 있습니다."
    data = {
        "previous": {
            "rceptNo": "20250311000001",
            "sections": sections,
            "blocks": [{"blockNo": 5, "sectionNo": 2, "type": "PARAGRAPH", "text": text}],
        },
        "current": {
            "rceptNo": "20260310000001",
            "sections": sections,
            "blocks": [{"blockNo": 7, "sectionNo": 3, "type": "PARAGRAPH", "text": text}],
        },
    }

    response = client.post("/internal/text-changes", json=data)

    assert response.status_code == 200
    (change,) = response.json()["changes"]
    assert change["changeType"] == "MOVED"
    assert change["previous"] == {"sectionNo": 2, "blockNo": 5}
    assert change["current"] == {"sectionNo": 3, "blockNo": 7}
    assert change["sectionPath"] == "II. 사업의 내용 > 2. 주요 제품"
    assert change["previousSectionPath"] == "II. 사업의 내용 > 1. 사업의 개요"
    assert change["numbersOnly"] is False


def test_block_in_unknown_section_is_rejected() -> None:
    data = body("a", "b")
    data["current"]["blocks"][0]["sectionNo"] = 99

    response = client.post("/internal/text-changes", json=data)

    assert response.status_code == 400
    assert response.json()["code"] == "COMMON_INVALID_INPUT"


def test_bad_receipt_number_is_a_validation_error() -> None:
    data = body("a", "b")
    data["previous"]["rceptNo"] = "123"

    response = client.post("/internal/text-changes", json=data)

    assert response.status_code == 400
    assert response.json()["errors"][0]["field"].endswith("rceptNo")

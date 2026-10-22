"""문장 변경 탐지 내부 API의 요청·응답 모양(camelCase)."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.compare.text_diff import BlockIn, Change, DiffResult, DocumentIn, Position, SectionIn


class _Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SectionModel(_Model):
    section_no: int
    parent_no: int | None = None
    level: int
    title: str
    cover: bool = False


class BlockModel(_Model):
    block_no: int
    section_no: int
    type: str
    text: str


class DocumentModel(_Model):
    rcept_no: str = Field(pattern=r"^\d{14}$")
    sections: list[SectionModel]
    blocks: list[BlockModel]

    def to_input(self) -> DocumentIn:
        section_nos = {s.section_no for s in self.sections}
        if len(section_nos) != len(self.sections):
            raise ValueError(f"{self.rcept_no}: 섹션 번호가 겹칩니다.")
        unknown = {b.section_no for b in self.blocks} - section_nos
        if unknown:
            raise ValueError(
                f"{self.rcept_no}: 없는 섹션을 가리키는 블록이 있습니다: {sorted(unknown)[:5]}"
            )
        return DocumentIn(
            self.rcept_no,
            [
                SectionIn(s.section_no, s.parent_no, s.level, s.title, s.cover)
                for s in self.sections
            ],
            [BlockIn(b.block_no, b.section_no, b.type, b.text) for b in self.blocks],
        )


class TextChangeRequest(_Model):
    previous: DocumentModel
    current: DocumentModel


def _position(position: Position | None) -> dict[str, Any] | None:
    if position is None:
        return None
    return {"sectionNo": position.section_no, "blockNo": position.block_no}


def _change(change: Change) -> dict[str, Any]:
    return {
        "changeType": change.change_type,
        "blockType": change.block_type,
        "sectionStatus": change.section_status,
        "sectionTitle": change.section_title,
        "sectionPath": change.section_path,
        "previous": _position(change.previous),
        "current": _position(change.current),
        "numbersOnly": change.numbers_only,
        "similarity": change.similarity,
        "reviewReason": change.review_reason,
    }


def result_json(result: DiffResult) -> dict[str, Any]:
    return {
        "diffVersion": result.diff_version,
        "sectionCounts": result.section_counts,
        "changes": [_change(c) for c in result.changes],
    }

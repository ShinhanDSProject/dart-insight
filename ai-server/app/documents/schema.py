"""구조화 결과를 내부 API 응답(JSON, camelCase)으로 바꾼다."""

from typing import Any

from app.documents.parser import Block, Cell, Section, StructuredDocument


def _cell(cell: Cell) -> dict[str, Any]:
    data: dict[str, Any] = {"text": cell.text}
    if cell.header:
        data["header"] = True
    if cell.colspan > 1:
        data["colspan"] = cell.colspan
    if cell.rowspan > 1:
        data["rowspan"] = cell.rowspan
    return data


def _block(block: Block) -> dict[str, Any]:
    data: dict[str, Any] = {"blockNo": block.block_no, "type": block.type, "text": block.text}
    if block.rows is not None:
        data["rows"] = [[_cell(c) for c in row] for row in block.rows]
    return data


def _section(section: Section) -> dict[str, Any]:
    return {
        "sectionNo": section.section_no,
        "parentNo": section.parent_no,
        "level": section.level,
        "title": section.title,
        "ref": section.ref,
        "cover": section.cover,
        "blocks": [_block(b) for b in section.blocks],
    }


def document_json(document: StructuredDocument) -> dict[str, Any]:
    return {
        "rceptNo": document.rcept_no,
        "parserVersion": document.parser_version,
        "status": document.status,
        "failureCode": document.failure_code,
        "failureMessage": document.failure_message,
        "mainFile": document.main_file,
        "encoding": document.encoding,
        "documentName": document.document_name,
        "companyName": document.company_name,
        "attachments": document.attachments,
        "warnings": [{"code": w.code, "message": w.message} for w in document.warnings],
        "counts": document.counts,
        "sections": [_section(s) for s in document.sections],
    }

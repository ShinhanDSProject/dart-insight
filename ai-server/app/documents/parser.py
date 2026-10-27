"""공시서류원본파일(document.xml ZIP) 구조화(4.2).

OpenDART의 원문 XML은 형식이 엄격하지 않아(이스케이프 안 된 `&`, 닫히지 않은 태그)
XML 파서가 내용을 버릴 수 있다. 그래서 관대한 `html.parser`로 읽고, 표 셀·문단 태그 수를
원문과 대조해 빠진 내용이 있으면 PARTIAL로 남긴다(원문 파싱 스파이크 #4 메모).

- ZIP 안에서 본문 파일(`{접수번호}.xml`)을 고른다.
  `_00760` 같은 붙은 파일(감사보고서 등)은 읽지 않는다.
- 인코딩: XML 선언 → UTF-8 → CP949 순서로 시도한다.
- 이스케이프 안 된 `&`만 `&amp;`로 고친다(그 밖의 내용은 고치지 않는다).
- `SECTION-n`과 그 첫 `TITLE`로 목차(섹션)를 만들고,
  `P`는 문단, `TABLE`은 표(TD·TH·TE·TU 셀)로 모은다.
- 섹션·블록 번호는 문서 순서대로 1부터 매긴다. 블록 번호가 원문 위치(근거 ID)의 기준이다.
- 표 안의 표(#397): 칸이 하나뿐인 '틀' 표가 표나 여러 문단을 감싸고 있으면 틀을 풀어 안의 문단·표를
  차례대로 블록으로 둔다. 칸이 여럿인 표 안의 표는 그 칸의 글로 넣는다.
  모든 칸이 빈 표는 블록으로 두지 않는다.
"""

from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass, field, replace
from html.parser import HTMLParser

# 결과가 달라지게 바꾸면 이 버전과 backend Analysis.CURRENT_VERSION을 함께 올린다
PARSER_VERSION = "dart-xml-2"

STRUCTURED = "STRUCTURED"
PARTIAL = "PARTIAL"
FAILED = "FAILED"

PARAGRAPH = "PARAGRAPH"
TABLE = "TABLE"

# 실패 사유(failure_code)
INVALID_ZIP = "INVALID_ZIP"
MAIN_FILE_NOT_FOUND = "MAIN_FILE_NOT_FOUND"
FILE_TOO_LARGE = "FILE_TOO_LARGE"
PARSE_ERROR = "PARSE_ERROR"
UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT"

# 경고(Notice.code). PARTIAL_WARNINGS가 있으면 빠진 내용이 있을 수 있어 PARTIAL이다
NO_BODY_TAG = "NO_BODY_TAG"
ENCODING_REPLACED = "ENCODING_REPLACED"
CELL_COUNT_MISMATCH = "CELL_COUNT_MISMATCH"
PARAGRAPH_COUNT_MISMATCH = "PARAGRAPH_COUNT_MISMATCH"
UNTITLED_SECTION = "UNTITLED_SECTION"
PARTIAL_WARNINGS = frozenset({ENCODING_REPLACED, CELL_COUNT_MISMATCH, PARAGRAPH_COUNT_MISMATCH})

_CELL_TAGS = {"td", "th", "te", "tu"}
# 읽지 않는 요소: 열 너비, 그림, 문서 앞의 요약(추출 값) 영역
_SKIP_TAGS = {"colgroup", "col", "image", "img", "summary"}
_SECTION_TAG = re.compile(r"^section-(\d+)$")
_BARE_AMP = re.compile(r"&(?!(?:[A-Za-z][A-Za-z0-9]*|#\d+|#[xX][0-9A-Fa-f]+);)")
_XML_ENCODING = re.compile(rb"<\?xml[^>]*encoding=[\"']([A-Za-z0-9_\-]+)[\"']", re.IGNORECASE)
_SPACE = re.compile(r"\s+")
_MAIN_FILE = re.compile(r"^(\d{14})\.xml$", re.IGNORECASE)
_BODY = re.compile(r"<BODY\b.*?</BODY\s*>", re.IGNORECASE | re.DOTALL)
_SOURCE_CELL = re.compile(r"<(?:TD|TH|TE|TU)(?=[\s>/])", re.IGNORECASE)
_SOURCE_P = re.compile(r"<P(?=[\s>/])", re.IGNORECASE)
_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
_HAS_BODY = re.compile(r"<BODY(?=[\s>/])", re.IGNORECASE)
# html.parser가 TITLE 안을 글자 그대로 읽지 않도록 이름을 바꿔 읽는다
# (최신 Python은 title을 RCDATA로 다룬다)
_TITLE_TAG = re.compile(r"<(/?)TITLE(?=[\s>/])", re.IGNORECASE)


@dataclass(frozen=True)
class Cell:
    text: str
    header: bool = False
    colspan: int = 1
    rowspan: int = 1


@dataclass(frozen=True)
class Block:
    block_no: int
    section_no: int
    type: str
    text: str
    rows: list[list[Cell]] | None = None


@dataclass(frozen=True)
class Section:
    section_no: int
    parent_no: int | None
    level: int
    title: str
    ref: str | None = None
    cover: bool = False
    blocks: list[Block] = field(default_factory=list)


@dataclass(frozen=True)
class Notice:
    code: str
    message: str


@dataclass(frozen=True)
class StructuredDocument:
    rcept_no: str
    status: str
    parser_version: str = PARSER_VERSION
    failure_code: str | None = None
    failure_message: str | None = None
    main_file: str | None = None
    encoding: str | None = None
    document_name: str | None = None
    company_name: str | None = None
    attachments: list[str] = field(default_factory=list)
    warnings: list[Notice] = field(default_factory=list)
    sections: list[Section] = field(default_factory=list)
    counts: dict[str, int] = field(default_factory=dict)

    @property
    def blocks(self) -> list[Block]:
        return [b for s in self.sections for b in s.blocks]


def failed(rcept_no: str, code: str, message: str, **kwargs: object) -> StructuredDocument:
    return StructuredDocument(
        rcept_no, FAILED, failure_code=code, failure_message=message, **kwargs
    )  # type: ignore[arg-type]


MAX_MAIN_FILE_BYTES = 300 * 1024 * 1024


def structure_zip(rcept_no: str, data: bytes) -> StructuredDocument:
    """ZIP 바이트를 받아 구조화한다. 읽을 수 없으면 FAILED와 사유를 돌려준다(예외를 던지지 않음)."""
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        return failed(rcept_no, INVALID_ZIP, "원문 파일이 ZIP 형식이 아니에요.")
    with archive:
        names = [n for n in archive.namelist() if n.lower().endswith(".xml")]
        main = _choose_main(rcept_no, names)
        attachments = sorted(n for n in names if n != main)
        if main is None:
            return failed(
                rcept_no,
                MAIN_FILE_NOT_FOUND,
                f"ZIP 안에서 본문 파일({rcept_no}.xml)을 찾지 못했어요.",
                attachments=attachments,
            )
        if archive.getinfo(main).file_size > MAX_MAIN_FILE_BYTES:
            return failed(
                rcept_no,
                FILE_TOO_LARGE,
                "본문 파일이 너무 커서 읽지 않았어요(압축을 풀면 300MB 초과).",
                main_file=main,
                attachments=attachments,
            )
        raw = archive.read(main)
    return replace(structure_xml(rcept_no, raw), main_file=main, attachments=attachments)


def _choose_main(rcept_no: str, names: list[str]) -> str | None:
    for name in names:
        if name.lower() == f"{rcept_no}.xml":
            return name
    plain = [n for n in names if _MAIN_FILE.match(n.rsplit("/", 1)[-1])]
    if len(plain) == 1:
        return plain[0]
    return names[0] if len(names) == 1 else None


def decode(raw: bytes) -> tuple[str, str, bool]:
    """(문자열, 인코딩, 대체 문자를 썼는지)"""
    candidates = []
    declared = _XML_ENCODING.search(raw[:200])
    if declared:
        candidates.append(declared.group(1).decode("ascii").lower())
    candidates += ["utf-8", "cp949"]
    for encoding in dict.fromkeys(candidates):
        try:
            return raw.decode(encoding), encoding, False
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("utf-8", errors="replace"), "utf-8", True


def structure_xml(rcept_no: str, raw: bytes) -> StructuredDocument:
    text, encoding, replaced = decode(raw)
    repaired, amp_count = _BARE_AMP.subn("&amp;", text)
    repaired = _TITLE_TAG.sub(r"<\1DART-TITLE", repaired)
    has_body = bool(_HAS_BODY.search(text))
    reader = _DartReader(whole_document=not has_body)
    try:
        reader.feed(repaired)
        reader.close()
    except Exception as e:  # html.parser는 거의 실패하지 않지만, 실패를 성공으로 처리하지 않는다
        return failed(
            rcept_no,
            PARSE_ERROR,
            f"원문을 읽다 오류가 났어요: {type(e).__name__}",
            encoding=encoding,
        )

    if not any(s.level > 0 and not s.cover for s in reader.sections):
        return failed(
            rcept_no,
            UNSUPPORTED_FORMAT,
            "원문에서 목차(SECTION·TITLE)를 찾지 못했어요.",
            encoding=encoding,
        )

    body = _BODY.search(_COMMENT.sub("", text))
    source = body.group(0) if body else text
    blocks = [b for s in reader.sections for b in s.blocks]
    counts = {
        "sections": len(reader.sections),
        "paragraphs": sum(1 for b in blocks if b.type == PARAGRAPH),
        "tables": sum(1 for b in blocks if b.type == TABLE),
        "cells": reader.cell_tags,
        "sourceCells": len(_SOURCE_CELL.findall(source)),
        "paragraphTags": reader.p_tags,
        "sourceParagraphTags": len(_SOURCE_P.findall(source)),
        "repairedAmpersands": amp_count,
    }
    warnings: list[Notice] = []
    if not has_body:
        warnings.append(Notice(NO_BODY_TAG, "원문에 BODY 태그가 없어 문서 전체를 읽었어요."))
    if replaced:
        warnings.append(
            Notice(ENCODING_REPLACED, "인코딩을 확인하지 못해 읽을 수 없는 글자를 대체했어요.")
        )
    if counts["cells"] != counts["sourceCells"]:
        warnings.append(
            Notice(
                CELL_COUNT_MISMATCH,
                f"표 셀 수가 원문과 달라요(원문 {counts['sourceCells']}개, "
                f"읽은 셀 {counts['cells']}개).",
            )
        )
    if counts["paragraphTags"] != counts["sourceParagraphTags"]:
        warnings.append(
            Notice(
                PARAGRAPH_COUNT_MISMATCH,
                f"문단 태그 수가 원문과 달라요(원문 {counts['sourceParagraphTags']}개, "
                f"읽은 문단 {counts['paragraphTags']}개).",
            )
        )
    if reader.untitled:
        warnings.append(Notice(UNTITLED_SECTION, f"제목이 없는 섹션이 {reader.untitled}개 있어요."))
    partial = any(w.code in PARTIAL_WARNINGS for w in warnings)
    return StructuredDocument(
        rcept_no,
        PARTIAL if partial else STRUCTURED,
        encoding=encoding,
        document_name=reader.document_name,
        company_name=reader.company_name,
        warnings=warnings,
        sections=reader.sections,
        counts=counts,
    )


def normalize_space(text: str) -> str:
    return _SPACE.sub(" ", text.replace("\xa0", " ")).strip()


@dataclass
class _SectionContext:
    level: int
    section_no: int | None = None
    cover: bool = False
    has_content: bool = False


@dataclass(frozen=True)
class _Break:
    """표 칸 안의 문단 경계(P). 칸 글에서는 띄어쓰기이고, 틀 표를 풀 때는 문단을 나눈다."""


_BREAK = _Break()


@dataclass
class _Table:
    rows: list[list[Cell]] = field(default_factory=list)
    row: list[Cell] | None = None
    # 지금 읽는 칸의 내용: 글, 문단 경계, 칸 안의 표
    cell: list[str | _Break | _Table] | None = None
    cell_header: bool = False
    cell_colspan: int = 1
    cell_rowspan: int = 1
    # 마친 칸마다의 내용(틀 표를 풀 때 쓴다). rows의 칸 순서와 같다
    cell_parts: list[list[str | _Break | _Table]] = field(default_factory=list)

    def wrapper_parts(self) -> list[str | _Break | _Table] | None:
        """칸이 하나뿐이고 그 안에 표나 여러 문단이 있으면 그 내용, 아니면 None(풀지 않는 표)."""
        if len(self.rows) != 1 or len(self.rows[0]) != 1 or len(self.cell_parts) != 1:
            return None
        parts = self.cell_parts[0]
        if any(isinstance(part, _Table) for part in parts):
            return parts
        paragraphs = 0
        chunk = False
        for part in parts:
            if isinstance(part, _Break):
                paragraphs += chunk
                chunk = False
            elif part.strip():
                chunk = True
        paragraphs += chunk
        return parts if paragraphs > 1 else None


def _parts_text(parts: list[str | _Break | _Table]) -> str:
    """칸 내용을 칸 글로 만든다. 칸 안의 표는 칸 글을 띄어 써서 넣는다."""
    out: list[str] = []
    for part in parts:
        if isinstance(part, _Break):
            out.append(" ")
        elif isinstance(part, _Table):
            out.append(" " + _table_text(part) + " ")
        else:
            out.append(part)
    return normalize_space("".join(out))


def _table_text(table: _Table) -> str:
    return " ".join(cell.text for row in table.rows for cell in row if cell.text)


class _DartReader(HTMLParser):
    def __init__(self, whole_document: bool = False) -> None:
        super().__init__(convert_charrefs=True)
        self.sections: list[Section] = []
        self.document_name: str | None = None
        self.company_name: str | None = None
        self.cell_tags = 0
        self.p_tags = 0
        self.untitled = 0
        self._stack: list[str] = []
        self._in_body = whole_document
        self._meta: str | None = None
        self._meta_buf: list[str] = []
        self._contexts: list[_SectionContext] = []
        self._title: list[str] | None = None
        self._title_kind: str | None = None  # section, cover, inline
        self._title_ref: str | None = None
        self._para: list[str] | None = None
        self._loose: list[str] = []
        # 열린 표(안쪽 표가 뒤). 맨 바깥 표를 닫을 때 블록을 만든다
        self._tables: list[_Table] = []
        self._skip = 0
        self._block_no = 0

    @property
    def _table(self) -> _Table | None:
        return self._tables[-1] if self._tables else None

    # ── 태그 열고 닫기 ──────────────────────────────────────
    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._stack.append(tag)
        self._open(tag, dict(attrs))

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._open(tag, dict(attrs))
        self._close(tag)

    def handle_endtag(self, tag: str) -> None:
        if tag not in self._stack:
            return  # 열지 않은 태그를 닫는 경우는 무시한다
        while self._stack:
            top = self._stack.pop()
            self._close(top)
            if top == tag:
                break

    def close(self) -> None:
        super().close()
        while self._stack:
            self._close(self._stack.pop())
        self._flush_loose()

    def _open(self, tag: str, attrs: dict[str, str | None]) -> None:
        if tag in ("document-name", "company-name") and self._meta is None and self._table is None:
            self._meta, self._meta_buf = tag, []
            return
        if tag == "body":
            self._in_body = True
            return
        if not self._in_body:
            return
        if tag in _SKIP_TAGS:
            if tag not in ("img", "col"):
                self._skip += 1
            return
        if self._table is not None:
            self._open_in_table(tag, attrs)
            return
        if tag == "br":
            self._append("\n")
        elif tag == "cover":
            self._flush_loose()
            self._contexts.append(_SectionContext(level=1, cover=True))
        elif tag == "cover-title":
            self._start_title("cover", None)
        elif match := _SECTION_TAG.match(tag):
            self._flush_loose()
            self._contexts.append(_SectionContext(level=int(match.group(1))))
        elif tag == "dart-title":
            context = self._contexts[-1] if self._contexts else None
            if context and context.section_no is None and not context.has_content:
                self._flush_loose()
                self._start_title("section", attrs.get("aassocnote"))
            else:
                self._flush_loose()
                self._start_title("inline", None)
        elif tag == "p":
            self.p_tags += 1
            if self._title is None:
                self._flush_loose()
                # 앞 문단이 닫히지 않았으면 그 글을 먼저 문단으로 남긴다(닫는 태그가 빠진 원문)
                self._finish_para()
                self._para = []
        elif tag == "table":
            self._flush_loose()
            self._finish_para()
            self._tables.append(_Table())

    def _open_in_table(self, tag: str, attrs: dict[str, str | None]) -> None:
        table = self._table
        assert table is not None
        if tag == "table":
            # 표 안의 표는 따로 모았다가, 닫을 때 바깥 칸의 내용으로 넣는다
            self._tables.append(_Table())
        elif tag == "p":
            self.p_tags += 1
            if table.cell is not None:
                table.cell.append(_BREAK)
            else:
                self._append(" ")
        elif tag == "br":
            self._append("\n")
        elif tag == "tr":
            self._finish_row()
            table.row = []
        elif tag in _CELL_TAGS:
            self.cell_tags += 1
            self._finish_cell()
            if table.row is None:
                table.row = []
            table.cell = []
            table.cell_header = tag == "th"
            table.cell_colspan = _span(attrs.get("colspan"))
            table.cell_rowspan = _span(attrs.get("rowspan"))

    def _close(self, tag: str) -> None:
        if tag == self._meta:
            value = normalize_space("".join(self._meta_buf)) or None
            if tag == "document-name":
                self.document_name = value
            else:
                self.company_name = value
            self._meta = None
            return
        if tag == "body":
            self._flush_loose()
            self._in_body = False
            return
        if not self._in_body:
            return
        if tag in _SKIP_TAGS:
            if tag not in ("img", "col"):
                self._skip = max(0, self._skip - 1)
            return
        if self._table is not None:
            self._close_in_table(tag)
            return
        if tag in ("dart-title", "cover-title"):
            self._finish_title()
        elif tag == "p":
            self._finish_para()
        elif tag == "cover" or _SECTION_TAG.match(tag):
            self._flush_loose()
            if self._contexts:
                self._contexts.pop()

    def _close_in_table(self, tag: str) -> None:
        table = self._table
        assert table is not None
        if tag == "table":
            self._finish_row()
            self._tables.pop()
            parent = self._table
            if parent is None:
                self._emit_table(table)
            elif parent.cell is not None:
                parent.cell.append(table)
            elif text := _table_text(table):
                # 칸 밖에 놓인 안쪽 표. 버리지 않고 바깥 표의 한 행으로 둔다
                parent.rows.append([Cell(text)])
                parent.cell_parts.append([text])
        elif tag in _CELL_TAGS:
            self._finish_cell()
        elif tag == "tr":
            self._finish_row()

    def _emit_table(self, table: _Table) -> None:
        """맨 바깥 표를 블록으로 만든다.

        틀 표는 풀어 안의 문단·표를 차례대로 두고, 모든 칸이 빈 표는 두지 않는다.
        """
        parts = table.wrapper_parts()
        if parts is not None:
            buffer: list[str] = []

            def flush() -> None:
                text = normalize_space("".join(buffer))
                buffer.clear()
                if text:
                    self._add_block(PARAGRAPH, text)

            for part in parts:
                if isinstance(part, _Table):
                    flush()
                    self._emit_table(part)
                elif isinstance(part, _Break):
                    flush()
                else:
                    buffer.append(part)
            flush()
            return
        rows = [r for r in table.rows if r]
        if not any(cell.text for row in rows for cell in row):
            return
        text = "\n".join(" | ".join(c.text for c in row) for row in rows)
        self._add_block(TABLE, text, rows)

    # ── 글 모으기 ───────────────────────────────────────────
    def handle_data(self, data: str) -> None:
        if self._meta is not None:
            self._meta_buf.append(data)
            return
        if not self._in_body or self._skip:
            return
        self._append(data)

    def _append(self, data: str) -> None:
        if self._table is not None:
            if self._table.cell is not None:
                self._table.cell.append(data)
            elif data.strip():
                # 셀 밖에 있는 표 안의 글. 버리지 않고 별도 행으로 둔다
                text = normalize_space(data)
                self._table.rows.append([Cell(text)])
                self._table.cell_parts.append([text])
            return
        if self._title is not None:
            self._title.append(data)
        elif self._para is not None:
            self._para.append(data)
        else:
            self._loose.append(data)

    def _start_title(self, kind: str, ref: str | None) -> None:
        self._finish_para()
        self._title, self._title_kind, self._title_ref = [], kind, ref

    def _finish_title(self) -> None:
        if self._title is None:
            return
        text = normalize_space("".join(self._title))
        kind, ref = self._title_kind, self._title_ref
        self._title = self._title_kind = self._title_ref = None
        if kind == "section" and self._contexts:
            self._create_section(self._contexts[-1], text or "(제목 없음)", ref)
            if not text:
                self.untitled += 1
        elif kind == "cover" and self._contexts and self._contexts[-1].section_no is None:
            self._create_section(self._contexts[-1], text or "표지", None)
        elif text:
            self._add_block(PARAGRAPH, text)

    def _finish_para(self) -> None:
        if self._para is None:
            return
        text = normalize_space("".join(self._para))
        self._para = None
        if text:
            self._add_block(PARAGRAPH, text)

    def _flush_loose(self) -> None:
        if not self._loose:
            return
        text = normalize_space("".join(self._loose))
        self._loose = []
        if text:
            self._add_block(PARAGRAPH, text)

    def _finish_cell(self) -> None:
        table = self._table
        if table is None or table.cell is None:
            return
        cell = Cell(
            _parts_text(table.cell),
            table.cell_header,
            table.cell_colspan,
            table.cell_rowspan,
        )
        if table.row is None:
            table.row = []
        table.row.append(cell)
        table.cell_parts.append(table.cell)
        table.cell = None

    def _finish_row(self) -> None:
        table = self._table
        if table is None:
            return
        self._finish_cell()
        if table.row:
            table.rows.append(table.row)
        table.row = None

    # ── 섹션·블록 만들기 ────────────────────────────────────
    def _create_section(self, context: _SectionContext, title: str, ref: str | None) -> Section:
        parent = next(
            (c.section_no for c in reversed(self._contexts[:-1]) if c.section_no is not None), None
        )
        section = Section(len(self.sections) + 1, parent, context.level, title, ref, context.cover)
        self.sections.append(section)
        context.section_no = section.section_no
        return section

    def _current_section(self) -> Section:
        if self._contexts:
            context = self._contexts[-1]
            if context.section_no is None:
                if context.cover:
                    self._create_section(context, "표지", None)
                else:
                    self.untitled += 1
                    self._create_section(context, "(제목 없음)", None)
            return self.sections[context.section_no - 1]  # type: ignore[operator]
        # 목차 밖의 본문(BODY 바로 아래)
        if not self.sections or self.sections[-1].level != 0:
            self.sections.append(Section(len(self.sections) + 1, None, 0, "(목차 밖 본문)"))
        return self.sections[-1]

    def _add_block(self, kind: str, text: str, rows: list[list[Cell]] | None = None) -> None:
        section = self._current_section()
        if self._contexts:
            self._contexts[-1].has_content = True
        self._block_no += 1
        section.blocks.append(Block(self._block_no, section.section_no, kind, text, rows))


def _span(value: str | None) -> int:
    try:
        return max(1, int(value or 1))
    except ValueError:
        return 1

"""원문 구조화(4.2) 테스트.

여기 원문은 스파이크 #4 메모(TITLE 섹션, P·TD/TH/TE/TU, 이스케이프 안 된 &, CP949)에
맞춰 만든 합성 자료다.
실제 원문 검증 기록은 tests/fixtures/documents/README.md에 접수번호와 기대값으로 남긴다.
"""

import io
import zipfile

from app.documents.parser import (
    FAILED,
    PARAGRAPH,
    PARSER_VERSION,
    PARTIAL,
    STRUCTURED,
    TABLE,
    structure_xml,
    structure_zip,
)

RCEPT = "20250311000001"

SAMPLE = """<?xml version="1.0" encoding="utf-8"?>
<DOCUMENT>
<DOCUMENT-NAME ACODE="11011">사업보고서</DOCUMENT-NAME>
<COMPANY-NAME AREGCIK="00000001">예시전자</COMPANY-NAME>
<SUMMARY><EXTRACTION ACODE="X">요약 영역은 읽지 않음</EXTRACTION></SUMMARY>
<BODY>
<COVER>
<COVER-TITLE>사 업 보 고 서</COVER-TITLE>
<TABLE><TBODY><TR><TD>회사명</TD><TD>예시전자 주식회사</TD></TR></TBODY></TABLE>
</COVER>
<SECTION-1 ACLASS="MANDATORY">
<TITLE ATOC="Y" AASSOCNOTE="D-0-1-0-0">I. 회사의 개요</TITLE>
<SECTION-2>
<TITLE ATOC="Y" AASSOCNOTE="D-0-1-1-0">1. 회사의 개요</TITLE>
<P>당사는 R&D 투자를 늘렸습니다.&nbsp;연구 &amp; 개발</P>
<P>  </P>
<TABLE BORDER="1">
<COLGROUP><COL WIDTH="100"/></COLGROUP>
<THEAD><TR><TH COLSPAN="2">구분</TH><TH>금액</TH></TR></THEAD>
<TBODY>
<TR><TD ROWSPAN="2">매출</TD><TD>국내</TD><TE ALIGN="RIGHT">1,000</TE></TR>
<TR><TD>해외</TD><TE>2,000</TE></TR>
<TR><TU>(단위: 백만원)</TU></TR>
</TBODY>
</TABLE>
</SECTION-2>
</SECTION-1>
<SECTION-1>
<TITLE ATOC="Y" AASSOCNOTE="D-0-2-0-0">II. 사업의 내용</TITLE>
<P>반도체 사업을 합니다.<BR/>두 번째 줄입니다.</P>
<SPAN>문단 밖에 있는 글</SPAN>
<IMAGE><IMG SRC="a.jpg"/><P>그림 설명은 읽지 않음</P></IMAGE>
<PGBRK/>
<TABLE-GROUP ACLASS="BS">
<TITLE ATOC="N">연결 재무상태표</TITLE>
<TABLE><TBODY><TR><TD>자산</TD><TD>100</TD></TR></TBODY></TABLE>
</TABLE-GROUP>
<SECTION-2>
<TITLE>2. 주요 제품</TITLE>
<P>메모리</P>
</SECTION-2>
</SECTION-1>
</BODY>
</DOCUMENT>
"""


def make_zip(files: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    return buffer.getvalue()


def test_sections_follow_section_tags_and_first_title() -> None:
    document = structure_xml(RCEPT, SAMPLE.encode("utf-8"))

    assert document.status == STRUCTURED, document.warnings
    assert document.parser_version == PARSER_VERSION
    assert document.document_name == "사업보고서"
    assert document.company_name == "예시전자"
    titles = [(s.section_no, s.parent_no, s.level, s.title) for s in document.sections]
    assert titles == [
        (1, None, 1, "사 업 보 고 서"),
        (2, None, 1, "I. 회사의 개요"),
        (3, 2, 2, "1. 회사의 개요"),
        (4, None, 1, "II. 사업의 내용"),
        (5, 4, 2, "2. 주요 제품"),
    ]
    assert document.sections[0].cover
    assert document.sections[1].ref == "D-0-1-0-0"


def test_paragraphs_keep_text_and_repair_only_bare_ampersands() -> None:
    document = structure_xml(RCEPT, SAMPLE.encode("utf-8"))

    first = document.sections[2].blocks[0]
    assert first.type == PARAGRAPH
    assert first.text == "당사는 R&D 투자를 늘렸습니다. 연구 & 개발"
    assert document.counts["repairedAmpersands"] == 1
    business = [b.text for b in document.sections[3].blocks]
    assert business[0] == "반도체 사업을 합니다. 두 번째 줄입니다."
    assert "문단 밖에 있는 글" in business
    assert "연결 재무상태표" in business
    assert all("그림 설명" not in text for text in business)


def test_tables_keep_every_cell_with_spans() -> None:
    document = structure_xml(RCEPT, SAMPLE.encode("utf-8"))

    table = document.sections[2].blocks[1]
    assert table.type == TABLE
    assert table.rows is not None
    assert [[c.text for c in row] for row in table.rows] == [
        ["구분", "금액"],
        ["매출", "국내", "1,000"],
        ["해외", "2,000"],
        ["(단위: 백만원)"],
    ]
    assert table.rows[0][0].header and table.rows[0][0].colspan == 2
    assert table.rows[1][0].rowspan == 2
    assert table.text.splitlines()[1] == "매출 | 국내 | 1,000"
    assert document.counts["cells"] == document.counts["sourceCells"] == 12


def test_block_numbers_follow_document_order() -> None:
    document = structure_xml(RCEPT, SAMPLE.encode("utf-8"))

    numbers = [b.block_no for b in document.blocks]
    assert numbers == list(range(1, len(numbers) + 1))
    assert all(b.section_no == s.section_no for s in document.sections for b in s.blocks)


def test_cp949_document_is_decoded() -> None:
    xml = SAMPLE.replace('encoding="utf-8"', 'encoding="euc-kr"').encode("cp949")

    document = structure_xml(RCEPT, xml)

    assert document.encoding == "euc-kr"
    assert document.sections[1].title == "I. 회사의 개요"


def test_undeclared_cp949_falls_back() -> None:
    xml = SAMPLE.replace('<?xml version="1.0" encoding="utf-8"?>\n', "").encode("cp949")

    document = structure_xml(RCEPT, xml)

    assert document.encoding == "cp949"
    assert document.status == STRUCTURED


def test_zip_picks_main_file_and_lists_attachments() -> None:
    data = make_zip(
        {
            f"{RCEPT}_00760.xml": b"<DOCUMENT><BODY></BODY></DOCUMENT>",
            f"{RCEPT}.xml": SAMPLE.encode("utf-8"),
        }
    )

    document = structure_zip(RCEPT, data)

    assert document.main_file == f"{RCEPT}.xml"
    assert document.attachments == [f"{RCEPT}_00760.xml"]
    assert document.status == STRUCTURED


def test_not_a_zip_fails_with_reason() -> None:
    document = structure_zip(RCEPT, b"<result><status>014</status></result>")

    assert document.status == FAILED
    assert document.failure_code == "INVALID_ZIP"


def test_zip_without_main_file_fails() -> None:
    data = make_zip({"a_00760.xml": b"<x/>", "b_00761.xml": b"<x/>"})

    document = structure_zip(RCEPT, data)

    assert document.status == FAILED
    assert document.failure_code == "MAIN_FILE_NOT_FOUND"


def test_document_without_sections_is_unsupported() -> None:
    document = structure_xml(RCEPT, b"<DOCUMENT><BODY><P>only text</P></BODY></DOCUMENT>")

    assert document.status == FAILED
    assert document.failure_code == "UNSUPPORTED_FORMAT"


def test_missing_cells_make_the_result_partial() -> None:
    xml = SAMPLE.replace("<PGBRK/>", "<IMAGE><TD>표 밖 셀</TD></IMAGE>")

    document = structure_xml(RCEPT, xml.encode("utf-8"))

    assert document.status == PARTIAL
    assert [w.code for w in document.warnings] == ["CELL_COUNT_MISMATCH"]


def test_unclosed_tags_do_not_drop_following_sections() -> None:
    xml = SAMPLE.replace("<P>메모리</P>", "<P>메모리")

    document = structure_xml(RCEPT, xml.encode("utf-8"))

    assert document.sections[-1].blocks[0].text == "메모리"
    assert document.status == STRUCTURED


def test_title_with_nested_tags_is_read_as_text() -> None:
    xml = SAMPLE.replace(">II. 사업의 내용<", "><SPAN>II.</SPAN> 사업의 내용<")

    document = structure_xml(RCEPT, xml.encode("utf-8"))

    assert document.sections[3].title == "II. 사업의 내용"


def test_document_without_body_tag_is_read_whole_with_warning() -> None:
    xml = SAMPLE.replace("<BODY>", "").replace("</BODY>", "")

    document = structure_xml(RCEPT, xml.encode("utf-8"))

    assert document.status == STRUCTURED
    assert "NO_BODY_TAG" in [w.code for w in document.warnings]
    assert document.sections[1].title == "I. 회사의 개요"

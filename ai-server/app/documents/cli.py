"""원문 ZIP 하나를 구조화해 기대값(섹션·문단·표·셀 수)을 출력한다. 실제 원문 검증 기록용.

사용: python -m app.documents.cli <접수번호> <ZIP 경로>
"""

import json
import sys
from pathlib import Path

from app.documents.parser import PARSER_VERSION, structure_zip


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    rcept_no, path = argv
    document = structure_zip(rcept_no, Path(path).read_bytes())
    counts = {
        "rceptNo": rcept_no,
        "parserVersion": PARSER_VERSION,
        "status": document.status,
        "failureCode": document.failure_code,
        "documentName": document.document_name,
        "counts": document.counts,
        "warnings": [w.code for w in document.warnings],
    }
    print(json.dumps(counts, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

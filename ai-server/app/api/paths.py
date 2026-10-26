"""AI 서버 라우터 경로(docs/api-spec.md 3장).

backend의 AiServerPaths와 짝이 맞아야 하므로, 경로를 바꾸면 두 곳을 같은 PR에서 고친다.
"""

HEALTH = "/health"

INTERNAL_PREFIX = "/internal"
INTERNAL_HEALTH = "/health"
SUMMARIES = "/summaries"
ANSWERS = "/answers"
BRIEFINGS = "/briefings"
TEXT_CHANGES = "/text-changes"

DOCUMENTS_PREFIX = f"{INTERNAL_PREFIX}/documents"
DOCUMENT_PARSER = "/parser"
DOCUMENT_STRUCTURE = "/{rcept_no}/structure"

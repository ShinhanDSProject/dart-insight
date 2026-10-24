"""LLM이 쓴 문장의 숫자·크기 표현이 인용한 자료에 있는지 확인한다(요약 3.2·질문 답변 3.10).

LLM에 계산을 맡기지 않으므로(AGENTS.md), 결과 문장의 숫자는 인용한 원문·사실 문장에
그대로 있어야 한다. 결과가 달라지게 바꾸면 이 함수를 쓰는 기능의 PROMPT_VERSION을 올린다.
"""

from __future__ import annotations

import re

_NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")
# 숫자 없이 크기를 말하는 표현(두 배, 절반)과 단위가 붙은 수(1조, 500억).
# 원문에 같은 표현이 있어야 쓸 수 있다
_MAGNITUDE = re.compile(
    r"(?:\d+(?:\.\d+)?|[한두세네다섯여섯일곱여덟아홉열몇수]+)\s*배"
    r"(?=로|가|나|만큼|이상|이하|\s|$|[.,!?)])"
    r"|절반|\d+\s*분의\s*\d+"
    r"|\d[\d,]*(?:\.\d+)?\s*(?:조|억|만|천)"
)
_SQUEEZE = re.compile(r"[\s,]")


def numbers(text: str) -> set[str]:
    return {n.replace(",", "").rstrip(".") for n in _NUMBER.findall(text)}


def number_problem(text: str, sources: dict[str, str], cited: list[str]) -> str | None:
    """숫자와 크기 표현이 인용한 자료(sources 중 cited)에 그대로 있는지.

    LLM이 계산하거나 바꿔 쓴 숫자를 막는다. 문제가 있으면 LLM에 알려 줄 문장, 없으면 None.
    """
    joined = " ".join(sources[c] for c in cited if c in sources)
    extra = numbers(text) - numbers(joined)
    if extra:
        return f"인용한 원문에 없는 숫자가 있습니다: {sorted(extra)[:3]}"
    squeezed = _SQUEEZE.sub("", joined)
    missing = [
        m.group(0)
        for m in _MAGNITUDE.finditer(text)
        if _SQUEEZE.sub("", m.group(0)) not in squeezed
    ]
    if missing:
        return f"인용한 원문에 없는 크기 표현이 있습니다: {missing[:3]}. 원문 표현을 그대로 쓰세요."
    return None

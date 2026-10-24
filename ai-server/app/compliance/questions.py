"""투자 판단을 묻는 질문 거르기(3.10, ADR-0019).

매수·매도, 목표주가, 주가 전망, 종목 추천, 가치 판단을 묻는 질문은 공시로 답할 수 없고
투자 조언이 되므로 LLM에 보내지 않고 '답할 수 없는 질문(OUT_OF_SCOPE)'으로 끝낸다.

공시에 흔한 말(자기주식 매도 계획, 주식매수선택권, 투자 계획, 주가 변동 위험)을 묻는 질문은
막지 않도록 권유·예측을 묻는 꼴만 잡는다. 결과가 달라지게 바꾸면 질문 답변의
PROMPT_VERSION(app/answer/prompt.py)을 올린다.
"""

from __future__ import annotations

import re

from app.compliance.expressions import Finding, Rule

OUT_OF_SCOPE_QUESTION = "OUT_OF_SCOPE_QUESTION"

# 앞에 한글이 붙지 않은 낱말('회사야'의 '사야'를 잡지 않게)
_WORD = r"(?<![가-힣])"
# 앞으로 오르내릴지 묻는 꼴. 이미 일어난 일('주가가 하락한 이유')은 잡지 않는다
_PRICE_MOVES = (
    r"(?:오를|오르[나니겠]|올라갈|내릴|내려갈|떨어질|떨어지[나니겠]|"
    r"상승할|상승하[나니겠]|하락할|하락하[나니겠]|반등할|반등하[나니겠])"
)

RULE = Rule(
    OUT_OF_SCOPE_QUESTION,
    "투자 판단 질문",
    tuple(
        re.compile(p)
        for p in (
            # 매수·매도를 해야 하는지
            r"(?:매수|매도)\s*(?:를|을)?\s*"
            r"(?:해야|할까|해도|하는\s*게|하기\s*좋|할\s*때|타이밍|시점|적기|추천|의견)",
            _WORD + r"(?:사야|팔아야)\s*(?:하나|할까|해요|합니까|하는지|할지|되나|돼|될까)",
            _WORD + r"(?:살까|팔까|사도\s*(?:될|돼|괜찮)|팔아도\s*(?:될|돼|괜찮))",
            _WORD + r"(?:사는|파는)\s*게\s*(?:좋|나|맞)",
            r"(?:손절|익절|물타기|추격\s*매수|저점\s*매수)",
            # 투자해도 되는지
            r"투자\s*(?:를|을)?\s*(?:해도|할까|할\s*만|하기\s*좋|추천|적기|가치가?\s*있)",
            # 목표주가
            r"(?:목표|적정)\s*(?:주가|가격)",
            r"목표가",
            # 주가·주식 전망
            r"(?:주가|주식|종목)[^.?!\n]{0,12}?" + _PRICE_MOVES,
            r"주가\s*(?:의|는|가)?\s*(?:전망|예측|예상|어떻게\s*될)",
            # 종목 추천·가치 판단
            r"(?:종목|주식)\s*(?:을|를)?\s*추천",
            _WORD + r"(?:저|고)\s*평가(?:인가|일까|됐|되어|돼)",
        )
    ),
)


def scan_question(question: str | None) -> list[Finding]:
    """투자 판단을 묻는 질문이면 걸린 곳 하나, 아니면 빈 목록."""
    if not question:
        return []
    for pattern in RULE.patterns:
        match = pattern.search(question)
        if match:
            return [Finding(RULE.id, RULE.label, match.group(0))]
    return []

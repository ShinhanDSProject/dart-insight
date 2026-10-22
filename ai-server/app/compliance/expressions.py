"""투자 권유성 표현 자동 검사(5.5).

AI가 만든 문장(요약·설명)을 화면에 내보내기 전에 검사한다.
걸린 문장은 내보내지 않고 '검토 필요'로 남긴다.
공시 원문과 코드가 만든 수치 문장은 검사 대상이 아니다
(원문은 자료이고, 수치 문장은 중립 표현만 쓴다).

규칙은 결정 로그 '투자 권유성 금지 표현 기준'이 정해지기 전의 잠정안(expr-1)이다.
공시에 흔히 나오는 말(자기주식 매도, 매출 비중 확대, 주가 변동 위험, 투자 기회 모색 등)은
막지 않도록 권유·예측의 꼴만 잡는다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

RULESET_VERSION = "expr-1"


@dataclass(frozen=True)
class Rule:
    id: str
    label: str
    patterns: tuple[re.Pattern[str], ...]


@dataclass(frozen=True)
class Finding:
    rule_id: str
    label: str
    matched: str


def _rule(rule_id: str, label: str, *patterns: str) -> Rule:
    return Rule(rule_id, label, tuple(re.compile(p) for p in patterns))


RULES: tuple[Rule, ...] = (
    _rule(
        "TRADE_RECOMMENDATION",
        "매수·매도 권유",
        r"(매수|매도)\s*(를|을)?\s*(하세요|하십시오|하라|해라|해야|할\s*것|권(유|장|합|해)|추천|의견|타이밍|적기)",
        r"(사세요|파세요|사야\s*(합|한다|할)|팔아야\s*(합|한다|할)|담으세요|담아야|손절|익절|물타기)",
        r"(추격|저점|분할)\s*매수",
        r"(투자|보유|포트폴리오)\s*비중\s*(을|를)?\s*(확대|축소|늘리|줄이)",
        r"(종목\s*추천|추천\s*종목|강력\s*추천)",
    ),
    _rule(
        "INVESTMENT_ADVICE",
        "투자 권유",
        r"투자\s*(를|을)?\s*(하세요|하십시오|하라|해야|할\s*만|권(유|장|합|해)|추천|적기)",
        r"(지금이|지금은)\s*(살|팔|투자할)\s*때",
    ),
    _rule(
        "TARGET_PRICE",
        "목표주가",
        r"(목표|적정)\s*주가",
        r"목표가(?!격)",
    ),
    _rule(
        "PRICE_FORECAST",
        "주가 예측",
        r"주가[^.!?\n]{0,15}?(오를|오르겠|올라갈|상승할|상승하겠|하락할|하락하겠|떨어질|떨어지겠|반등할|반등하겠)",
        r"주가\s*(의)?\s*(전망|예측|예상)",
        r"(상한가|하한가)",
    ),
    _rule(
        "VALUE_JUDGMENT",
        "가치 판단",
        r"(저평가|고평가)",
        r"투자\s*매력",
        r"매력적인\s*(투자|종목|주식|가격|밸류)",
        r"(유망\s*(종목|주)|유망주|수혜주|대장주|호재|악재)",
    ),
    _rule(
        "RETURN_GUARANTEE",
        "수익 보장",
        r"(수익|원금)\s*(을|이)?\s*(보장|확실)",
        r"확실한\s*수익",
        r"(무조건|반드시)\s*(오|상승|수익)",
    ),
)


def scan(text: str | None) -> list[Finding]:
    """걸린 규칙(규칙마다 처음 걸린 곳 하나). 없으면 빈 목록."""
    if not text:
        return []
    findings: list[Finding] = []
    for rule in RULES:
        for pattern in rule.patterns:
            match = pattern.search(text)
            if match:
                findings.append(Finding(rule.id, rule.label, match.group(0)))
                break
    return findings

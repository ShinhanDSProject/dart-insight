"""재무 설명 후보 검색(ADR-0032). backend가 보낸 현재 보고서 문단에서 계정 검색어로 후보를 고른다.

- 후보 조건: 공백을 뺀 글에 검색어가 하나 이상 그대로 들어 있고, 공백을 뺀 길이가 20자 이상인 문단.
  목차 제목처럼 짧은 줄과 검색어가 없는 문단은 후보가 아니다.
- 순위: 공백을 뺀 글을 글자 2개 단위로 나눠 Okapi BM25로 점수를 매기고 섹션 가중치를 곱한다.
  점수가 같으면 문서 순서(보낸 순서)가 앞선 것. 상위 CANDIDATE_LIMIT개를 등급 판정에 넘긴다.
- 색인은 요청마다 받은 문단으로 만들고 저장하지 않는다.
  같은 입력이면 같은 후보가 같은 순서로 나온다.

결과가 달라지게 바꾸면 backend Analysis.CURRENT_VERSION을 함께 올린다.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import replace

from app.summary.model import Source

CANDIDATE_LIMIT = 5
MIN_CHARS = 20
MAX_SOURCE_CHARS = 1500
K1 = 1.5
B = 0.75
# (섹션 경로에 들어 있는 말, 가중치). 잠정값이며 #147에서 조정한다
SECTION_WEIGHTS: list[tuple[str, float]] = [("경영진단", 1.5), ("사업의내용", 1.3)]

_SPACES = re.compile(r"\s+")


def compact(text: str) -> str:
    return _SPACES.sub("", text)


def bigrams(text: str) -> list[str]:
    """공백을 뺀 글의 글자 2개 단위. 한 글자면 그 글자 하나"""
    if len(text) < 2:
        return [text] if text else []
    return [text[i : i + 2] for i in range(len(text) - 1)]


def section_weight(section_path: str) -> float:
    path = compact(section_path)
    return max((w for word, w in SECTION_WEIGHTS if word in path), default=1.0)


class Index:
    """보고서 문단의 BM25 색인. 문단마다 글자 2개 단위 빈도와 전체 문서 빈도를 둔다."""

    def __init__(self, blocks: list[Source]) -> None:
        self.blocks = blocks
        self.texts = [compact(b.text) for b in blocks]
        self.counts = [Counter(bigrams(t)) for t in self.texts]
        self.lengths = [sum(c.values()) for c in self.counts]
        self.average = sum(self.lengths) / len(self.lengths) if self.lengths else 0.0
        self.document_frequency: Counter[str] = Counter()
        for counts in self.counts:
            self.document_frequency.update(counts.keys())

    def _idf(self, gram: str) -> float:
        n = len(self.blocks)
        df = self.document_frequency.get(gram, 0)
        return math.log(1 + (n - df + 0.5) / (df + 0.5))

    def _bm25(self, position: int, grams: list[str]) -> float:
        counts = self.counts[position]
        norm = K1 * (1 - B + B * self.lengths[position] / self.average) if self.average else K1
        score = 0.0
        for gram in grams:
            tf = counts.get(gram, 0)
            if tf:
                score += self._idf(gram) * tf * (K1 + 1) / (tf + norm)
        return score

    def candidates(self, aliases: list[str], limit: int = CANDIDATE_LIMIT) -> list[Source]:
        """검색어가 든 20자 이상 문단을 점수 높은 순(같으면 문서 순서)으로 limit개"""
        terms = [t for t in (compact(a) for a in aliases) if t]
        if not terms:
            return []
        grams = sorted({g for t in terms for g in bigrams(t)})
        scored = [
            (self._bm25(i, grams) * section_weight(block.section_path), i)
            for i, block in enumerate(self.blocks)
            if len(self.texts[i]) >= MIN_CHARS and any(t in self.texts[i] for t in terms)
        ]
        scored.sort(key=lambda s: (-s[0], s[1]))
        return [_trimmed(self.blocks[i]) for _, i in scored[:limit]]


def _trimmed(block: Source) -> Source:
    if len(block.text) <= MAX_SOURCE_CHARS:
        return block
    return replace(block, text=block.text[:MAX_SOURCE_CHARS])

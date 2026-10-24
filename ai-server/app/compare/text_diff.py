"""본문·표 변경 탐지(2.5). 구조화된 두 원문(4.2)을 비교해
추가·삭제·수정·숫자만 바뀜·위치 이동을 찾는다.

1. 섹션 짝짓기
   - 제목에서 번호(I., 1., 가., (1) 등)·공백·기호를 뺀 이름을 상위 섹션부터 이은 경로로 짝짓는다.
   - 경로가 같은 섹션이 양쪽에 같은 수만큼 있으면 순서대로 짝짓는다.
     수가 다르면 짝을 확정하지 않고 검토 필요로 남긴다.
   - 경로가 없으면 같은 상위 섹션 안에서 제목이 비슷한(0.8 이상) 섹션을 짝짓는다(같으면 문서 순서).
   - 상위 섹션 이름이 크게 바뀌어 짝이 없으면, 그 아래 섹션을 자기 제목으로 짝짓고
     (양쪽에 하나씩일 때), 하위 섹션이 절반 넘게 짝지어진 상위 섹션끼리도 짝짓는다(이름 바뀜).
2. 블록 짝짓기
   - 짝지은 섹션 안의 문단·표를 숫자를 가린 글로 맞춰 본다(숫자만 바뀐 표도 같은 자리로).
   - 맞춘 자리의 글이 숫자만 다르면 숫자만 바뀜(NUMERIC_UPDATE), 그 밖에 다르면 수정,
     한쪽에만 있으면 추가·삭제다.
   - 맞지 않는 구간은 글이 비슷한(0.5 이상) 블록끼리 수정(숫자만 다르면 숫자만 바뀜)으로 짝짓고,
     나머지는 추가·삭제다.
     긴 글은 낱말 단위로 비교하고, 구간 하나에서 비교하는 횟수에 상한을 둬
     표가 많은 섹션도 빨리 끝난다.
3. 짝이 없는 섹션의 블록은 섹션째 추가·삭제다.
   문서상 빠졌다는 뜻일 뿐 사업·계약 종료로 해석하지 않는다.
4. 위치 이동(#150): 문서 전체의 삭제·추가 중 블록 종류가 같고 숫자를 가린 글이 같거나
   MOVED_SIMILAR 이상 비슷한 것을 한 쌍씩 위치 이동(MOVED) 하나로 바꾼다.
   같은 섹션 안에서 순서만 바뀐 것과 다른 섹션으로 옮긴 것을 모두 포함한다.
   - 숫자를 가린 글이 MOVED_MIN_CHARS보다 짧으면('해당사항 없음' 같은 상투 문구) 짝짓지 않는다.
   - 같은 글끼리 먼저 짝짓고, 나머지는 이전 문서 순서대로 가장 비슷한 것과 짝짓는다
     (점수가 같으면 현재 문서 순서가 앞선 것). 비슷한 정도는 낱말 수가 비교 상한 안인 글만 잰다
     (앞부분만 같은 긴 표가 이동으로 잡히지 않게). 비교 횟수에 상한을 둔다.
   - 비슷하기만 한 짝은 다른 부분이 모두 띄어쓰기·문장부호일 때만 이동으로 본다
     (글자·낱말·기호·숫자 자리가 하나라도 다르면 내용 변경이라 추가·삭제로 남긴다.
     예: '(단위 : 주, %)' → '(단위 : 원, %)').
   - 이동의 섹션 정보는 현재 쪽이고, 이전 쪽 섹션 경로는 previous_section_path에 남는다.

결과는 원문 위치(섹션 번호·블록 번호)만 돌려준다. 글은 backend가 저장된 원문에서 붙인다.
"""

from __future__ import annotations

import re
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from difflib import SequenceMatcher

# 결과가 달라지게 바꾸면 이 버전과 backend Analysis.CURRENT_VERSION을 함께 올린다
DIFF_VERSION = "text-diff-2"

ADDED = "ADDED"
DELETED = "DELETED"
MODIFIED = "MODIFIED"
NUMERIC_UPDATE = "NUMERIC_UPDATE"
MOVED = "MOVED"
REVIEW_NEEDED = "REVIEW_NEEDED"

# 섹션 짝짓기 결과
MATCHED = "MATCHED"
RENAMED = "RENAMED"
SECTION_ADDED = "ADDED"
SECTION_DELETED = "DELETED"
AMBIGUOUS = "AMBIGUOUS"

SECTION_BLOCK = "SECTION"

_TITLE_SIMILAR = 0.8
_BLOCK_SIMILAR = 0.5
# 두 글의 길이 합이 이보다 길면 글자 대신 낱말 단위로 비교한다(긴 표에서 글자 비교는 느림)
_CHAR_COMPARE_LIMIT = 800
_COMPARE_TOKENS = 300
# 맞지 않는 구간에서 짝을 찾을 때 앞으로 볼 블록 수와, 구간 하나에서 글을 비교하는 최대 횟수
_PAIR_WINDOW = 30
_PAIR_BUDGET = 300
# 위치 이동: 숫자를 가린 두 글이 이만큼(0~1) 비슷하면 같은 글을 옮긴 것으로 본다(경계 포함)
MOVED_SIMILAR = 0.95
# 위치 이동: 숫자를 가린 글이 이보다 짧으면 짝짓지 않는다(어디에나 있는 짧은 문구)
MOVED_MIN_CHARS = 20
# 위치 이동: 문서 하나에서 비슷한 정도를 재는 최대 횟수(넘으면 나머지는 추가·삭제로 둔다)
_MOVED_BUDGET = 20000

_NUMBERING = re.compile(
    r"^\s*(?:"
    r"(?:[IVXLCDM]+|[ⅰ-ⅻⅠ-Ⅻ]+)\s*[.)]"  # I. II) Ⅱ.
    r"|\(?\d+(?:-\d+)*\)?\s*[.)]?"  # 1. 1) (1) 1-1.
    r"|\(?[가-힣A-Za-z]\)\s*"  # 가) (가) a)
    r"|[가-하A-Za-z]\.\s*"  # 가. a.
    r"|[①-⑳㉠-㉭㉮-㉻]"  # ① ㉠
    r"|제\s*\d+\s*[장절관조항]"  # 제1장
    r")\s*"
)
_NOT_WORD = re.compile(r"[^0-9A-Za-z가-힣]+")
_NUMBER = re.compile(r"[-+]?\d[\d,]*(?:\.\d+)?")
_SPACE = re.compile(r"\s+")
_TOKEN = re.compile(r"\S+")
# 위치 이동에서 달라도 되는 글: 띄어쓰기와 문장부호만(숫자 자리 '#'·기호·글자는 내용으로 본다)
_FORMATTING_ONLY = re.compile(r"[\s.,·:;!?'\"()\[\]{}<>|/\\\-–—~…「」『』“”‘’]*")


@dataclass(frozen=True)
class SectionIn:
    section_no: int
    parent_no: int | None
    level: int
    title: str
    cover: bool = False


@dataclass(frozen=True)
class BlockIn:
    block_no: int
    section_no: int
    type: str
    text: str


@dataclass
class DocumentIn:
    rcept_no: str
    sections: list[SectionIn]
    blocks: list[BlockIn]


@dataclass(frozen=True)
class Position:
    section_no: int
    block_no: int | None = None


@dataclass
class Change:
    change_type: str
    block_type: str
    section_status: str
    section_title: str
    section_path: str
    previous: Position | None
    current: Position | None
    numbers_only: bool = False
    similarity: float | None = None
    review_reason: str | None = None
    # 위치 이동일 때 이전 보고서 쪽 섹션 경로. 그 밖은 None
    previous_section_path: str | None = None
    order: tuple[int, int, int] = field(default=(0, 0, 0), compare=False)


@dataclass
class DiffResult:
    changes: list[Change]
    section_counts: dict[str, int]
    diff_version: str = DIFF_VERSION


# ── 정규화 ──────────────────────────────────────────────────


def title_key(title: str) -> str:
    """제목에서 번호·공백·기호를 뺀 이름. 예: 'II. 사업의 내용' → '사업의내용'"""
    text = title.strip()
    for _ in range(3):  # '1. 가. 제목'처럼 번호가 겹친 경우
        stripped = _NUMBERING.sub("", text, count=1)
        if stripped == text or not stripped:
            break
        text = stripped
    return _NOT_WORD.sub("", text).lower()


def mask_numbers(text: str) -> str:
    return _NUMBER.sub("#", _SPACE.sub(" ", text).strip())


def similarity(a: str, b: str, floor: float = _BLOCK_SIMILAR) -> float:
    """두 글이 비슷한 정도(0~1). 짧은 글은 글자 단위, 긴 글은 낱말 단위로 비교한다.

    floor에 못 미치는 것이 빠른 어림으로 확실하면 정확히 재지 않고 그 어림(floor 미만)을 돌려준다.
    """
    if len(a) + len(b) <= _CHAR_COMPARE_LIMIT:
        matcher = SequenceMatcher(None, a, b, autojunk=False)
    else:
        matcher = SequenceMatcher(
            None,
            _TOKEN.findall(a)[:_COMPARE_TOKENS],
            _TOKEN.findall(b)[:_COMPARE_TOKENS],
            autojunk=False,
        )
    if matcher.real_quick_ratio() < floor or matcher.quick_ratio() < floor:
        return matcher.quick_ratio()
    return matcher.ratio()


# ── 섹션 짝짓기 ─────────────────────────────────────────────


class _Tree:
    def __init__(self, document: DocumentIn) -> None:
        self.sections = {s.section_no: s for s in document.sections}
        self.order = [s.section_no for s in document.sections]
        self.index = {no: i for i, no in enumerate(self.order)}
        self.blocks: dict[int, list[BlockIn]] = defaultdict(list)
        for block in sorted(document.blocks, key=lambda b: b.block_no):
            self.blocks[block.section_no].append(block)
        self._path_cache: dict[int, tuple[str, ...]] = {}

    def ancestors(self, section_no: int) -> list[int]:
        """자기부터 최상위까지. 상위 번호가 돌아서 이어져도(잘못된 입력) 멈춘다."""
        chain: list[int] = []
        current: int | None = section_no
        while current is not None and current in self.sections and current not in chain:
            chain.append(current)
            current = self.sections[current].parent_no
        return chain

    def key_path(self, section_no: int) -> tuple[str, ...]:
        if section_no not in self._path_cache:
            keys = []
            for no in reversed(self.ancestors(section_no)):
                section = self.sections[no]
                if section.cover:
                    keys.append("__cover__")
                elif section.level == 0:
                    keys.append("__outside__")
                else:
                    keys.append(title_key(section.title) or f"__untitled__{section.section_no}")
            self._path_cache[section_no] = tuple(keys)
        return self._path_cache[section_no]

    def title_path(self, section_no: int) -> str:
        return " > ".join(self.sections[no].title for no in reversed(self.ancestors(section_no)))


def match_sections(
    previous: _Tree, current: _Tree
) -> tuple[dict[int, int], dict[int, str], set[int], set[int]]:
    """(이전→현재 짝, 짝의 상태, 짝을 정하지 못한 이전 섹션, 짝을 정하지 못한 현재 섹션)"""
    pairs: dict[int, int] = {}
    status: dict[int, str] = {}
    ambiguous_prev: set[int] = set()
    ambiguous_cur: set[int] = set()

    by_path_prev: dict[tuple[str, ...], list[int]] = defaultdict(list)
    by_path_cur: dict[tuple[str, ...], list[int]] = defaultdict(list)
    for no in previous.order:
        by_path_prev[previous.key_path(no)].append(no)
    for no in current.order:
        by_path_cur[current.key_path(no)].append(no)

    for path, prev_nos in by_path_prev.items():
        cur_nos = by_path_cur.get(path, [])
        if not cur_nos:
            continue
        if len(prev_nos) == len(cur_nos):
            for p, c in zip(prev_nos, cur_nos, strict=True):
                pairs[p] = c
                status[p] = MATCHED
        else:
            ambiguous_prev.update(prev_nos)
            ambiguous_cur.update(cur_nos)

    # 이름이 조금 바뀐 섹션: 짝지은 상위 섹션 안(또는 둘 다 최상위)에서 제목이 비슷한 것
    matched_cur = set(pairs.values())
    for p in previous.order:
        if p in pairs or p in ambiguous_prev:
            continue
        p_section = previous.sections[p]
        parent_target = pairs.get(p_section.parent_no) if p_section.parent_no else None
        if p_section.parent_no and parent_target is None:
            continue
        best, best_score = None, _TITLE_SIMILAR
        for c in current.order:
            if c in matched_cur or c in ambiguous_cur:
                continue
            c_section = current.sections[c]
            if c_section.parent_no != parent_target or c_section.level != p_section.level:
                continue
            score = SequenceMatcher(
                None, title_key(p_section.title), title_key(c_section.title)
            ).ratio()
            if best is None and score >= best_score or score > best_score:
                best, best_score = c, score  # 점수가 같으면 문서 순서가 앞선 것
        if best is not None:
            pairs[p] = best
            status[p] = RENAMED
            matched_cur.add(best)

    _match_under_renamed_parents(previous, current, pairs, status, ambiguous_prev, ambiguous_cur)
    return pairs, status, ambiguous_prev, ambiguous_cur


def _match_under_renamed_parents(
    previous: _Tree,
    current: _Tree,
    pairs: dict[int, int],
    status: dict[int, str],
    ambiguous_prev: set[int],
    ambiguous_cur: set[int],
) -> None:
    """상위 섹션 이름이 크게 바뀌어(0.8 미만) 짝이 없을 때,
    하위 섹션까지 통째로 추가·삭제로 보이지 않게 한다.

    1. 상위 섹션이 짝이 없는 섹션끼리 자기 제목·깊이가 같고 양쪽에 하나씩이면 짝짓는다.
    2. 하위 섹션이 절반 넘게 서로 짝지어진 상위 섹션끼리 짝짓는다.
    """

    def free_prev(no: int) -> bool:
        return no not in pairs and no not in ambiguous_prev

    matched_cur = set(pairs.values())

    def free_cur(no: int) -> bool:
        return no not in matched_cur and no not in ambiguous_cur

    def orphan(tree: _Tree, no: int, free: Callable[[int], bool]) -> bool:
        parent = tree.sections[no].parent_no
        return parent is not None and parent in tree.sections and free(parent)

    def own_key(tree: _Tree, no: int) -> tuple[int, str]:
        return tree.sections[no].level, tree.key_path(no)[-1]

    prev_by_key: dict[tuple[int, str], list[int]] = defaultdict(list)
    cur_by_key: dict[tuple[int, str], list[int]] = defaultdict(list)
    for p in previous.order:
        if free_prev(p) and orphan(previous, p, free_prev):
            prev_by_key[own_key(previous, p)].append(p)
    for c in current.order:
        if free_cur(c) and orphan(current, c, free_cur):
            cur_by_key[own_key(current, c)].append(c)
    for key, prev_nos in prev_by_key.items():
        cur_nos = cur_by_key.get(key, [])
        if len(prev_nos) == 1 and len(cur_nos) == 1:
            pairs[prev_nos[0]] = cur_nos[0]
            status[prev_nos[0]] = RENAMED
            matched_cur.add(cur_nos[0])

    children_prev: dict[int, list[int]] = defaultdict(list)
    for p in previous.order:
        parent = previous.sections[p].parent_no
        if parent is not None:
            children_prev[parent].append(p)
    for p in previous.order:
        kids = children_prev.get(p, [])
        if not free_prev(p) or not kids:
            continue
        targets = [current.sections[pairs[k]].parent_no for k in kids if k in pairs]
        if len(targets) * 2 <= len(kids):
            continue
        target = max(set(targets), key=targets.count)
        if target is not None and target in current.sections and free_cur(target):
            pairs[p] = target
            status[p] = RENAMED
            matched_cur.add(target)


# ── 블록 비교 ───────────────────────────────────────────────


def _diff_blocks(
    prev: list[BlockIn], cur: list[BlockIn]
) -> list[tuple[str, BlockIn | None, BlockIn | None, float | None]]:
    """(종류, 이전 블록, 현재 블록, 유사도) 목록. 같은 블록은 넣지 않는다."""
    prev_keys = [f"{b.type}:{mask_numbers(b.text)}" for b in prev]
    cur_keys = [f"{b.type}:{mask_numbers(b.text)}" for b in cur]
    result: list[tuple[str, BlockIn | None, BlockIn | None, float | None]] = []
    matcher = SequenceMatcher(None, prev_keys, cur_keys, autojunk=False)
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for a, b in zip(prev[i1:i2], cur[j1:j2], strict=True):
                if _norm(a.text) != _norm(b.text):
                    result.append((MODIFIED, a, b, round(similarity(a.text, b.text), 4)))
        elif tag == "delete":
            result.extend((DELETED, a, None, None) for a in prev[i1:i2])
        elif tag == "insert":
            result.extend((ADDED, None, b, None) for b in cur[j1:j2])
        else:
            result.extend(_pair_similar(prev[i1:i2], cur[j1:j2]))
    return result


def _pair_similar(
    prev: list[BlockIn], cur: list[BlockIn]
) -> list[tuple[str, BlockIn | None, BlockIn | None, float | None]]:
    """서로 맞지 않는 구간에서 순서를 지키며 비슷한 블록끼리 수정으로 짝짓는다."""
    result: list[tuple[str, BlockIn | None, BlockIn | None, float | None]] = []
    j = 0
    budget = _PAIR_BUDGET
    for a in prev:
        best, best_score = None, _BLOCK_SIMILAR
        for k in range(j, min(len(cur), j + _PAIR_WINDOW)):
            if cur[k].type != a.type:
                continue
            if budget <= 0:
                # 상한을 넘으면 나머지는 추가·삭제로 둔다(오래 걸려 비교 전체가 실패하지 않게)
                break
            budget -= 1
            score = similarity(a.text, cur[k].text)
            if score >= best_score:
                best, best_score = k, score
                if score >= 0.95:
                    break
        if best is None:
            result.append((DELETED, a, None, None))
            continue
        result.extend((ADDED, None, b, None) for b in cur[j:best])
        result.append((MODIFIED, a, cur[best], round(best_score, 4)))
        j = best + 1
    result.extend((ADDED, None, b, None) for b in cur[j:])
    return result


def _norm(text: str) -> str:
    return _SPACE.sub(" ", text).strip()


# ── 위치 이동 ───────────────────────────────────────────────


def formatting_only_differs(a: str, b: str) -> bool:
    """두 글(숫자를 가린 글)의 다른 부분이 모두 띄어쓰기·문장부호뿐인지(글자 단위 비교)."""
    matcher = SequenceMatcher(None, a, b, autojunk=False)
    return all(
        _FORMATTING_ONLY.fullmatch(a[i1:i2]) and _FORMATTING_ONLY.fullmatch(b[j1:j2])
        for tag, i1, i2, j1, j2 in matcher.get_opcodes()
        if tag != "equal"
    )


def _pair_moves(
    changes: list[Change], previous: dict[int, BlockIn], current: dict[int, BlockIn]
) -> list[Change]:
    """삭제·추가 중 같은 글(숫자를 가린 글이 같거나 매우 비슷한 것)을 위치 이동 하나로 바꾼다."""
    deleted: list[tuple[Change, BlockIn, str]] = []
    added: list[tuple[Change, BlockIn, str]] = []
    for change in changes:
        if change.change_type == DELETED and change.previous and change.previous.block_no:
            block = previous.get(change.previous.block_no)
            if block is not None:
                deleted.append((change, block, mask_numbers(block.text)))
        elif change.change_type == ADDED and change.current and change.current.block_no:
            block = current.get(change.current.block_no)
            if block is not None:
                added.append((change, block, mask_numbers(block.text)))
    deleted = [d for d in deleted if len(d[2]) >= MOVED_MIN_CHARS]
    added = [a for a in added if len(a[2]) >= MOVED_MIN_CHARS]
    if not deleted or not added:
        return changes
    deleted.sort(key=lambda d: d[1].block_no)  # 이전 문서 순서
    added.sort(key=lambda a: a[1].block_no)  # 현재 문서 순서

    pairs: list[tuple[int, int]] = []
    used: set[int] = set()
    # 1. 숫자를 가린 글이 같은 것
    by_key: dict[tuple[str, str], list[int]] = defaultdict(list)
    for j, (_, block, masked) in enumerate(added):
        by_key[(block.type, masked)].append(j)
    left: list[int] = []
    for i, (_, block, masked) in enumerate(deleted):
        candidates = by_key.get((block.type, masked))
        if candidates:
            j = candidates.pop(0)
            pairs.append((i, j))
            used.add(j)
        else:
            left.append(i)

    # 2. 매우 비슷한 것. 낱말 수가 비교 상한 안인 글만(앞부분만 같은 긴 글을 이동으로 보지 않게)
    def comparable(masked: str) -> bool:
        return len(_TOKEN.findall(masked)) <= _COMPARE_TOKENS

    budget = _MOVED_BUDGET
    for i in left:
        _, d_block, d_masked = deleted[i]
        if budget <= 0:
            break
        if not comparable(d_masked):
            continue
        best, best_score = None, MOVED_SIMILAR
        for j, (_, a_block, a_masked) in enumerate(added):
            if j in used or a_block.type != d_block.type:
                continue
            short, long_ = sorted((len(d_masked), len(a_masked)))
            if 2 * short / (short + long_) < MOVED_SIMILAR or not comparable(a_masked):
                continue  # 길이만으로도 기준에 못 미침
            if budget <= 0:
                break
            budget -= 1
            score = similarity(d_masked, a_masked, MOVED_SIMILAR)
            if score < best_score or not formatting_only_differs(d_masked, a_masked):
                continue
            if score > best_score or best is None:
                best, best_score = j, score
        if best is not None:
            pairs.append((i, best))
            used.add(best)

    if not pairs:
        return changes
    paired: set[int] = set()
    moves: list[Change] = []
    for i, j in pairs:
        d_change, d_block, _ = deleted[i]
        a_change, a_block, _ = added[j]
        paired.add(id(d_change))
        paired.add(id(a_change))
        moves.append(
            Change(
                MOVED,
                a_change.block_type,
                a_change.section_status,
                a_change.section_title,
                a_change.section_path,
                d_change.previous,
                a_change.current,
                similarity=round(similarity(d_block.text, a_block.text), 4),
                previous_section_path=d_change.section_path,
                order=a_change.order,
            )
        )
    return [c for c in changes if id(c) not in paired] + moves


# ── 전체 비교 ───────────────────────────────────────────────


def diff_documents(previous_doc: DocumentIn, current_doc: DocumentIn) -> DiffResult:
    previous, current = _Tree(previous_doc), _Tree(current_doc)
    pairs, pair_status, ambiguous_prev, ambiguous_cur = match_sections(previous, current)
    reverse = {c: p for p, c in pairs.items()}
    changes: list[Change] = []

    # 이전 섹션을 현재 문서 순서에 끼워 넣을 자리: 앞쪽에서 가장 가까운 짝지은 섹션 뒤
    anchor: dict[int, int] = {}
    last = -1
    for p in previous.order:
        if p in pairs:
            last = current.index[pairs[p]]
        anchor[p] = last

    for c in current.order:
        c_index = current.index[c]
        title_path = current.title_path(c)
        title = current.sections[c].title
        if c in reverse:
            p = reverse[c]
            diffs = _diff_blocks(previous.blocks[p], current.blocks[c])
            for seq, (kind, a, b, score) in enumerate(diffs):
                block = b or a
                assert block is not None
                numbers_only = bool(a and b and mask_numbers(a.text) == mask_numbers(b.text))
                changes.append(
                    Change(
                        change_type=NUMERIC_UPDATE if kind == MODIFIED and numbers_only else kind,
                        block_type=block.type,
                        section_status=pair_status[p],
                        section_title=title,
                        section_path=title_path,
                        previous=Position(p, a.block_no) if a else None,
                        current=Position(c, b.block_no) if b else None,
                        numbers_only=numbers_only,
                        similarity=score,
                        order=(c_index, 0, seq),
                    )
                )
        elif c in ambiguous_cur:
            continue  # 아래에서 검토 필요로 한 번에 남긴다
        else:
            for b in current.blocks[c]:
                changes.append(
                    Change(
                        ADDED,
                        b.type,
                        SECTION_ADDED,
                        title,
                        title_path,
                        None,
                        Position(c, b.block_no),
                        order=(c_index, 0, b.block_no),
                    )
                )

    for p in previous.order:
        if p in pairs or p in ambiguous_prev:
            continue
        title_path = previous.title_path(p)
        for a in previous.blocks[p]:
            changes.append(
                Change(
                    DELETED,
                    a.type,
                    SECTION_DELETED,
                    previous.sections[p].title,
                    title_path,
                    Position(p, a.block_no),
                    None,
                    order=(anchor[p], 1, a.block_no),
                )
            )

    changes = _pair_moves(
        changes,
        {b.block_no: b for b in previous_doc.blocks},
        {b.block_no: b for b in current_doc.blocks},
    )

    # 짝을 정하지 못한 섹션: 숨기지 않고 섹션 하나에 검토 필요 하나
    reason = (
        "두 보고서에 같은 이름의 항목 수가 달라 짝을 정하지 못했어요. 두 원문을 직접 확인해 주세요."
    )
    for c in current.order:
        if c in ambiguous_cur:
            changes.append(
                Change(
                    REVIEW_NEEDED,
                    SECTION_BLOCK,
                    AMBIGUOUS,
                    current.sections[c].title,
                    current.title_path(c),
                    None,
                    Position(c),
                    review_reason=reason,
                    order=(current.index[c], 0, 0),
                )
            )
    for p in previous.order:
        if p in ambiguous_prev:
            changes.append(
                Change(
                    REVIEW_NEEDED,
                    SECTION_BLOCK,
                    AMBIGUOUS,
                    previous.sections[p].title,
                    previous.title_path(p),
                    Position(p),
                    None,
                    review_reason=reason,
                    order=(anchor[p], 2, p),
                )
            )

    changes.sort(key=lambda ch: ch.order)
    counts = {
        "matched": sum(1 for s in pair_status.values() if s == MATCHED),
        "renamed": sum(1 for s in pair_status.values() if s == RENAMED),
        "added": sum(1 for c in current.order if c not in reverse and c not in ambiguous_cur),
        "deleted": sum(1 for p in previous.order if p not in pairs and p not in ambiguous_prev),
        "ambiguous": len(ambiguous_prev) + len(ambiguous_cur),
    }
    return DiffResult(changes, counts)

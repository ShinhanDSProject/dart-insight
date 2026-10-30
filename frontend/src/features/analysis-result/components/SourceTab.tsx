import { useEffect, useId, useLayoutEffect, useMemo, useReducer, useRef, useState, type RefObject } from 'react'
import { match } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import { firstContentSection, type DocumentOutline, type DocumentSide, type SectionContent, type SourceBlock } from '@/shared/api/documents'
import type { TextSectionCount } from '@/shared/api/textChanges'
import { Badge, Button, FieldLabel, Input, Notice, Panel, PanelTitle, SegmentedControl, Select } from '@/shared/ui'
import { DartLinkActions } from '@/shared/ui/DartLink'
import { verifiedDartUrl } from '@/shared/lib/dart'
import { correctionLabel, formatDate, periodLabel } from '@/shared/lib/reportLabels'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { SourceHighlightText, TableView } from './TableView'
import { useDocumentOutline, useSection } from '../hooks/useDocument'
import { useScrolledPast } from '../hooks/useScrolledPast'
import { formatCount } from '../model/overview'
import type { SourceViewChange } from '../model/resultParams'
import { sectionChangeCounts } from '../model/sectionChangeCounts'
import { splitParts } from '../model/sourceParts'
import {
  buildSectionOrigin,
  initialSourceSectionMatchState,
  matchOutlineSection,
  sourceSectionMatchReducer,
} from '../model/sourceSectionMatch'
import {
  EMPTY_SOURCE_SEARCH_RESULT,
  SOURCE_SEARCH_MAX_LENGTH,
  findSourceHits,
  initialSourceSearchState,
  parseSourceSearch,
  sourceSearchReducer,
  sourceSearchStatusLabel,
} from '../model/sourceSearch'
import { displaySectionPath, displaySectionTitle } from '@/shared/lib/sectionTitle'

interface SourceTabProps {
  analysis: Analysis
  side: DocumentSide
  /** 보여 줄 섹션. 없으면 글이 있는 첫 섹션 */
  sectionNo: number | null
  /** 강조할 근거 위치(블록 번호) */
  blockNo: number | null
  onChange: (changes: SourceViewChange) => void
  /** 최상위 섹션별 문장 변경 건수(요약 개요의 막대와 같은 문장 변화 응답의 sections). 못 불러오면 빈 목록 */
  sectionCounts: TextSectionCount[]
  /** 문장 변화 탭을 그 최상위 섹션(원래 제목)으로 거른다(#313) */
  onOpenTextSection: (section: string) => void
  /** '← 분석 결과로 돌아가기': 원문을 열기 전에 보던 탭으로 간다(#550) */
  onBack?: () => void
}

const USABLE = new Set(['STRUCTURED', 'PARTIAL'])

const sideOptions: { value: DocumentSide; label: string }[] = [
  { value: 'previous', label: '비교 보고서' },
  { value: 'current', label: '현재 보고서' },
]

/**
 * W-03 ④ 원문 확인(3.5). 비교·현재 보고서를 전환하며 목차와 선택한 근거 위치를 보여 준다.
 * 원문은 분석할 때 구조화한 것이고, DART 원문 안의 위치로 바로 가는 기능은 없어(위치 이동 미지원) 항목 정보를 함께 안내한다.
 */
export function SourceTab({ analysis, side, sectionNo, blockNo, onChange, sectionCounts, onOpenTextSection, onBack }: SourceTabProps) {
  const { state: outline, reload } = useDocumentOutline(analysis.analysisId, side)
  const changeCounts = useMemo(() => sectionChangeCounts(sectionCounts), [sectionCounts])
  const [matchState, dispatchMatch] = useReducer(sourceSectionMatchReducer, initialSourceSectionMatchState)

  const report = side === 'current' ? analysis.current : analysis.previous
  const currentOutline =
    outline.status === 'success' && outline.data.rceptNo === report.rceptNo ? outline.data : null

  useEffect(() => {
    if (matchState.status !== 'pending' || matchState.targetSide !== side || currentOutline === null) return
    const matched = matchOutlineSection(currentOutline.sections, matchState.origin)
    dispatchMatch({
      type: 'resolve-match',
      side,
      matched: matched !== null,
      label: matchState.origin.label,
    })
    if (matched !== null && matched !== sectionNo) {
      onChange({ section: matched, block: null })
    }
  }, [matchState, side, currentOutline, sectionNo, onChange])

  const switchSide = (next: DocumentSide) => {
    if (next === side) return
    const activeSectionNo = currentOutline ? (sectionNo ?? firstContentSection(currentOutline.sections)) : sectionNo
    const origin = currentOutline ? buildSectionOrigin(currentOutline.sections, activeSectionNo) : null
    if (origin !== null) {
      dispatchMatch({ type: 'request-match', targetSide: next, origin })
    } else {
      dispatchMatch({ type: 'clear-match' })
    }
    onChange({ side: next, section: null, block: null })
  }

  return (
    <Panel aria-label="원문">
      {/* 원문 뷰어 머리(#550, 시안 13): 제목 | 돌아가기 → 보고서 이름 줄과 '주된 근거' 배지 */}
      <div className="source-head">
        <div className="source-head__main">
          <PanelTitle>관련 원문 위치</PanelTitle>
          <p className="panel__note">
            {blockNo !== null ? '분석 결과에서 고른 근거 위치를 강조해 보여 줘요.' : '목차에서 항목을 골라 원문을 읽어요.'}
          </p>
        </div>
        {onBack && (
          <Button onClick={onBack}>
            <span aria-hidden="true">←</span> 분석 결과로 돌아가기
          </Button>
        )}
      </div>
      <div className="source-report">
        <div className="source-report__main">
          <p className="source-report__name">{report.reportName}</p>
          <p className="panel__note">
            {analysis.corpName} · 대상 기간 {periodLabel(report)} · 제출일 {formatDate(report.receivedAt)} · 정정 여부{' '}
            {correctionLabel(report.correction)} · 접수번호 <code>{report.rceptNo}</code>
          </p>
        </div>
        <div className="source-report__aside">
          {blockNo !== null && <Badge tone="accent">주된 근거</Badge>}
          <SegmentedControl aria-label="보고서" options={sideOptions} value={side} onChange={switchSide} />
        </div>
      </div>

      {match(outline)
        .with({ status: 'loading' }, () => <LoadingState message="원문 목차를 불러오는 중입니다…" />)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} />)
        .with({ status: 'success' }, ({ data }) => {
          if (data.rceptNo !== report.rceptNo) {
            // 근거가 이 화면의 보고서 쌍과 맞는지 확인한다. 다르면 원문을 보여 주지 않는다
            return (
              <Notice tone="attention" role="alert">
                이 분석의 보고서(접수번호 {report.rceptNo})와 다른 원문이 와서 보여 주지 않아요. 새로고침해 주세요.
              </Notice>
            )
          }
          const pendingMatched =
            matchState.status === 'pending' && matchState.targetSide === side
              ? matchOutlineSection(data.sections, matchState.origin)
              : null
          const unmatchedLabel =
            matchState.status === 'unmatched' && matchState.side === side && blockNo === null
              ? matchState.label
              : null
          return (
            <SourceBody
              analysis={analysis}
              outline={data}
              sectionNo={sectionNo ?? pendingMatched ?? firstContentSection(data.sections)}
              blockNo={blockNo}
              unmatchedLabel={unmatchedLabel}
              onSelect={(section) => {
                dispatchMatch({ type: 'clear-match' })
                onChange({ section, block: null })
              }}
              changeCounts={changeCounts}
              onOpenTextSection={onOpenTextSection}
            />
          )
        })
        .exhaustive()}
    </Panel>
  )
}

interface SourceBodyProps {
  analysis: Analysis
  outline: DocumentOutline
  sectionNo: number | null
  blockNo: number | null
  unmatchedLabel: string | null
  onSelect: (sectionNo: number) => void
  changeCounts: Map<string, number>
  onOpenTextSection: (section: string) => void
}

function SourceBody({
  analysis,
  outline,
  sectionNo,
  blockNo,
  unmatchedLabel,
  onSelect,
  changeCounts,
  onOpenTextSection,
}: SourceBodyProps) {
  if (!USABLE.has(outline.documentStatus)) {
    return (
      <>
        <Notice tone="attention" role="status">
          앱 안에서 원문을 보여 줄 수 없어요. {outline.statusMessage}
        </Notice>
        <p className="panel__note">위치 이동 미지원 · DART 원문을 열어 직접 확인해 주세요.</p>
        <DartLinkActions rceptNo={outline.rceptNo} dartUrl={outline.dartUrl} />
      </>
    )
  }
  return (
    <>
      {outline.documentStatus === 'PARTIAL' && (
        <Notice tone="attention" role="status">
          {outline.statusMessage}
        </Notice>
      )}
      {unmatchedLabel !== null && (
        <Notice as="p" tone="info" role="status">
          선택한 &apos;{unmatchedLabel}&apos; 항목은 이 보고서에서 찾지 못해 첫 항목을 열었어요.
        </Notice>
      )}
      <div className="source-layout">
        <nav className="source-toc" aria-label="문서 목차">
          <PanelTitle as="h3">문서 목차</PanelTitle>
          <ul>
            {outline.sections.map((section) => {
              // 변경 건수는 최상위 섹션에만 있고, 원래 제목으로 맞춘다(표시 이름으로 맞추지 않음)
              const changes = section.depth === 1 ? (changeCounts.get(section.title) ?? 0) : 0
              const label = displaySectionTitle(section.title)
              return (
                <li key={section.sectionNo} className="source-toc__row">
                  <button
                    type="button"
                    className="source-toc__item"
                    style={{ paddingLeft: `calc(var(--space-2) + ${Math.max(0, section.depth - 1)} * var(--space-3))` }}
                    aria-current={section.sectionNo === sectionNo ? 'location' : undefined}
                    onClick={() => onSelect(section.sectionNo)}
                  >
                    {label}
                  </button>
                  {/* 목차 항목 버튼과 나란한 형제 버튼(UI-4: 버튼 안에 버튼을 두지 않는다) */}
                  {changes > 0 && (
                    <Button
                      variant="link"
                      className="source-toc__changes"
                      aria-label={`${label} 문장 변경 ${formatCount(changes)}건 보기`}
                      onClick={() => onOpenTextSection(section.title)}
                    >
                      <Badge tone="accent">변경 {formatCount(changes)}</Badge>
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>
        {sectionNo === null ? (
          <p className="panel__note">원문에 목차가 없어요.</p>
        ) : (
          <SectionView key={`${outline.rceptNo}-${sectionNo}`} analysis={analysis} outline={outline} sectionNo={sectionNo} blockNo={blockNo} />
        )}
      </div>
    </>
  )
}

interface SectionViewProps {
  analysis: Analysis
  outline: DocumentOutline
  sectionNo: number
  blockNo: number | null
}

function SectionView({ analysis, outline, sectionNo, blockNo }: SectionViewProps) {
  const { state, reload } = useSection(analysis.analysisId, outline.side, sectionNo)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // 근거 위치에서 왔으면 그 블록으로 화면과 초점을 옮긴다(블록이 없으면 항목 제목으로). 키보드·화면 읽기 사용자가
  // 다른 탭에서 넘어와도 어디를 보고 있는지 알 수 있게 한다
  useEffect(() => {
    if (state.status !== 'success' || blockNo === null) return
    const target = document.getElementById(blockId(blockNo)) ?? headingRef.current
    target?.focus({ preventScroll: true })
    target?.scrollIntoView?.({ block: 'center' })
  }, [state.status, blockNo])

  return match(state)
    .with({ status: 'loading' }, () => <LoadingState message="원문을 불러오는 중입니다…" />)
    .with({ status: 'error' }, ({ error }) => (
      <ErrorState
        error={error}
        onRetry={reload}
        messages={{ REPORT_SECTION_NOT_FOUND: '원문에서 이 항목을 찾지 못했어요. 목차에서 다시 골라 주세요.' }}
      />
    ))
    .with({ status: 'success' }, ({ data }) => (
      <SectionBlocks outline={outline} data={data} blockNo={blockNo} headingRef={headingRef} />
    ))
    .exhaustive()
}

interface SectionBlocksProps {
  outline: DocumentOutline
  data: SectionContent
  blockNo: number | null
  headingRef: RefObject<HTMLHeadingElement | null>
}

/** 이보다 높은 블록(표 안에 표가 든 긴 표 등)은 처음에 이 높이까지만 보이고 '표 전체 보기'로 펼친다(#396) */
const TALL_BLOCK_PX = 600
/** 이만큼 내려가면 '맨 위로'를 보인다 */
const BACK_TO_TOP_PX = 1200

function SectionBlocks({ outline, data, blockNo, headingRef }: SectionBlocksProps) {
  const searchInputId = useId()
  const dartUrl = verifiedDartUrl(outline.rceptNo, outline.dartUrl)
  const highlighted = blockNo !== null && data.blocks.some((b) => b.blockNo === blockNo)
  // 긴 항목은 소제목별로 하나씩 보인다(#396). 근거 위치에서 왔으면 그 블록이 든 소제목을 연다
  const parts = useMemo(() => splitParts(data.blocks), [data.blocks])
  const [viewState, dispatchView] = useReducer(sourceSearchReducer, undefined, () =>
    initialSourceSearchState(parts, blockNo),
  )
  useEffect(() => dispatchView({ type: 'sync-anchor', parts, blockNo }), [parts, blockNo])

  const queryState = useMemo(() => parseSourceSearch(viewState.input), [viewState.input])
  const activeQuery = queryState.status === 'ready' ? queryState.query : null
  const searchResult = useMemo(
    () => (activeQuery !== null ? findSourceHits(parts, activeQuery) : EMPTY_SOURCE_SEARCH_RESULT),
    [parts, activeQuery],
  )
  const hitBlockNos = useMemo(() => new Set(searchResult.blocks.map((b) => b.blockNo)), [searchResult.blocks])
  const activeHitBlock =
    searchResult.blocks.length > 0
      ? searchResult.blocks[Math.min(viewState.activeHitIndex, searchResult.blocks.length - 1)]
      : null
  const statusLabel = sourceSearchStatusLabel(queryState, searchResult, viewState.activeHitIndex)

  const split = parts.length > 1
  const partIndex = Math.min(viewState.partIndex, parts.length - 1)
  const part = parts[partIndex]
  const showPart = (index: number) => dispatchView({ type: 'select-part', partIndex: index })

  useEffect(() => {
    if (viewState.navSeq === 0) return
    if (viewState.navTarget === 'heading') {
      headingRef.current?.focus({ preventScroll: true })
      headingRef.current?.scrollIntoView?.({ block: 'start' })
      return
    }
    if (viewState.navTarget === 'hit' && activeHitBlock !== null) {
      document.getElementById(blockId(activeHitBlock.blockNo))?.scrollIntoView?.({ block: 'center' })
    }
  }, [viewState.navSeq, viewState.navTarget, activeHitBlock, headingRef])

  const scrolled = useScrolledPast(BACK_TO_TOP_PX)

  return (
    <article className="source-section" aria-label={displaySectionPath(data.sectionPath)}>
      <h3 className="source-section__title" ref={headingRef} tabIndex={-1}>
        {displaySectionPath(data.sectionPath)}
      </h3>
      {blockNo !== null && outline.restructuredAfterAnalysis && (
        <Notice as="p" tone="attention" role="status">
          분석이 끝난 뒤 원문을 다시 읽어 근거 위치가 달라졌을 수 있어요. 강조한 곳의 글이 근거와 같은지 확인해 주세요.
        </Notice>
      )}
      {blockNo !== null && !highlighted && (
        <Notice as="p" tone="attention" role="status">
          선택한 근거 위치를 이 항목에서 찾지 못했어요. 원문을 다시 읽어 위치가 달라졌을 수 있어요.
        </Notice>
      )}
      {data.blocks.length === 0 && <p className="panel__note">이 항목에는 바로 속한 문단·표가 없어요. 하위 항목을 골라 주세요.</p>}
      {data.blocks.length > 0 && (
        <div className="source-search">
          <div className="source-search__field">
            <FieldLabel htmlFor={searchInputId}>이 항목 안에서 찾기</FieldLabel>
            <Input
              id={searchInputId}
              type="search"
              value={viewState.input}
              maxLength={SOURCE_SEARCH_MAX_LENGTH}
              placeholder="계정명이나 찾을 단어 (2자 이상)"
              onChange={(e) => dispatchView({ type: 'set-query', input: e.target.value, parts })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchResult.blocks.length > 0) {
                  e.preventDefault()
                  dispatchView({
                    type: 'step-hit',
                    delta: e.shiftKey ? -1 : 1,
                    blocks: searchResult.blocks,
                  })
                }
              }}
            />
          </div>
          <div className="source-search__controls">
            {statusLabel !== null && (
              <span className="source-search__status" role="status" aria-live="polite">
                {statusLabel}
              </span>
            )}
            <Button
              variant="secondary"
              disabled={searchResult.blocks.length === 0}
              aria-label="이전 일치 위치"
              onClick={() => dispatchView({ type: 'step-hit', delta: -1, blocks: searchResult.blocks })}
            >
              이전
            </Button>
            <Button
              variant="secondary"
              disabled={searchResult.blocks.length === 0}
              aria-label="다음 일치 위치"
              onClick={() => dispatchView({ type: 'step-hit', delta: 1, blocks: searchResult.blocks })}
            >
              다음
            </Button>
            {viewState.input.length > 0 && (
              <Button variant="link" onClick={() => dispatchView({ type: 'clear-query' })}>
                지우기
              </Button>
            )}
          </div>
        </div>
      )}
      {split && (
        <div className="source-parts">
          <FieldLabel htmlFor="source-part">소제목</FieldLabel>
          <Select id="source-part" value={partIndex} onChange={(e) => showPart(Number(e.target.value))}>
            {parts.map((p, index) => (
              <option key={p.blocks[0].blockNo} value={index}>
                {p.title}
              </option>
            ))}
          </Select>
          <span className="source-parts__count">
            {partIndex + 1} / {parts.length}
          </span>
        </div>
      )}
      {part.blocks.map((block) => (
        <SourceBlockView
          key={block.blockNo}
          block={block}
          selected={block.blockNo === blockNo}
          hasSearchHit={hitBlockNos.has(block.blockNo)}
          activeHit={activeHitBlock?.blockNo === block.blockNo}
          highlightQuery={activeQuery}
          caption={`${data.sectionPath} 표`}
        />
      ))}
      {split && (
        <nav className="source-parts__nav" aria-label="소제목 넘기기">
          <Button variant="secondary" disabled={partIndex === 0} onClick={() => showPart(partIndex - 1)}>
            ← 이전 소제목{partIndex > 0 && <span className="source-parts__next-title">{parts[partIndex - 1].title}</span>}
          </Button>
          <Button variant="secondary" disabled={partIndex === parts.length - 1} onClick={() => showPart(partIndex + 1)}>
            다음 소제목 →
            {partIndex < parts.length - 1 && <span className="source-parts__next-title">{parts[partIndex + 1].title}</span>}
          </Button>
        </nav>
      )}
      <Notice className="source-foot" title={`출처: DART / ${outline.reportName}`}>
        <span>
          접수번호 <code>{outline.rceptNo}</code> · 앱 안의 원문은 분석할 때 구조화한 것이에요.{' '}
        </span>
        {dartUrl ? (
          <a href={dartUrl} target="_blank" rel="noopener noreferrer">
            DART 원문에서 열기 <span aria-hidden="true">↗</span>
            <span className="visually-hidden">(새 창)</span>
          </a>
        ) : (
          <span>원문 링크를 확인하지 못했어요. DART에서 접수번호로 검색해 주세요.</span>
        )}
      </Notice>
      {!outline.positionLinkSupported && (
        <p className="panel__note">
          위치 이동 미지원 · DART 원문 안의 이 위치로 바로 가지는 못해요. DART 원문을 열고 목차에서 '{data.sectionPath}'를 찾아 주세요.
        </p>
      )}
      {scrolled && (
        <Button
          variant="secondary"
          className="source-top"
          onClick={() => {
            const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
            headingRef.current?.focus({ preventScroll: true })
            headingRef.current?.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
          }}
        >
          ↑ 맨 위로
        </Button>
      )}
    </article>
  )
}

/**
 * 원문 블록 하나. 아주 높은 블록은 처음에 TALL_BLOCK_PX까지만 보이고 '표 전체 보기'로 펼친다(#396).
 * 근거로 고른 블록이나 검색어가 든 블록은 접지 않는다.
 */
function expandLabel(block: SourceBlock): string {
  return block.table ? '표 전체 보기' : '전체 보기'
}

interface SourceBlockViewProps {
  block: SourceBlock
  selected: boolean
  hasSearchHit: boolean
  activeHit: boolean
  highlightQuery: string | null
  caption: string
}

function sourceBlockLabel(selected: boolean, activeHit: boolean): string | null {
  return match([selected, activeHit] as const)
    .with([true, true], () => '선택한 근거 위치 · 찾은 위치')
    .with([true, false], () => '선택한 근거 위치')
    .with([false, true], () => '찾은 위치')
    .with([false, false], () => null)
    .exhaustive()
}

function SourceBlockView({ block, selected, hasSearchHit, activeHit, highlightQuery, caption }: SourceBlockViewProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [tall, setTall] = useState(false)
  const [open, setOpen] = useState(false)
  useLayoutEffect(() => {
    setTall((bodyRef.current?.scrollHeight ?? 0) > TALL_BLOCK_PX)
  }, [block])
  const collapsed = tall && !open && !selected && !hasSearchHit
  const bodyId = `${blockId(block.blockNo)}-body`
  const blockLabel = sourceBlockLabel(selected, activeHit)

  return (
    <div
      id={blockId(block.blockNo)}
      className={`source-block${selected ? ' source-block--selected' : ''}${activeHit && !selected ? ' source-block--search-active' : ''}`}
      tabIndex={selected || activeHit ? -1 : undefined}
    >
      {blockLabel !== null && <span className="source-block__label">{blockLabel}</span>}
      <div ref={bodyRef} id={bodyId} className={collapsed ? 'source-block__body source-block__body--collapsed' : 'source-block__body'}>
        {block.table ? (
          <TableView rows={block.table} caption={caption} highlightQuery={highlightQuery} />
        ) : (
          <p className="source-block__text">
            <SourceHighlightText text={block.text} query={highlightQuery} />
          </p>
        )}
      </div>
      {tall && !selected && !hasSearchHit && (
        <Button variant="link" className="source-block__toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((v) => !v)}>
          {open ? '접기' : expandLabel(block)}
        </Button>
      )}
    </div>
  )
}

function blockId(blockNo: number): string {
  return `source-block-${blockNo}`
}

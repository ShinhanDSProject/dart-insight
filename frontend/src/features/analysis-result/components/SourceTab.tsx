import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { match } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import { firstContentSection, type DocumentOutline, type DocumentSide, type SectionContent } from '@/shared/api/documents'
import type { TextSectionCount } from '@/shared/api/textChanges'
import { Badge, Button, Notice, Panel, PanelTitle, SegmentedControl } from '@/shared/ui'
import { DartLinkActions } from '@/shared/ui/DartLink'
import { verifiedDartUrl } from '@/shared/lib/dart'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { TableView } from './TableView'
import { useDocumentOutline, useSection } from '../hooks/useDocument'
import { formatCount } from '../model/overview'
import type { SourceViewChange } from '../model/resultParams'
import { sectionChangeCounts } from '../model/sectionChangeCounts'
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
export function SourceTab({ analysis, side, sectionNo, blockNo, onChange, sectionCounts, onOpenTextSection }: SourceTabProps) {
  const { state: outline, reload } = useDocumentOutline(analysis.analysisId, side)
  const changeCounts = useMemo(() => sectionChangeCounts(sectionCounts), [sectionCounts])

  const report = side === 'current' ? analysis.current : analysis.previous

  return (
    <Panel aria-label="원문 확인">
      <div className="source-head">
        <SegmentedControl
          aria-label="보고서"
          options={sideOptions}
          value={side}
          onChange={(next) => {
            if (next !== side) onChange({ side: next, section: null, block: null })
          }}
        />
        <p className="source-head__report">
          {report.reportName} · 접수번호 <code>{report.rceptNo}</code>
        </p>
      </div>

      {match(outline)
        .with({ status: 'loading' }, () => <LoadingState message="원문 목차를 불러오는 중입니다…" />)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} />)
        .with({ status: 'success' }, ({ data }) =>
          data.rceptNo !== report.rceptNo ? (
            // 근거가 이 화면의 보고서 쌍과 맞는지 확인한다. 다르면 원문을 보여 주지 않는다
            <Notice tone="attention" role="alert">
              이 분석의 보고서(접수번호 {report.rceptNo})와 다른 원문이 와서 보여 주지 않아요. 새로고침해 주세요.
            </Notice>
          ) : (
            <SourceBody
              analysis={analysis}
              outline={data}
              sectionNo={sectionNo ?? firstContentSection(data.sections)}
              blockNo={blockNo}
              onSelect={(section) => onChange({ section, block: null })}
              changeCounts={changeCounts}
              onOpenTextSection={onOpenTextSection}
            />
          ),
        )
        .exhaustive()}
    </Panel>
  )
}

interface SourceBodyProps {
  analysis: Analysis
  outline: DocumentOutline
  sectionNo: number | null
  blockNo: number | null
  onSelect: (sectionNo: number) => void
  changeCounts: Map<string, number>
  onOpenTextSection: (section: string) => void
}

function SourceBody({ analysis, outline, sectionNo, blockNo, onSelect, changeCounts, onOpenTextSection }: SourceBodyProps) {
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

function SectionBlocks({ outline, data, blockNo, headingRef }: SectionBlocksProps) {
  const dartUrl = verifiedDartUrl(outline.rceptNo, outline.dartUrl)
  const highlighted = blockNo !== null && data.blocks.some((b) => b.blockNo === blockNo)
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
      {data.blocks.map((block) => {
        const selected = block.blockNo === blockNo
        return (
          <div
            key={block.blockNo}
            id={blockId(block.blockNo)}
            className={`source-block${selected ? ' source-block--selected' : ''}`}
            tabIndex={selected ? -1 : undefined}
          >
            {selected && <span className="source-block__label">선택한 근거 위치</span>}
            {block.table ? (
              <TableView rows={block.table} caption={`${data.sectionPath} 표`} />
            ) : (
              <p className="source-block__text">{block.text}</p>
            )}
          </div>
        )
      })}
      <div className="source-foot">
        <span>
          출처 DART · {outline.reportName} · 접수번호 <code>{outline.rceptNo}</code>
        </span>
        {dartUrl ? (
          <a href={dartUrl} target="_blank" rel="noopener noreferrer">
            DART 원문에서 열기 <span aria-hidden="true">↗</span>
            <span className="visually-hidden">(새 창)</span>
          </a>
        ) : (
          <span>원문 링크를 확인하지 못했어요. DART에서 접수번호로 검색해 주세요.</span>
        )}
      </div>
      {!outline.positionLinkSupported && (
        <p className="panel__note">
          위치 이동 미지원 · DART 원문 안의 이 위치로 바로 가지는 못해요. DART 원문을 열고 목차에서 '{data.sectionPath}'를 찾아 주세요.
        </p>
      )}
    </article>
  )
}

function blockId(blockNo: number): string {
  return `source-block-${blockNo}`
}

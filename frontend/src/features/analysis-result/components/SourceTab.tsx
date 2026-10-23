import { useEffect, useRef, useState } from 'react'
import type { Analysis } from '@/shared/api/analyses'
import {
  firstContentSection,
  getDocumentOutline,
  getSection,
  type DocumentOutline,
  type DocumentSide,
  type SectionContent,
} from '@/shared/api/documents'
import { Notice, Panel, PanelTitle, SegmentedControl } from '@/shared/ui'
import { DartLinkActions } from '@/shared/ui/DartLink'
import { verifiedDartUrl } from '@/shared/lib/dart'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { TableView } from './TableView'

type Load<T> = { kind: 'loading' } | { kind: 'done'; data: T } | { kind: 'error'; error: unknown }

interface SourceTabProps {
  analysis: Analysis
  side: DocumentSide
  /** 보여 줄 섹션. 없으면 글이 있는 첫 섹션 */
  sectionNo: number | null
  /** 강조할 근거 위치(블록 번호) */
  blockNo: number | null
  onChange: (changes: { side?: DocumentSide; section?: number | null; block?: number | null }) => void
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
export function SourceTab({ analysis, side, sectionNo, blockNo, onChange }: SourceTabProps) {
  const [outline, setOutline] = useState<Load<DocumentOutline>>({ kind: 'loading' })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    setOutline({ kind: 'loading' })
    getDocumentOutline(analysis.analysisId, side)
      .then((data) => {
        if (!cancelled) setOutline({ kind: 'done', data })
      })
      .catch((error: unknown) => {
        if (!cancelled) setOutline({ kind: 'error', error })
      })
    return () => {
      cancelled = true
    }
  }, [analysis.analysisId, side, retry])

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

      {outline.kind === 'loading' && <LoadingState message="원문 목차를 불러오는 중입니다…" />}
      {outline.kind === 'error' && <ErrorState error={outline.error} onRetry={() => setRetry((n) => n + 1)} />}
      {outline.kind === 'done' && outline.data.rceptNo !== report.rceptNo && (
        // 근거가 이 화면의 보고서 쌍과 맞는지 확인한다. 다르면 원문을 보여 주지 않는다
        <Notice tone="attention" role="alert">
          이 분석의 보고서(접수번호 {report.rceptNo})와 다른 원문이 와서 보여 주지 않아요. 새로고침해 주세요.
        </Notice>
      )}
      {outline.kind === 'done' && outline.data.rceptNo === report.rceptNo && (
        <SourceBody
          analysis={analysis}
          outline={outline.data}
          sectionNo={sectionNo ?? firstContentSection(outline.data.sections)}
          blockNo={blockNo}
          onSelect={(section) => onChange({ section, block: null })}
        />
      )}
    </Panel>
  )
}

interface SourceBodyProps {
  analysis: Analysis
  outline: DocumentOutline
  sectionNo: number | null
  blockNo: number | null
  onSelect: (sectionNo: number) => void
}

function SourceBody({ analysis, outline, sectionNo, blockNo, onSelect }: SourceBodyProps) {
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
            {outline.sections.map((section) => (
              <li key={section.sectionNo}>
                <button
                  type="button"
                  className="source-toc__item"
                  style={{ paddingLeft: `calc(var(--space-2) + ${Math.max(0, section.depth - 1)} * var(--space-3))` }}
                  aria-current={section.sectionNo === sectionNo ? 'location' : undefined}
                  onClick={() => onSelect(section.sectionNo)}
                >
                  {section.title}
                </button>
              </li>
            ))}
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
  const [state, setState] = useState<Load<SectionContent>>({ kind: 'loading' })
  const [retry, setRetry] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    getSection(analysis.analysisId, outline.side, sectionNo)
      .then((data) => {
        if (!cancelled) setState({ kind: 'done', data })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: 'error', error })
      })
    return () => {
      cancelled = true
    }
  }, [analysis.analysisId, outline.side, sectionNo, retry])

  // 근거 위치에서 왔으면 그 블록으로 화면과 초점을 옮긴다(블록이 없으면 항목 제목으로). 키보드·화면 읽기 사용자가
  // 다른 탭에서 넘어와도 어디를 보고 있는지 알 수 있게 한다
  useEffect(() => {
    if (state.kind !== 'done' || blockNo === null) return
    const target = document.getElementById(blockId(blockNo)) ?? headingRef.current
    target?.focus({ preventScroll: true })
    target?.scrollIntoView?.({ block: 'center' })
  }, [state.kind, blockNo])

  if (state.kind === 'loading') return <LoadingState message="원문을 불러오는 중입니다…" />
  if (state.kind === 'error') {
    return (
      <ErrorState
        error={state.error}
        onRetry={() => setRetry((n) => n + 1)}
        messages={{ REPORT_SECTION_NOT_FOUND: '원문에서 이 항목을 찾지 못했어요. 목차에서 다시 골라 주세요.' }}
      />
    )
  }
  const { data } = state
  const dartUrl = verifiedDartUrl(outline.rceptNo, outline.dartUrl)
  const highlighted = blockNo !== null && data.blocks.some((b) => b.blockNo === blockNo)
  return (
    <article className="source-section" aria-label={data.sectionPath}>
      <h3 className="source-section__title" ref={headingRef} tabIndex={-1}>
        {data.sectionPath}
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

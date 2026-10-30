import { useReducer, type Dispatch } from 'react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import { exportNotes, type CompanyNote } from '@/shared/api/notes'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { basisLabel } from '@/shared/lib/comparisonBasis'
import { downloadTextFile } from '@/shared/lib/download'
import { formatInteger } from '@/shared/lib/numberFormat'
import { pageTitle } from '@/shared/lib/pageTitle'
import { formatDate } from '@/shared/lib/reportLabels'
import { Badge, Button, ButtonLink, Chip, FieldLabel, Input, Panel, PanelTitle } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { NoteItemCard } from './components/NoteItemCard'
import { useNotes, type NotesController } from './hooks/useNotes'
import {
  countNotes,
  filterCompanyNotes,
  INITIAL_NOTE_FILTER,
  isNoteFilterActive,
  NOTE_KIND_OPTIONS,
  noteFilterReducer,
  noteFilterSummary,
  type NoteCounts,
  type NoteFilter,
  type NoteFilterAction,
} from './model/noteFilter'
import {
  companyOverviewLink,
  disclosureGroupLabel,
  exportFileName,
  FOLLOWUP_NOTICE,
  hasCompanyFollowups,
  newerAnalysisLink,
} from './model/notes'
import './notes.css'

/**
 * 내 판단 노트(FS-57·#504). 분석 결과에서 담은 근거를 기업별로 모아 메모와 함께 다시 보고,
 * 근거 이후의 후속 분석·공시를 확인하며, 지우거나 출처와 함께 내보낸다.
 * 로그인한 회원만 쓴다. 노트 내용은 AI나 외부 API에 보내지 않는다.
 */
export function NotesPage() {
  useDocumentTitle(pageTitle(['내 판단 노트']))
  const notes = useNotes()
  const [filter, dispatchFilter] = useReducer(noteFilterReducer, INITIAL_NOTE_FILTER)

  return (
    <section className="page notes">
      <h1 className="page__title">내 판단 노트</h1>
      <p className="page__lead">
        분석 결과에서 담은 수치·문장을 기업별로 모았어요. 담을 때의 값과 출처가 함께 남고, 메모는 나만 볼 수 있어요.
      </p>
      {match(notes.state)
        .with({ status: 'anonymous' }, () => (
          <EmptyState title="로그인하면 판단 노트를 쓸 수 있어요">
            <p>분석 결과의 근거를 노트에 담고 메모를 남기려면 로그인해 주세요.</p>
            <ButtonLink variant="primary" to="/login">
              로그인하기
            </ButtonLink>
          </EmptyState>
        ))
        .with({ status: 'loading' }, () => <LoadingState message="판단 노트를 불러오는 중이에요…" />)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={notes.reload} />)
        .with({ status: 'success' }, ({ data }) =>
          data.companies.length === 0 ? (
            <EmptyState title="아직 담은 근거가 없어요">
              <p>분석 결과의 수치 근거나 문장 변경 카드에서 '노트에 담기'를 눌러 보세요.</p>
              <ButtonLink variant="secondary" to="/">
                기업 찾기
              </ButtonLink>
            </EmptyState>
          ) : (
            <NotesLoaded
              companies={data.companies}
              notes={notes}
              filter={filter}
              dispatchFilter={dispatchFilter}
            />
          ),
        )
        .exhaustive()}
    </section>
  )
}

interface NotesLoadedProps {
  companies: readonly CompanyNote[]
  notes: NotesController
  filter: NoteFilter
  dispatchFilter: Dispatch<NoteFilterAction>
}

function NotesLoaded({ companies, notes, filter, dispatchFilter }: NotesLoadedProps) {
  const counts = countNotes(companies)
  const active = isNoteFilterActive(filter)
  const filteredCompanies = filterCompanyNotes(companies, filter)
  const summary = noteFilterSummary(companies.length, counts.total, filteredCompanies, active)

  return (
    <>
      <NotesFilterBar
        filter={filter}
        counts={counts}
        showInlineReset={active && filteredCompanies.length > 0}
        summary={summary}
        dispatchFilter={dispatchFilter}
      />
      {filteredCompanies.length === 0 ? (
        <EmptyState title="조건에 맞는 노트가 없어요">
          <p>검색어나 유형·메모 거르기를 바꿔 보세요.</p>
          <Button variant="secondary" onClick={() => dispatchFilter({ type: 'reset' })}>
            필터 초기화
          </Button>
        </EmptyState>
      ) : (
        <div className="notes__companies">
          {filteredCompanies.map((company) => (
            <CompanyNotes key={company.corpCode} company={company} notes={notes} />
          ))}
        </div>
      )}
    </>
  )
}

interface NotesFilterBarProps {
  filter: NoteFilter
  counts: NoteCounts
  showInlineReset: boolean
  summary: string
  dispatchFilter: Dispatch<NoteFilterAction>
}

function NotesFilterBar({ filter, counts, showInlineReset, summary, dispatchFilter }: NotesFilterBarProps) {
  return (
    <div className="notes-filter" role="search" aria-label="내 판단 노트 거르기">
      <div className="notes-filter__search">
        <FieldLabel htmlFor="notes-search-input">노트 찾기</FieldLabel>
        <Input
          id="notes-search-input"
          type="search"
          value={filter.query}
          placeholder="기업명, 항목명, 본문, 질문, 메모, 접수번호로 찾기"
          onChange={(e) => dispatchFilter({ type: 'set-query', query: e.target.value })}
        />
      </div>
      <div className="notes-filter__chips-row">
        <div className="notes-filter__chips" role="group" aria-label="노트 유형">
          {NOTE_KIND_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              pressed={filter.kind === option.value}
              count={option.value === 'ALL' ? counts.total : counts.byKind[option.value]}
              onClick={() => dispatchFilter({ type: 'set-kind', kind: option.value })}
            >
              {option.label}
            </Chip>
          ))}
        </div>
        <Chip
          pressed={filter.memoOnly}
          count={counts.memo}
          onClick={() => dispatchFilter({ type: 'toggle-memo-only' })}
        >
          메모 있음
        </Chip>
      </div>
      <div className="notes-filter__summary">
        <span role="status">{summary}</span>
        {showInlineReset && (
          <Button variant="link" onClick={() => dispatchFilter({ type: 'reset' })}>
            필터 초기화
          </Button>
        )}
      </div>
    </div>
  )
}

function CompanyNotes({ company, notes }: { company: CompanyNote; notes: NotesController }) {
  const name = company.corpName ?? company.corpCode
  const titleId = `notes-company-${company.corpCode}`
  const followupsTitleId = `notes-followups-${company.corpCode}`
  const showFollowups = hasCompanyFollowups(company)
  const hasRelatedOnItems = company.items.some((item) => item.relatedDisclosures.length > 0)
  const exporting = useAsyncAction<void>()
  const download = () => {
    void exporting.run(async () => {
      const markdown = await exportNotes(company.corpCode)
      downloadTextFile(exportFileName(company.corpCode), markdown, 'text/markdown;charset=utf-8')
    })
  }
  return (
    <Panel as="section" className="notes__company" aria-labelledby={titleId}>
      <div className="notes__company-head">
        <PanelTitle id={titleId}>
          {name} <span className="notes__count">{formatInteger(company.items.length)}건</span>
        </PanelTitle>
        <div className="notes__company-actions">
          <ButtonLink variant="secondary" to={companyOverviewLink(company.corpCode)} aria-label={`${name} 기업 개요 보기`}>
            기업 개요 보기
          </ButtonLink>
          <Button
            variant="secondary"
            disabled={exporting.state.status === 'loading'}
            aria-label={`${name} 노트 내보내기`}
            onClick={download}
          >
            {exporting.state.status === 'loading' ? '내보내는 중…' : '내보내기'}
          </Button>
        </div>
      </div>
      {exporting.state.status === 'error' && <ErrorState error={exporting.state.error} />}
      {showFollowups && (
        <section className="notes__followups" aria-labelledby={followupsTitleId}>
          <h3 id={followupsTitleId} className="notes__followup-title">
            담은 보고서 이후 소식
          </h3>
          {company.newerAnalyses.length > 0 && (
            <div className="notes__followup-group">
              <span className="notes__followup-label">후속 정기보고서 분석</span>
              <ul className="notes__followup-list">
                {company.newerAnalyses.map((analysis) => (
                  <li key={analysis.analysisId} className="notes__followup-item">
                    <Badge tone="accent">{basisLabel(analysis.basis)}</Badge>
                    <Link to={newerAnalysisLink(analysis.analysisId)}>
                      {analysis.previousReportName} → {analysis.currentReportName} 분석 보기
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {company.newerDisclosures.length > 0 && (
            <div className="notes__followup-group">
              <span className="notes__followup-label">이후 접수된 공시</span>
              <ul className="notes__followup-list">
                {company.newerDisclosures.map((disclosure) => (
                  <li key={disclosure.rceptNo} className="notes__followup-item">
                    <Badge>{disclosureGroupLabel(disclosure.disclosureGroup)}</Badge>
                    <span className="notes__followup-name">{disclosure.reportName}</span>
                    <span className="notes__followup-date">{formatDate(disclosure.rceptDt)}</span>
                    <DartLinkInline rceptNo={disclosure.rceptNo} dartUrl={disclosure.dartUrl} label={disclosure.reportName} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="notes__followup-notice">{FOLLOWUP_NOTICE}</p>
        </section>
      )}
      <ul className="notes__items">
        {company.items.map((item) => (
          <li key={item.itemId}>
            <NoteItemCard item={item} onSaveMemo={notes.saveMemo} onRemove={notes.remove} />
          </li>
        ))}
      </ul>
      {!showFollowups && hasRelatedOnItems && <p className="notes__followup-notice">{FOLLOWUP_NOTICE}</p>}
    </Panel>
  )
}

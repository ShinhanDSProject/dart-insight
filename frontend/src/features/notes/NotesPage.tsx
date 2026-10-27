import { match } from 'ts-pattern'
import { exportNotes, type CompanyNote } from '@/shared/api/notes'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { downloadTextFile } from '@/shared/lib/download'
import { pageTitle } from '@/shared/lib/pageTitle'
import { Button, ButtonLink, Panel, PanelTitle } from '@/shared/ui'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { NoteItemCard } from './components/NoteItemCard'
import { useNotes, type NotesController } from './hooks/useNotes'
import { exportFileName } from './model/notes'
import './notes.css'

/**
 * 내 판단 노트(FS-57). 분석 결과에서 담은 근거를 기업별로 모아 메모와 함께 다시 보고, 지우고, 출처와 함께 내보낸다.
 * 로그인한 회원만 쓴다. 노트 내용은 AI에 보내지 않는다.
 */
export function NotesPage() {
  useDocumentTitle(pageTitle(['내 판단 노트']))
  const notes = useNotes()

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
            <div className="notes__companies">
              {data.companies.map((company) => (
                <CompanyNotes key={company.corpCode} company={company} notes={notes} />
              ))}
            </div>
          ),
        )
        .exhaustive()}
    </section>
  )
}

function CompanyNotes({ company, notes }: { company: CompanyNote; notes: NotesController }) {
  const name = company.corpName ?? company.corpCode
  const titleId = `notes-company-${company.corpCode}`
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
          {name} <span className="notes__count">{company.items.length}건</span>
        </PanelTitle>
        <Button
          variant="secondary"
          disabled={exporting.state.status === 'loading'}
          aria-label={`${name} 노트 내보내기`}
          onClick={download}
        >
          {exporting.state.status === 'loading' ? '내보내는 중…' : '내보내기'}
        </Button>
      </div>
      {exporting.state.status === 'error' && <ErrorState error={exporting.state.error} />}
      <ul className="notes__items">
        {company.items.map((item) => (
          <li key={item.itemId}>
            <NoteItemCard item={item} onSaveMemo={notes.saveMemo} onRemove={notes.remove} />
          </li>
        ))}
      </ul>
    </Panel>
  )
}

import { match } from 'ts-pattern'
import type { DisclosureKeyItems } from '@/shared/api/disclosures'
import { verifiedDartUrl } from '@/shared/lib/dart'
import { formatDate } from '@/shared/lib/reportLabels'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { useDisclosureKeyItems } from '../hooks/useDisclosureKeyItems'
import { keyItemText } from '../model/disclosureKeyItems'

const errorMessages: Record<string, string> = {
  COMPANY_DISCLOSURE_NOT_FOUND: '이 공시의 핵심 수치를 찾지 못했어요. 최근 공시를 다시 불러와 주세요.',
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘어 핵심 수치를 받지 못했어요. 내일 다시 시도해 주세요.',
  DART_REQUEST_FAILED: 'OpenDART에서 핵심 수치를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  DART_KEY_MISSING: '서버에 OpenDART 키가 설정되지 않았어요. 관리자에게 알려 주세요.',
}

interface DisclosureKeyItemsPanelProps {
  id: string
  corpCode: string
  rceptNo: string
  open: boolean
}

/**
 * 최근 공시 한 건의 '핵심 수치'(FS-51). 펼쳤을 때만 불러오고, OpenDART 주요사항보고서 주요정보의 원문 값을
 * 항목 이름·단위와 함께 보여 준다. 값은 새로 계산하지 않는다.
 */
export function DisclosureKeyItemsPanel({ id, corpCode, rceptNo, open }: DisclosureKeyItemsPanelProps) {
  const { state, reload } = useDisclosureKeyItems(corpCode, rceptNo, open)
  if (!open) return null
  return (
    <div id={id} className="disclosure-key-items">
      {match(state)
        .with({ status: 'idle' }, { status: 'loading' }, () => <LoadingState message="핵심 수치를 불러오는 중이에요…" />)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} messages={errorMessages} />)
        .with({ status: 'success' }, ({ data }) => <KeyItems data={data} />)
        .exhaustive()}
    </div>
  )
}

function KeyItems({ data }: { data: DisclosureKeyItems }) {
  return (
    <>
      {match(data.status)
        .with('AVAILABLE', () => (
          <dl className="facts disclosure-key-items__list">
            {data.items.map((item) => (
              <div className="facts__row" key={item.field}>
                <dt>{item.label}</dt>
                <dd>{keyItemText(item)}</dd>
              </div>
            ))}
          </dl>
        ))
        .with('NO_DATA', () => (
          <p className="disclosure-key-items__empty">OpenDART에 이 공시의 핵심 수치 자료가 없어요. 원문으로 확인해 주세요.</p>
        ))
        .exhaustive()}
      <SourceLine data={data} />
    </>
  )
}

function SourceLine({ data }: { data: DisclosureKeyItems }) {
  // 비고 '정'인 원본은 최신 정정본 행의 값을 쓰므로 그 접수번호로 출처와 링크를 맞춘다
  const sourceRceptNo = data.sourceRceptNo ?? data.rceptNo
  const url = verifiedDartUrl(sourceRceptNo, data.sourceUrl)
  const fetched = `${formatDate(data.fetchedAt.slice(0, 10))} 받음`
  return (
    <p className="dart-source">
      출처: OpenDART 주요사항보고서 주요정보({data.kindLabel}) · 접수번호 {sourceRceptNo}
      {data.sourceRceptNo !== null && ` (최신 정정본, 원본 ${data.rceptNo})`} · {fetched}
      {url !== null && (
        <>
          {' · '}
          <a href={url} target="_blank" rel="noopener noreferrer">
            원문 보기<span aria-hidden="true"> ↗</span>
            <span className="visually-hidden">(DART 원문 새 창, 접수번호 {sourceRceptNo})</span>
          </a>
        </>
      )}
    </p>
  )
}

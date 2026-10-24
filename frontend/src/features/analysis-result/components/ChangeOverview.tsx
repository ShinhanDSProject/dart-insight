import type { ReactNode } from 'react'
import { match } from 'ts-pattern'
import type { SjDiv } from '@/shared/api/results'
import type { ChangeType } from '@/shared/api/textChanges'
import type { LoadState } from '@/shared/hooks/asyncState'
import { Button, ShareBar } from '@/shared/ui'
import { useChangeOverview } from '../hooks/useChangeOverview'
import { formatCount, type FinancialOverview, type TextOverview } from '../model/overview'
import { SectionChangeChart } from './SectionChangeChart'

interface ChangeOverviewProps {
  analysisId: number
  /** 재무 수치 탭을 '변경 항목만'으로 연다(null이면 고른 재무제표 그대로) */
  onOpenChangedAccounts: (sjDiv: SjDiv | null) => void
  /** 문장 변화 탭을 그 유형으로 거른다(null이면 전체) */
  onOpenTextList: (type: ChangeType | null) => void
  /** 섹션별 문장 변경 막대: 문장 변화 탭을 그 최상위 섹션으로 거른다 */
  onOpenTextSection: (section: string) => void
}

/**
 * 요약 탭 맨 위의 변화 개요(FS-4 R6). 바뀐 계정·문장 변경·검토 필요 수를 보여 주고, 누르면 그 탭·거르기로 간다.
 * 불러오지 못한 숫자는 그 자리에만 짧게 알리고, 확인하지 못한 값은 0이 아니라 '확인 안 됨'으로 보인다.
 */
export function ChangeOverview({ analysisId, onOpenChangedAccounts, onOpenTextList, onOpenTextSection }: ChangeOverviewProps) {
  const { financial, text } = useChangeOverview(analysisId)

  return (
    <section className="overview" aria-label="변화 개요">
      <ul className="overview__list">
        <li>
          <LoadedStat label="바뀐 계정" state={financial.state} onRetry={financial.reload}>
            {(data: FinancialOverview) => (
              <Stat
                label="바뀐 계정"
                value={formatCount(data.changed)}
                hint="재무 수치 변화에서 변경 항목만 보기"
                detail={data.changed === null ? '비교한 재무제표가 없어요' : '비교한 재무제표의 합'}
                onOpen={() => onOpenChangedAccounts(data.firstChangedSjDiv)}
              />
            )}
          </LoadedStat>
        </li>
        <li>
          <LoadedStat label="문장 변경" state={text.state} onRetry={text.reload}>
            {(data: TextOverview) =>
              match(data)
                .with({ status: 'available' }, (t) => (
                  <Stat
                    label="문장 변경"
                    value={formatCount(t.all)}
                    hint="문장·내용 변화에서 전체 보기"
                    detail={t.partial ? '일부 섹션만 비교했어요' : null}
                    visual={
                      <ShareBar
                        segments={[
                          { label: '추가', value: t.added, text: formatCount(t.added), tone: 'added' },
                          { label: '수정', value: t.modified, text: formatCount(t.modified), tone: 'modified' },
                          { label: '삭제', value: t.deleted, text: formatCount(t.deleted), tone: 'deleted' },
                        ]}
                      />
                    }
                    onOpen={() => onOpenTextList(null)}
                  />
                ))
                .with({ status: 'unavailable' }, () => (
                  <Stat
                    label="문장 변경"
                    value={formatCount(null)}
                    hint="문장·내용 변화에서 사유 보기"
                    detail="문장을 비교하지 못했어요"
                    onOpen={() => onOpenTextList(null)}
                  />
                ))
                .exhaustive()
            }
          </LoadedStat>
        </li>
        <li>
          <LoadedStat label="검토 필요" state={text.state} onRetry={text.reload}>
            {(data: TextOverview) =>
              match(data)
                .with({ status: 'available' }, (t) => (
                  <Stat
                    label="검토 필요"
                    value={formatCount(t.reviewNeeded)}
                    hint="문장·내용 변화에서 검토 필요만 보기"
                    detail="문장 변화 중 짝짓지 못한 항목"
                    onOpen={() => onOpenTextList('REVIEW_NEEDED')}
                  />
                ))
                .with({ status: 'unavailable' }, () => (
                  <Stat
                    label="검토 필요"
                    value={formatCount(null)}
                    hint="문장·내용 변화에서 사유 보기"
                    detail="문장을 비교하지 못했어요"
                    onOpen={() => onOpenTextList(null)}
                  />
                ))
                .exhaustive()
            }
          </LoadedStat>
        </li>
      </ul>
      <SectionChangeChart state={text.state} onOpenSection={onOpenTextSection} />
    </section>
  )
}

interface LoadedStatProps<T> {
  label: string
  state: LoadState<T>
  onRetry: () => void
  children: (data: T) => ReactNode
}

/** 불러오는 중·실패는 그 숫자 자리에만 짧게 보인다 */
function LoadedStat<T>({ label, state, onRetry, children }: LoadedStatProps<T>) {
  return match(state)
    .with({ status: 'loading' }, () => (
      <div className="overview-stat overview-stat--pending" role="status">
        <span className="overview-stat__label">{label}</span>
        <span className="overview-stat__detail">불러오는 중…</span>
      </div>
    ))
    .with({ status: 'error' }, () => (
      <div className="overview-stat overview-stat--pending" role="status">
        <span className="overview-stat__label">{label}</span>
        <span className="overview-stat__detail">
          불러오지 못했어요.{' '}
          <Button variant="link" onClick={onRetry}>
            다시 시도
          </Button>
        </span>
      </div>
    ))
    .with({ status: 'success' }, ({ data }) => children(data))
    .exhaustive()
}

interface StatProps {
  label: string
  value: string
  /** 누르면 어디로 가는지(화면 읽기 프로그램용) */
  hint: string
  detail: string | null
  /** 숫자 아래 작은 시각화(구성 비율 등) */
  visual?: ReactNode
  onOpen: () => void
}

function Stat({ label, value, hint, detail, visual, onOpen }: StatProps) {
  return (
    <Button variant="link" className="overview-stat" onClick={onOpen}>
      <span className="overview-stat__label">{label}</span>
      <span className="overview-stat__value">{value}</span>
      {visual}
      {detail && <span className="overview-stat__detail">{detail}</span>}
      <span className="visually-hidden">, {hint}</span>
    </Button>
  )
}

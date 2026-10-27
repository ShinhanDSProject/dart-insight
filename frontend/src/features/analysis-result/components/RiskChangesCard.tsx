import { match } from 'ts-pattern'
import type { TextChangeCounts } from '@/shared/api/textChanges'
import { Card, Chip, Notice, Skeleton, StatNumber } from '@/shared/ui'
import { formatCount } from '../model/textFilter'
import {
  otherRiskLabel,
  RISK_EMPTY,
  RISK_FILTER_LABEL,
  RISK_FILTERED_SCOPE,
  RISK_NOTE,
  RISK_SCOPE,
  RISK_TITLE,
  riskCardView,
  riskStats,
} from '../model/riskChanges'

interface RiskChangesCardProps {
  /** 위험 관련 유형별 건수. 아직 모르면 null */
  counts: TextChangeCounts | null
  /** '위험 관련만' 거르기를 켰는지 */
  risk: boolean
  /** 섹션·검색어로 거르고 있는지(건수가 그 안에서 센 것임을 알린다) */
  searched: boolean
  onToggle: (risk: boolean) => void
}

/**
 * 문장 변화 탭 위의 '위험 요인 변화' 카드(3.9, FS-61). 위험 관련 목차에서 새로 생긴·사라진·바뀐 문장 건수를 중립색으로 보이고,
 * '위험 관련만' 거르기를 둔다. 위험의 크기나 좋고 나쁨은 말하지 않는다.
 */
export function RiskChangesCard({ counts, risk, searched, onToggle }: RiskChangesCardProps) {
  return (
    <Card as="section" className="risk-card" aria-labelledby="risk-card-title">
      <div className="risk-card__head">
        <h3 id="risk-card-title" className="risk-card__title">
          {RISK_TITLE}
        </h3>
        <Chip pressed={risk} count={counts?.all} onClick={() => onToggle(!risk)}>
          {RISK_FILTER_LABEL}
        </Chip>
      </div>
      {match(riskCardView(counts))
        .with({ kind: 'loading' }, () => <Skeleton label="위험 요인 변화를 불러오는 중입니다…" shape="card" count={3} />)
        .with({ kind: 'empty' }, () => (
          <p className="risk-card__empty" role="status">
            {RISK_EMPTY}
          </p>
        ))
        .with({ kind: 'counts' }, ({ counts: shown }) => (
          <>
            <ul className="risk-card__stats">
              {riskStats(shown).map((stat) => (
                <li key={stat.key} className="risk-card__stat">
                  <StatNumber label={stat.label} value={stat.value} format={formatCount} unit="건" />
                </li>
              ))}
            </ul>
            {otherRiskLabel(shown) && <p className="panel__note">{otherRiskLabel(shown)}</p>}
          </>
        ))
        .exhaustive()}
      <Notice as="p" className="risk-card__note">
        {RISK_SCOPE} {searched && `${RISK_FILTERED_SCOPE} `}
        {RISK_NOTE}
      </Notice>
    </Card>
  )
}

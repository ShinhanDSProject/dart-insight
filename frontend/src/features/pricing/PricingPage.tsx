import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { pageTitle } from '@/shared/lib/pageTitle'
import { Badge, Button, DataTable, Icon, Notice, Page, PageHeader, Panel, PanelTitle } from '@/shared/ui'
import { usePlanInterest } from './hooks/usePlanInterest'
import { buttonLabel, CREDIT_ROWS, PLAN_CARDS } from './model/pricing'
import './pricing.css'

const PROMISES = [
  { title: '좌석 없음', body: '조직 안 사용자 수는 무제한이에요.' },
  { title: '검증된 결과에만 과금', body: '분석 실패, 검토 필요, 근거 없는 답은 0 크레딧이에요.' },
  { title: '사람과 에이전트가 같은 값', body: 'API 응답에 쓴 크레딧·남은 크레딧이 함께 와요. 키마다 예산 한도를 둬요.' },
]

/**
 * 요금제(FS-73). 수익화 전략의 가격 가설을 보여 주고 요금제별 '관심 있어요'만 센다. 결제는 없고 연락처도 받지 않는다.
 * 사람 수가 아니라 비교·모니터링·질문 단위로 크레딧을 쓰고, 화면과 AI 에이전트(API·MCP)가 같은 크레딧을 쓴다.
 */
export function PricingPage() {
  useDocumentTitle(pageTitle(['요금제']))
  const interest = usePlanInterest()

  return (
    <Page width="wide" className="pricing">
      <PageHeader
        title="사람 수가 아니라, 검증된 결과에만 내요"
        lead="비교 1건, 지켜보는 기업 1곳, 질문 1회에 크레딧을 써요. 화면에서 쓰든 AI 에이전트가 API로 쓰든 같은 크레딧이에요."
        aside={<Badge tone="accent">요금제 · 가설</Badge>}
      />
      <Notice tone="attention" title="아직 결제는 없어요">
        가격은 검증 중인 가설이고, ‘관심 있어요’는 어떤 요금제가 필요한지 세는 데만 써요. 연락처는 받지 않아요.
      </Notice>

      <ul className="pricing__plans" aria-label="요금제">
        {PLAN_CARDS.map((card) => {
          const status = interest.state[card.plan]
          const titleId = `plan-${card.plan}`
          return (
            <li key={card.plan} className={card.primary ? 'plan plan--primary' : 'plan'} aria-labelledby={titleId}>
              <div className="plan__head">
                <h2 className="plan__name" id={titleId}>
                  {card.name}
                </h2>
                {card.primary && <Badge tone="accent">주 대상</Badge>}
              </div>
              <p className="plan__price">
                <span className="plan__amount">{card.price}</span>
                <span className="plan__unit">{card.unit}</span>
              </p>
              <ul className="plan__features">
                {card.features.map((f) => (
                  <li key={f}>
                    <span className="plan__check" aria-hidden="true">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={card.primary ? 'primary' : 'secondary'}
                className="plan__cta"
                disabled={status === 'sent' || status === 'sending'}
                aria-describedby={titleId}
                onClick={() => interest.send(card.plan)}
              >
                {status === 'sent' && <Icon name="star-filled" size={14} />}
                {buttonLabel(status)}
              </Button>
              {status === 'error' && (
                <p className="plan__error" role="alert">
                  기록하지 못했어요. 잠시 뒤 다시 눌러 주세요.
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <div className="pricing__more">
        <Panel aria-labelledby="credit-title">
          <PanelTitle id="credit-title">크레딧 소모표</PanelTitle>
          <p className="pricing__note">1 크레딧 ≈ 100원(가설)</p>
          <DataTable caption="일마다 쓰는 크레딧. 일, 비고, 크레딧 순입니다." density="compact">
            <thead>
              <tr>
                <th scope="col">일</th>
                <th scope="col">비고</th>
                <th scope="col" className="pricing__num">
                  크레딧
                </th>
              </tr>
            </thead>
            <tbody>
              {CREDIT_ROWS.map((row) => (
                <tr key={row.work}>
                  <th scope="row">{row.work}</th>
                  <td>{row.note}</td>
                  <td className="pricing__num">{row.credits}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>
        <Panel aria-labelledby="promise-title">
          <PanelTitle id="promise-title">세 가지 약속</PanelTitle>
          <dl className="pricing__promises">
            {PROMISES.map((p) => (
              <div key={p.title}>
                <dt>{p.title}</dt>
                <dd>{p.body}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
      <p className="pricing__disclaimer">
        DART Insight는 공시의 변화를 근거와 함께 보여 주는 정보 서비스이며, 투자 판단이나 종목 추천을 하지 않아요.
      </p>
    </Page>
  )
}

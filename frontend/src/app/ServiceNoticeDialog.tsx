import { useResultTour } from '@/shared/hooks/useResultTour'
import { Badge, Button, Dialog } from '@/shared/ui'
import { SERVICE_NOTICE } from '@/shared/lib/serviceNotice'

const TITLE_ID = 'service-notice-title'

/** 결과 화면에 보이는 표시와 그 뜻(#842). 신호·증감은 투자 판단이 아니라는 것을 함께 적는다 */
const MARKS = [
  { mark: <Badge tone="accent">AI 생성</Badge>, meaning: 'AI가 쓴 문장이에요. 함께 보이는 근거 원문으로 확인해 주세요.' },
  { mark: <span className="service-notice-dialog__link">근거 ›</span>, meaning: '그 문장이 나온 공시 원문을 열어요.' },
  { mark: <span>긍정 · 주의 · 보류</span>, meaning: '주요 사건에 기준표가 붙인 신호예요. 투자 판단이나 추천이 아니에요.' },
  { mark: <span>▲ ▼</span>, meaning: '늘었는지 줄었는지만 보여요. 좋고 나쁨을 뜻하지 않아요.' },
  { mark: <Badge tone="attention">검토 필요</Badge>, meaning: '근거를 확인하지 못한 항목이에요. 원문에서 직접 확인해 주세요.' },
] as const

/**
 * 하단 바 '이용 안내'(5.6, #548). 첫 화면 이용 안내와 같은 세 문장(SERVICE_NOTICE) 아래에
 * 화면의 표시 뜻과 '결과 화면 둘러보기 다시 보기'를 둔다(#842).
 */
export function ServiceNoticeDialog({ onClose }: { onClose: () => void }) {
  const tour = useResultTour()
  return (
    <Dialog titleId={TITLE_ID} title="이용 안내" onClose={onClose}>
      <ul className="service-notice-dialog__list">
        {SERVICE_NOTICE.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <h3 className="service-notice-dialog__subtitle">화면의 표시 뜻</h3>
      <dl className="service-notice-dialog__marks">
        {MARKS.map(({ mark, meaning }) => (
          <div key={meaning}>
            <dt>{mark}</dt>
            <dd>{meaning}</dd>
          </div>
        ))}
      </dl>
      <Button
        variant="secondary"
        onClick={() => {
          tour.reopen()
          onClose()
        }}
      >
        결과 화면 둘러보기 다시 보기
      </Button>
    </Dialog>
  )
}

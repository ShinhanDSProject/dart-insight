import type { CSSProperties } from 'react'
import { ONBOARDING_EXAMPLE_CORP_CODE } from '@/shared/lib/onboarding'
import { Button, ButtonLink, Card, Icon } from '@/shared/ui'

const STEPS = [
  { title: '기업 찾기', text: '회사명이나 종목코드로 검색해요.' },
  { title: '두 보고서 고르기', text: '비교할 정기보고서 두 개를 골라요. 기본은 전년 동기예요.' },
  { title: '변화 확인', text: '바뀐 수치·문장을 원문 근거와 함께 보고, 궁금한 건 AI에게 물어봐요.' },
] as const

/**
 * W-01 ① 검색창 위 '처음 쓰는 사용자 안내'(FS-10). 3단계와 예시 기업으로 바로 시작하는 버튼을 보인다.
 * 닫으면 이 브라우저에 기억하고, 사이드바의 '사용법 다시 보기'로 다시 연다.
 */
export function OnboardingGuide({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Card as="section" className="onboarding" aria-labelledby="onboarding-title">
      <div className="onboarding__head">
        <h2 className="onboarding__title" id="onboarding-title">
          처음이신가요? 이렇게 써 보세요
        </h2>
        <Button variant="icon" aria-label="사용법 안내 닫기" onClick={onDismiss}>
          <Icon name="x" size={16} />
        </Button>
      </div>
      <ol className="onboarding__steps">
        {STEPS.map((step, index) => (
          <li key={step.title} className="onboarding__step" style={{ '--row': index } as CSSProperties}>
            <span className="onboarding__number" aria-hidden="true">
              {index + 1}
            </span>
            <span className="onboarding__body">
              <strong className="onboarding__step-title">{step.title}</strong>
              <span className="onboarding__step-text">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="onboarding__actions">
        <ButtonLink variant="primary" to={`/companies/${ONBOARDING_EXAMPLE_CORP_CODE}`}>
          삼성전자로 해보기
        </ButtonLink>
        <Button variant="secondary" onClick={onDismiss}>
          닫기
        </Button>
      </div>
    </Card>
  )
}

import type { CSSProperties } from 'react'
import { ONBOARDING_EXAMPLE_CORP_CODE } from '@/shared/lib/onboarding'
import { Button, ButtonLink, Card, Icon } from '@/shared/ui'

export const ONBOARDING_STEPS = [
  { title: '기업 찾기', text: '회사명이나 종목코드로 검색해요.' },
  { title: '두 보고서 고르기', text: '비교할 정기보고서 두 개를 골라요. 기본은 전년 동기예요.' },
  { title: '변화 확인', text: '바뀐 수치·문장을 원문 근거와 함께 보고, 궁금한 건 AI에게 물어봐요.' },
] as const

export function OnboardingStepsList() {
  return (
    <ol className="onboarding__steps">
      {ONBOARDING_STEPS.map((step, index) => (
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
  )
}

/** 첫 화면 소개 한 줄(#839). 무엇을 하는 서비스인지 검색창 위에서 바로 알린다 */
export const HOME_INTRO = '보고서 두 개를 비교해서, 바뀐 숫자와 문장을 찾아 드려요'
export const HOME_SOURCE = '금융감독원 DART 공시 원문을 근거로 보여 줘요'

/** 첫 화면 검색창 아래 사용 순서 한 줄(#839). 단계 이름은 사용법 안내와 같고, 자세한 설명은 '사용법 보기'로 연다 */
export function HomeSteps({ onOpenGuide }: { onOpenGuide: () => void }) {
  return (
    <div className="home-steps">
      <ol className="home-steps__list" aria-label="사용 순서">
        {ONBOARDING_STEPS.map((step, index) => (
          <li key={step.title} className="home-steps__step">
            <span className="home-steps__number" aria-hidden="true">
              {index + 1}
            </span>
            {step.title}
          </li>
        ))}
      </ol>
      <Button variant="link" className="home-steps__guide" onClick={onOpenGuide}>
        처음이라면 사용법 보기 ›
      </Button>
    </div>
  )
}

/**
 * W-01 ① 처음 쓰는 사용자 안내(FS-10). 3단계와 예시 기업으로 바로 시작하는 버튼을 보인다.
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
      <OnboardingStepsList />
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

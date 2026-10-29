import { SERVICE_NOTICE } from '@/shared/lib/serviceNotice'
import { Notice } from './Notice'

/**
 * 첫 화면(W-01) 이용 안내(5.6): 생성형 AI 사용, 투자 조언 아님, 출처.
 * 한 줄로 접어 두고 '자세히'로 세 문장을 모두 보인다(#486). 문구는 SERVICE_NOTICE 그대로다.
 */
export function ServiceNotice() {
  return (
    <Notice as="aside" className="service-notice" aria-label="이용 안내">
      <details>
        <summary className="service-notice__summary">
          <span>
            <strong>이용 안내</strong> · AI가 만든 문장에는 'AI 생성'이 붙고, 투자 조언이 아니에요.
          </span>
          <span className="service-notice__more">자세히</span>
          <span className="service-notice__less">접기</span>
        </summary>
        <ul>
          {SERVICE_NOTICE.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </Notice>
  )
}

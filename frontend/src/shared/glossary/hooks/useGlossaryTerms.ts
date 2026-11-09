import { getGlossaryTerms, type GlossaryTerm } from '@/shared/api/glossaryTerms'
import { useAsync } from '@/shared/hooks/useAsync'

// 카드는 배포 때만 바뀌므로 한 화면에서 한 번만 받아 용어 풀이·채팅 카드가 같이 쓴다(ADR-0061).
// 여러 곳이 같은 요청을 나눠 쓰므로 한 곳이 화면을 떠나도 요청을 취소하지 않고, 실패하면 다음에 다시 받는다
let cached: Promise<GlossaryTerm[]> | null = null

function loadOnce(): Promise<GlossaryTerm[]> {
  cached ??= getGlossaryTerms().then(
    (response) => response.items,
    (error: unknown) => {
      cached = null
      throw error
    },
  )
  return cached
}

/** 공시 용어 카드 목록(GET /api/glossary-terms). 출처·검토를 마친 카드만 온다 */
export function useGlossaryTerms() {
  return useAsync(loadOnce)
}

/** 테스트용: 받아 둔 카드를 지운다 */
export function resetGlossaryTermsCache() {
  cached = null
}

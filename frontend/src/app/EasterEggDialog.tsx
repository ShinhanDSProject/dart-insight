import { ButtonAnchor, Dialog, Mascot } from '@/shared/ui'
import { EASTER_EGG_PATH } from '@/shared/lib/easterEgg'

const TITLE_ID = 'easter-egg-title'

/** Shift를 두 번 눌러 여는 시스템 가이드 안내(#753, #755, #810). 페이지는 새 탭에서 연다 */
export function EasterEggDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog titleId={TITLE_ID} title="숨은 페이지를 찾았어요" onClose={onClose}>
      <div className="easter-egg">
        <Mascot mood="joy" size="md" />
        <p>DART Insight의 기획, 기술 스택, 아키텍처, 인프라와 개발 발자취를 한눈에 살펴볼 수 있는 시스템 가이드예요.</p>
        <ButtonAnchor variant="primary" href={EASTER_EGG_PATH} target="_blank" rel="noopener">
          시스템 가이드 보기
        </ButtonAnchor>
      </div>
    </Dialog>
  )
}

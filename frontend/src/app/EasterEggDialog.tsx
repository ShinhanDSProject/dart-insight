import { ButtonAnchor, Dialog, Mascot } from '@/shared/ui'
import { EASTER_EGG_PATH } from '@/shared/lib/easterEgg'

const TITLE_ID = 'easter-egg-title'

/** Shift를 두 번 눌러 여는 숨은 페이지 안내(#753, #755). 페이지는 새 탭에서 연다 */
export function EasterEggDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog titleId={TITLE_ID} title="숨은 페이지를 찾았어요" onClose={onClose}>
      <div className="easter-egg">
        <Mascot mood="joy" size="md" />
        <p>DART Insight 팀이 3주 동안 만든 기록이에요. 주차별로 병합한 PR 360개와 구조, 기술을 고른 이유를 담았어요.</p>
        <ButtonAnchor variant="primary" href={EASTER_EGG_PATH} target="_blank" rel="noopener">
          3주의 기록 보기
        </ButtonAnchor>
      </div>
    </Dialog>
  )
}

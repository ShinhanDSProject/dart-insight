import { Dialog } from '@/shared/ui'
import { SERVICE_NOTICE } from '@/shared/lib/serviceNotice'

const TITLE_ID = 'service-notice-title'

/** 하단 바 '이용 안내'(5.6, #548). 첫 화면 이용 안내와 같은 세 문장(SERVICE_NOTICE)을 대화상자로 보인다 */
export function ServiceNoticeDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog titleId={TITLE_ID} title="이용 안내" onClose={onClose}>
      <ul className="service-notice-dialog__list">
        {SERVICE_NOTICE.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </Dialog>
  )
}

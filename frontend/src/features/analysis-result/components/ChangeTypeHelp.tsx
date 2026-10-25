import { useId, useState } from 'react'
import { Button } from '@/shared/ui'
import { changeTypeHelpItems } from '../model/textLabels'

/**
 * 문장 변경 유형 설명(3.3, #300). 거르기 칩 아래에서 펼쳐 6개 유형의 뜻을 정의 목록으로 보여 준다.
 * 펼침 상태는 이 컴포넌트에만 두고(주소에 남기지 않음), 인쇄에서는 숨긴다(print.css).
 */
export function ChangeTypeHelp() {
  const [open, setOpen] = useState(false)
  const listId = useId()
  return (
    <div className="change-type-help">
      <Button variant="secondary" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((v) => !v)}>
        {open ? '유형 설명 접기' : '유형 설명'}
      </Button>
      <dl id={listId} className="change-type-help__list" hidden={!open}>
        {changeTypeHelpItems().map((item) => (
          <div key={item.type} className="change-type-help__item">
            <dt>{item.label}</dt>
            <dd>{item.help}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

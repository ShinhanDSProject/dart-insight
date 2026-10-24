import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { match, P } from 'ts-pattern'
import { useCompanyAnalyses } from '@/shared/hooks/useCompanyAnalyses'
import { Button } from '@/shared/ui'
import { OTHER_ANALYSES_REQUEST_LIMIT, otherAnalysisLinks, type OtherAnalysisLink } from '../model/otherAnalyses'
import type { ResultTab } from '../model/resultParams'

interface OtherAnalysesProps {
  corpCode: string
  analysisId: number
  tab: ResultTab
}

/**
 * 결과 화면 머리글의 '이 기업의 다른 분석'(#290). 같은 기업의 완료된 다른 분석으로 지금 탭을 유지한 채 바로 간다.
 * 다른 분석이 없거나, 불러오는 중이거나, 불러오지 못하면 보이지 않는다(머리글의 다른 버튼을 막지 않음).
 */
export function OtherAnalyses({ corpCode, analysisId, tab }: OtherAnalysesProps) {
  const { state } = useCompanyAnalyses(corpCode, OTHER_ANALYSES_REQUEST_LIMIT)
  const links = match(state)
    .with({ status: 'success' }, ({ data }) => otherAnalysisLinks(data.items, analysisId, tab))
    .with({ status: P.union('loading', 'error') }, () => [])
    .exhaustive()
  return links.length > 0 ? <OtherAnalysesMenu links={links} /> : null
}

/** 펼침 버튼과 링크 목록. Esc로 닫으면 초점을 버튼으로 돌려주고, 바깥을 누르거나 항목을 고르면 닫는다 */
export function OtherAnalysesMenu({ links }: { links: OtherAnalysisLink[] }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onMouseDown = (event: MouseEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !open) return
    // 뒤에 열린 근거 패널(SidePanel)까지 함께 닫히지 않게 한다
    event.stopPropagation()
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div ref={rootRef} className="other-analyses" onKeyDown={onKeyDown}>
      <Button ref={buttonRef} aria-expanded={open} aria-controls={listId} onClick={() => setOpen((v) => !v)}>
        이 기업의 다른 분석
      </Button>
      <ul id={listId} className="other-analyses__list" hidden={!open}>
        {links.map((link) => (
          <li key={link.analysisId}>
            <Link to={link.to} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

import { Link } from 'react-router'
import { match, P } from 'ts-pattern'
import { useCompanyAnalyses } from '@/shared/hooks/useCompanyAnalyses'
import { MenuButton } from '@/shared/ui'
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

/** 펼침 버튼과 링크 목록(MenuButton). Esc로 닫으면 초점을 버튼으로 돌려주고, 바깥을 누르거나 항목을 고르면 닫는다 */
export function OtherAnalysesMenu({ links }: { links: OtherAnalysisLink[] }) {
  return (
    <MenuButton label="이 기업의 다른 분석" align="start">
      {(close) => (
        <ul className="other-analyses__list">
          {links.map((link) => (
            <li key={link.analysisId}>
              <Link className="menu-button__item" to={link.to} onClick={close}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </MenuButton>
  )
}

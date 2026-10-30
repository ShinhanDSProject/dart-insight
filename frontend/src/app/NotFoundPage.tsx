import { Link } from 'react-router'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { pageTitle } from '@/shared/lib/pageTitle'
import { ButtonLink, Page, PageHeader } from '@/shared/ui'

export function NotFoundPage() {
  useDocumentTitle(pageTitle(['페이지 없음']))
  return (
    <Page>
      <PageHeader
        breadcrumb={
          <>
            <Link to="/">기업 검색</Link> / 페이지 없음
          </>
        }
        title="찾는 화면이 없어요"
        lead="주소가 바뀌었거나 없는 화면이에요. 주소를 확인하거나 기업 검색에서 다시 찾아 주세요."
      />
      <ButtonLink to="/" variant="secondary">
        기업 검색으로 돌아가기
      </ButtonLink>
    </Page>
  )
}

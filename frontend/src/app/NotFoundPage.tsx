import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { pageTitle } from '@/shared/lib/pageTitle'
import { ButtonLink } from '@/shared/ui'
import { EmptyState } from '@/shared/ui/StateView'

export function NotFoundPage() {
  useDocumentTitle(pageTitle(['페이지 없음']))
  return (
    <section className="page">
      <EmptyState title="찾는 화면이 없습니다.">
        <ButtonLink to="/" variant="secondary">
          기업 검색으로 돌아가기
        </ButtonLink>
      </EmptyState>
    </section>
  )
}

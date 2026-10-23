import { Link } from 'react-router'
import { EmptyState } from '@/shared/ui/StateView'

export function NotFoundPage() {
  return (
    <section className="page">
      <EmptyState title="찾는 화면이 없습니다.">
        <Link to="/" className="button button--secondary">
          기업 검색으로 돌아가기
        </Link>
      </EmptyState>
    </section>
  )
}

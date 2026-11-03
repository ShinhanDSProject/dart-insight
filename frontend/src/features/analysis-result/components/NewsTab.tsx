import { match } from 'ts-pattern'
import type { NewsArticle } from '@/shared/api/news'
import { Notice, Panel, PanelTitle, Skeleton } from '@/shared/ui'
import { EmptyState, ErrorState } from '@/shared/ui/StateView'
import { useCompanyNews } from '../hooks/useCompanyNews'
import { NEWS_NOTICE, newsTime } from '../model/news'

const errorMessages: Record<string, string> = {
  COMPANY_NEWS_UNAVAILABLE: '뉴스를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.',
}

/**
 * 분석 결과 '뉴스' 탭(#592, ADR-0046). 기업 이름으로 찾은 최신 기사의 제목·요약·언론사·시각을 보이고, 누르면 원문을 새 창으로 연다.
 * 뉴스는 공시 근거가 아니라 외부 자료라 맨 위에 안내를 둔다. 실패해도 이 탭 안에서만 안내한다.
 */
export function NewsTab({ corpCode }: { corpCode: string }) {
  const { state, reload } = useCompanyNews(corpCode)
  return (
    <Panel className="news" aria-labelledby="news-title">
      <PanelTitle id="news-title">최신 뉴스</PanelTitle>
      <Notice className="news__notice">
        <p>{NEWS_NOTICE}</p>
      </Notice>
      {match(state)
        .with({ status: 'loading' }, () => <Skeleton label="뉴스를 불러오는 중이에요…" shape="line" count={4} />)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} messages={errorMessages} />)
        .with({ status: 'success', data: { items: [] } }, ({ data }) => (
          <EmptyState title={`'${data.query}' 이름이 제목에 들어간 최근 기사가 없어요.`} />
        ))
        .with({ status: 'success' }, ({ data }) => (
          <ul className="news__list">
            {data.items.map((article) => (
              <li key={article.url}>
                <NewsItem article={article} />
              </li>
            ))}
          </ul>
        ))
        .exhaustive()}
    </Panel>
  )
}

function NewsItem({ article }: { article: NewsArticle }) {
  const time = newsTime(article.publishedAt)
  return (
    <article className="news-item">
      <a className="news-item__title" href={article.url} target="_blank" rel="noopener noreferrer">
        {article.title}
        <span aria-hidden="true"> ↗</span>
        <span className="visually-hidden"> (새 창)</span>
      </a>
      {article.description && <p className="news-item__description">{article.description}</p>}
      <p className="news-item__meta">
        {article.source ?? '출처 미상'}
        {time && <> · {time}</>}
      </p>
    </article>
  )
}

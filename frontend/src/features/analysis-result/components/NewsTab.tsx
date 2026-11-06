import { match } from 'ts-pattern'
import type { NewsArticle } from '@/shared/api/news'
import { Card, Notice, Panel, PanelTitle, Skeleton } from '@/shared/ui'
import { EmptyState, ErrorState } from '@/shared/ui/StateView'
import { useCompanyNews } from '../hooks/useCompanyNews'
import { groupNews, NEWS_DIGEST_MIN, NEWS_NOTICE, newsTime } from '../model/news'

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
          <>
            {data.items.length >= NEWS_DIGEST_MIN && <NewsDigest items={data.items} />}
            <ol className="news__list">
              {data.items.map((article, index) => (
                <li key={article.url} id={`news-${index + 1}`}>
                  <span className="news__number" aria-hidden="true">{index + 1}</span>
                  <NewsItem article={article} />
                </li>
              ))}
            </ol>
          </>
        ))
        .exhaustive()}
    </Panel>
  )
}

/** '뉴스 한눈에 보기'(#765). 기사 제목의 낱말로 주제를 나눈 것이고 AI 요약이 아니다(ADR-0046) */
function NewsDigest({ items }: { items: NewsArticle[] }) {
  const groups = groupNews(items)
  return (
    <Card as="section" tone="subtle" className="news-digest" aria-labelledby="news-digest-title">
      <h3 id="news-digest-title" className="news-digest__title">뉴스 한눈에 보기</h3>
      <p className="news-digest__headline">
        기사 {items.length}건
        {groups.map((group) => (
          <span key={group.label}> · {group.label} {group.numbers.length}</span>
        ))}
      </p>
      <ul className="news-digest__topics">
        {groups.map((group) => (
          <li key={group.label} className="news-digest__topic">
            <p className="news-digest__label">
              {group.label}
              <span className="news-digest__count">{group.numbers.length}건</span>
            </p>
            <p className="news-digest__first">
              {group.first.title}
              {group.numbers.map((number) => (
                <a key={number} className="news-digest__number" href={`#news-${number}`} aria-label={`${number}번 기사로 가기`}>
                  {number}
                </a>
              ))}
            </p>
          </li>
        ))}
      </ul>
      <p className="news-digest__note">기사 제목에 든 낱말로 주제를 나눴어요. AI 요약이 아니며, 주제마다 가장 최근 기사 제목을 보여요.</p>
    </Card>
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

import { useState } from 'react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { SeasonChangeItem, SeasonChangeList, SeasonKey } from '@/shared/api/seasonChanges'
import { Badge, Button, Select } from '@/shared/ui'
import { AlertState } from '@/shared/ui/StateView'
import { useSeasonChanges } from '../hooks/useSeasonChanges'
import {
  excludedNote,
  parseSeasonValue,
  SEASON_SCORE_NOTE,
  seasonCaption,
  seasonOptionLabel,
  seasonValue,
} from '../model/seasonChanges'

const TITLE_ID = 'season-changes-title'

/**
 * W-01 ① 대표 기업 아래 '이번 시즌 변화가 큰 기업' Top 10(#420, ADR-0037). 대표 기업을 문장 비교만으로 잰 순위이고,
 * 줄을 누르면 요약까지 있는 분석 결과로 간다. 순위는 바뀐 양이지 좋고 나쁨이 아니다.
 * 불러오는 중에는 자리를 비워 두고, 실패하면 다시 시도를, 아직 계산하지 않았으면 짧은 안내를 보인다.
 */
export function SeasonChanges() {
  const [season, setSeason] = useState<SeasonKey | null>(null)
  const { state, reload } = useSeasonChanges(season)
  return match(state)
    .with({ status: 'loading' }, () => null)
    .with({ status: 'error' }, () => (
      <AlertState title="이번 시즌 변화가 큰 기업을 불러오지 못했어요.">
        <Button variant="secondary" onClick={reload}>
          다시 시도
        </Button>
      </AlertState>
    ))
    .with({ status: 'success' }, ({ data }) => <SeasonChangesBody data={data} onSeasonChange={setSeason} />)
    .exhaustive()
}

function SeasonChangesBody({ data, onSeasonChange }: { data: SeasonChangeList; onSeasonChange: (season: SeasonKey) => void }) {
  const season = data.season
  const excluded = excludedNote(data.excluded)
  return (
    <section className="season-changes" aria-labelledby={TITLE_ID}>
      <div className="season-changes__head">
        <h2 className="favorite-companies__title" id={TITLE_ID}>
          이번 시즌 변화가 큰 기업 Top 10
        </h2>
        {season !== null && data.seasons.length > 1 && (
          <label className="season-changes__picker">
            <span className="visually-hidden">시즌</span>
            <Select
              value={seasonValue(season)}
              onChange={(event) => {
                const next = parseSeasonValue(event.target.value, data.seasons)
                if (next) onSeasonChange(next)
              }}
            >
              {data.seasons.map((option) => (
                <option key={seasonValue(option)} value={seasonValue(option)}>
                  {seasonOptionLabel(option)}
                </option>
              ))}
            </Select>
          </label>
        )}
      </div>
      {season === null ? (
        <p className="featured-companies__note">
          이번 시즌 순위를 준비하고 있어요. 정기보고서 제출 기한이 지나면 대표 기업의 변화를 재어 보여 드려요.
        </p>
      ) : (
        <>
          <p className="featured-companies__note">
            {seasonCaption(season.reportType, season.fiscalYear, season.previousFiscalYear, data.candidateCount)}. 바뀐
            양이지 좋고 나쁨이 아니에요.
          </p>
          {data.items.length === 0 ? (
            <p className="featured-companies__note">이 시즌에 순위를 매긴 기업이 없어요.</p>
          ) : (
            <ol className="season-changes__list">
              {data.items.map((item) => (
                <SeasonChangeRow key={item.corpCode} item={item} />
              ))}
            </ol>
          )}
          {excluded && <p className="featured-companies__note">{excluded}</p>}
          <p className="featured-companies__note">{SEASON_SCORE_NOTE} 출처: DART</p>
        </>
      )}
    </section>
  )
}

function SeasonChangeRow({ item }: { item: SeasonChangeItem }) {
  // 분석을 요청하지 못했으면 기업 화면으로 보낸다(거기서 직접 비교할 수 있음)
  const to = item.analysisId === null ? `/companies/${encodeURIComponent(item.corpCode)}` : `/analyses/${item.analysisId}`
  return (
    <li className="season-changes__item">
      <span className="season-changes__rank" aria-hidden="true">
        {item.rank}
      </span>
      <Link to={to} className="season-changes__link">
        <span className="visually-hidden">{item.rank}위</span>{' '}
        <span className="season-changes__name">{item.corpName ?? item.corpCode}</span>
        {item.highlight && <span className="season-changes__highlight">{item.highlight}</span>}
      </Link>
      {item.changeCount !== null && <Badge>문장 변경 {item.changeCount}</Badge>}
    </li>
  )
}

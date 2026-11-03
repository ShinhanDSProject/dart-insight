import { match } from 'ts-pattern'
import type { DisclosureGroup, DisclosureItem, DisclosureList } from '@/shared/api/disclosures'
import { formatCount } from './overview'

/** 요약 탭 오른쪽 '이 기간 수시공시'에 보이는 공시 제목 수(시안) */
export const PERIOD_TITLE_LIMIT = 3

export interface PeriodTitle {
  /** 꼬리표([기재정정] 등)를 뗀 공시 제목 */
  title: string
  count: number
  /** 이 제목의 묶음. 묶음은 제목 낱말로 정해져 같은 제목이면 같다 */
  group: DisclosureGroup
  /** 가장 최근에 낸 같은 제목 공시의 DART 주소 */
  dartUrl: string
}

/** 이 기간 묶음별 건수. 지분 변동·정기보고서는 따로 둔다 */
export interface PeriodBreakdown {
  business: number
  funding: number
  governance: number
  other: number
}

export interface PeriodDisclosures {
  /** 센 접수일 기간(YYYY-MM-DD). 이전 보고서 제출 다음 날 ~ 현재 보고서 제출일 */
  from: string
  to: string
  /** 받은 목록(최근 1년)이 기간 시작을 덮지 못해 앞부분을 세지 못했는지 */
  clipped: boolean
  /** 머리 건수: 실적·영업·자금 조달·지배구조 수시공시(FS-68 AC3). 기타는 breakdown에만 센다 */
  count: number
  breakdown: PeriodBreakdown
  /** 뺀 지분 변동 건수(보유 주식 보고가 많아 수시공시를 가린다) */
  ownershipCount: number
  /** 실적·영업·자금 조달·지배구조 제목을 많이 낸 순(같으면 최근 순)으로 먼저 두고, 모자라면 기타 제목으로 채운 PERIOD_TITLE_LIMIT개 */
  titles: PeriodTitle[]
}

/** 공시 묶음을 이 기간 수시공시에서 어떻게 셀지. main 머리 건수, other 기타(따로 셈), ownership 뺀 건수, periodic 세지 않음 */
function periodRole(group: DisclosureGroup): 'main' | 'other' | 'ownership' | 'periodic' {
  return match(group)
    .with('BUSINESS', 'FUNDING', 'GOVERNANCE', () => 'main' as const)
    .with('OTHER', () => 'other' as const)
    .with('OWNERSHIP', () => 'ownership' as const)
    .with('PERIODIC', () => 'periodic' as const)
    .exhaustive()
}

/**
 * 두 보고서 사이에 낸 수시공시를 센다(시안 '이 기간 수시공시 N건'). 기간은 이전 보고서 제출 다음 날부터 현재 보고서 제출일까지.
 * 머리 건수는 실적·영업·자금 조달·지배구조만 세고(FS-68 AC3), 기타는 묶음별 건수에 따로 보인다.
 * 기타에는 규칙 낱말에 맞지 않은 공시가 모두 들어가 배당 결정(현금ㆍ현물배당결정)처럼 볼 만한 것도 있어 버리지 않는다.
 * 지분 변동은 뺀 건수만 알리고, 정기보고서는 세지 않는다. 같은 제목은 한 줄로 묶어 횟수를 붙인다. 인과관계는 판단하지 않는다.
 */
export function summarizePeriodDisclosures(
  list: DisclosureList,
  previousReceivedAt: string,
  currentReceivedAt: string,
): PeriodDisclosures {
  const wantedFrom = nextDay(previousReceivedAt)
  const clipped = list.from > wantedFrom
  const from = clipped ? list.from : wantedFrom
  const to = currentReceivedAt

  const inPeriod = list.items.filter((item) => item.receivedDate >= from && item.receivedDate <= to)
  const countOf = (group: DisclosureGroup) => inPeriod.filter((item) => item.group === group).length
  const main = inPeriod.filter((item) => periodRole(item.group) === 'main')
  const other = inPeriod.filter((item) => periodRole(item.group) === 'other')
  const mainTitles = topTitles(main)
  const titles = [...mainTitles, ...topTitles(other)].slice(0, PERIOD_TITLE_LIMIT)

  return {
    from,
    to,
    clipped,
    count: main.length,
    breakdown: {
      business: countOf('BUSINESS'),
      funding: countOf('FUNDING'),
      governance: countOf('GOVERNANCE'),
      other: other.length,
    },
    ownershipCount: countOf('OWNERSHIP'),
    titles,
  }
}

/** 묶음별 건수 한 줄: '실적·영업 5 · 자금 조달 0 · 지배구조 2 · 기타 61 · 지분 변동 3건 제외' */
export function periodBreakdownLine(data: Pick<PeriodDisclosures, 'breakdown' | 'ownershipCount'>): string {
  const { business, funding, governance, other } = data.breakdown
  return [
    `실적·영업 ${formatCount(business)}`,
    `자금 조달 ${formatCount(funding)}`,
    `지배구조 ${formatCount(governance)}`,
    `기타 ${formatCount(other)}`,
    `지분 변동 ${formatCount(data.ownershipCount)}건 제외`,
  ].join(' · ')
}

/** 같은 제목끼리 묶어 많이 낸 순(같으면 목록 순서 = 최근 순)으로 자른다 */
function topTitles(items: DisclosureItem[]): PeriodTitle[] {
  const byTitle = new Map<string, PeriodTitle>()
  for (const item of items) {
    const title = plainTitle(item.reportName)
    const seen = byTitle.get(title)
    if (seen) seen.count += 1
    else byTitle.set(title, { title, count: 1, group: item.group, dartUrl: item.dartUrl })
  }
  return [...byTitle.values()].sort((a, b) => b.count - a.count).slice(0, PERIOD_TITLE_LIMIT)
}

/** 제목 앞 '[기재정정]' 같은 꼬리표와 뒤에 덧붙인 괄호 설명(공백 여러 칸 뒤)을 뗀다(backend 묶음 규칙과 같은 방식) */
export function plainTitle(reportName: string): string {
  return reportName
    .replace(/^(\[[^\]]*\]\s*)+/, '')
    .replace(/\s{2,}\(.*\)$/, '')
    .trim()
}

function nextDay(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

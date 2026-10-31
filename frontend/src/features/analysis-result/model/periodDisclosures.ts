import type { DisclosureItem, DisclosureList } from '@/shared/api/disclosures'

/** 요약 탭 오른쪽 '이 기간 수시공시'에 보이는 공시 제목 수(시안) */
export const PERIOD_TITLE_LIMIT = 3

export interface PeriodTitle {
  /** 꼬리표([기재정정] 등)를 뗀 공시 제목 */
  title: string
  count: number
  /** 가장 최근에 낸 같은 제목 공시의 DART 주소 */
  dartUrl: string
}

export interface PeriodDisclosures {
  /** 센 접수일 기간(YYYY-MM-DD). 이전 보고서 제출 다음 날 ~ 현재 보고서 제출일 */
  from: string
  to: string
  /** 받은 목록(최근 1년)이 기간 시작을 덮지 못해 앞부분을 세지 못했는지 */
  clipped: boolean
  /** 지분 변동·정기보고서를 뺀 수시공시 건수 */
  count: number
  /** 따로 뺀 지분 변동 건수(보유 주식 보고가 많아 수시공시를 가린다) */
  ownershipCount: number
  /** 많이 낸 제목 순(같으면 최근 순) 상위 PERIOD_TITLE_LIMIT개 */
  titles: PeriodTitle[]
}

/**
 * 두 보고서 사이에 낸 수시공시를 센다(시안 '이 기간 수시공시 N건'). 기간은 이전 보고서 제출 다음 날부터 현재 보고서 제출일까지.
 * 정기보고서와 지분 변동(5% 보고·임원 소유 보고)은 빼고, 같은 제목은 한 줄로 묶어 건수를 붙인다. 공시와 재무 변화의 인과관계는 판단하지 않는다.
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
  const ownershipCount = inPeriod.filter((item) => item.group === 'OWNERSHIP').length
  const counted = inPeriod.filter((item) => item.group !== 'OWNERSHIP' && item.group !== 'PERIODIC')

  return { from, to, clipped, count: counted.length, ownershipCount, titles: topTitles(counted) }
}

/** 같은 제목끼리 묶어 많이 낸 순(같으면 목록 순서 = 최근 순)으로 자른다 */
function topTitles(items: DisclosureItem[]): PeriodTitle[] {
  const byTitle = new Map<string, PeriodTitle>()
  for (const item of items) {
    const title = plainTitle(item.reportName)
    const seen = byTitle.get(title)
    if (seen) seen.count += 1
    else byTitle.set(title, { title, count: 1, dartUrl: item.dartUrl })
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

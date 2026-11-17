import { describe, expect, it } from 'vitest'
import { boothGuideRequest, boothGuideView, guideStage, stageState, withDoneTasks, type ResultTaskId } from './boothGuide'

describe('부스 안내 켜기', () => {
  it('?guide는 켜고 ?guide=off는 끄며, 없으면 정하지 않는다', () => {
    expect(boothGuideRequest('?guide')).toBe('open')
    expect(boothGuideRequest('?guide=1')).toBe('open')
    expect(boothGuideRequest('?q=삼성&guide=off')).toBe('off')
    expect(boothGuideRequest('?q=삼성')).toBeNull()
  })

  it('이 탭에 남긴 보기를 먼저 따르고, 없으면 부스로 들어온 탭에서만 펼친다', () => {
    expect(boothGuideView(null, false)).toBe('off')
    expect(boothGuideView(null, true)).toBe('open')
    expect(boothGuideView('folded', true)).toBe('folded')
    expect(boothGuideView('off', true)).toBe('off')
    expect(boothGuideView('open', false)).toBe('open')
    expect(boothGuideView('이상한 값', true)).toBe('open')
  })
})

describe('화면 주소로 단계 정하기', () => {
  it('첫 화면 → 기업 → 비교 확인 → 진행 → 결과 순으로 단계를 고른다', () => {
    expect(guideStage('/')).toBe('search')
    expect(guideStage('/companies/00126380')).toBe('company')
    expect(guideStage('/companies/00126380/')).toBe('company')
    expect(guideStage('/companies/00126380/compare')).toBe('compare')
    expect(guideStage('/analyses/214/progress')).toBe('progress')
    expect(guideStage('/analyses/214')).toBe('result')
  })

  it('진행 막대는 지나온 단계·지금 단계·남은 단계로 나눈다', () => {
    expect([0, 1, 2, 3, 4].map((index) => stageState(index, 2))).toEqual(['done', 'done', 'current', 'todo', 'todo'])
    expect(stageState(0, -1)).toBe('todo')
  })

  it('단계 밖의 화면은 null이다', () => {
    expect(guideStage('/notes')).toBeNull()
    expect(guideStage('/login')).toBeNull()
    expect(guideStage('/compare/companies')).toBeNull()
  })
})

describe('결과 화면에서 해 본 일', () => {
  const none: ReadonlySet<ResultTaskId> = new Set()
  const seen = (tab: string | null, chatOpen = false) => ({ tab, chatOpen })

  it('탭을 열거나 AI 에이전트를 열면 해 본 일로 더한다', () => {
    expect([...withDoneTasks(none, seen('financial'))]).toEqual(['financial'])
    expect([...withDoneTasks(none, seen('activity', true))]).toEqual(['activity', 'chat'])
  })

  it('바뀐 문장은 원문 탭의 바뀐 곳이나 원문 읽기를 열면 해 본 것이다', () => {
    expect([...withDoneTasks(none, seen('text'))]).toEqual(['text'])
    expect([...withDoneTasks(none, seen('source'))]).toEqual(['text'])
    expect(withDoneTasks(none, seen('summary')).size).toBe(0)
  })

  it('다른 탭으로 옮겨도 해 본 일은 남고, 더할 것이 없으면 같은 집합을 돌려준다', () => {
    const done = withDoneTasks(none, seen('financial'))
    const next = withDoneTasks(done, seen('summary'))
    expect(next).toBe(done)
    expect([...withDoneTasks(done, seen('activity'))]).toEqual(['financial', 'activity'])
  })
})

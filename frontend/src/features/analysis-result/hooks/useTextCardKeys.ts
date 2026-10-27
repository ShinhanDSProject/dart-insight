import { useEffect, useRef } from 'react'
import { match } from 'ts-pattern'
import { movedCardIndex, textCardKeyFor, type TextCardFocus } from '@/shared/lib/shortcuts'

/** 키보드로 옮겨 다니는 문장 변화 카드에 붙이는 속성. 값은 변경 번호(changeId) */
export const TEXT_CARD_ATTRIBUTE = 'data-text-card'

export interface TextCardKeyHandlers {
  onToggleEvidence: (changeId: number) => void
  onTogglePin: (changeId: number) => void
}

/**
 * 문장·내용 변화 탭의 카드 단축키(#311). 이 탭이 떠 있는 동안만 듣는다.
 * 키 판단은 textCardKeyFor(순수 함수)가 하고, 여기서는 카드로 초점을 옮기거나 그 카드의 근거·고정을 바꾼다.
 * 카드는 그려진 순서대로 화면에서 찾는다(더 보기로 늘어난 카드도 그대로 따라간다).
 */
export function useTextCardKeys(handlers: TextCardKeyHandlers) {
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const target = event.target instanceof HTMLElement ? event.target : null
      const card = target?.closest<HTMLElement>(`[${TEXT_CARD_ATTRIBUTE}]`) ?? null
      const focus = cardFocusOf(card, target)
      const action = textCardKeyFor(
        {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          isComposing: event.isComposing,
          repeat: event.repeat,
          target: target && { tagName: target.tagName, isContentEditable: target.isContentEditable },
        },
        { focus, dialogOpen: dialogOpen() },
      )
      if (action === null) return
      // 화살표로 화면이 함께 스크롤되지 않게 한다
      event.preventDefault()
      match(action)
        .with({ kind: 'move' }, ({ step }) => {
          const cards = Array.from(document.querySelectorAll<HTMLElement>(`[${TEXT_CARD_ATTRIBUTE}]`))
          const index = movedCardIndex(card === null ? null : cards.indexOf(card), step, cards.length)
          if (index === null) return
          cards[index].focus({ preventScroll: true })
          cards[index].scrollIntoView({ block: 'nearest' })
        })
        .with({ kind: 'toggle-evidence' }, () => {
          if (card !== null) latest.current.onToggleEvidence(changeIdOf(card))
        })
        .with({ kind: 'toggle-pin' }, () => {
          if (card !== null) latest.current.onTogglePin(changeIdOf(card))
        })
        .exhaustive()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}

/** 초점이 카드 밖인지, 카드 자체인지, 카드 안의 버튼 등인지 */
function cardFocusOf(card: HTMLElement | null, target: HTMLElement | null): TextCardFocus {
  if (card === null) return 'none'
  return card === target ? 'card' : 'inside-card'
}

function changeIdOf(card: HTMLElement): number {
  return Number(card.getAttribute(TEXT_CARD_ATTRIBUTE))
}

/** 모달 대화상자(단축키 도움말 포함)가 열려 있는지. 근거 보기 SidePanel은 모달이 아니라 단축키를 받는다 */
function dialogOpen(): boolean {
  return document.querySelector('[aria-modal="true"], dialog[open]') !== null
}

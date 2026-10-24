import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { applyParamChanges } from '@/shared/lib/searchParams'
import { shortcutFor, type ShortcutAction, type ShortcutPage, type ShortcutResultTab } from '@/shared/lib/shortcuts'

/** 단축키로 초점을 옮길 곳. 기업 검색창(SearchPage)과 AI 질문 입력창(AskTab)의 id */
const SEARCH_INPUT_ID = 'company-query'
const ASK_INPUT_ID = 'ask-input'
/** 도움말 대화상자 제목 id. 다른 대화상자가 열렸는지 볼 때 도움말은 뺀다 */
export const SHORTCUT_HELP_TITLE_ID = 'shortcut-help-title'

export interface ShortcutsController {
  helpOpen: boolean
  openHelp: () => void
  closeHelp: () => void
}

/**
 * 키보드 단축키(FS-17). Layout에 한 번만 둔다. 키 판단은 shortcutFor(순수 함수)가 하고, 여기서는 이동·초점만 옮긴다.
 * 다른 화면·탭으로 가야 하면 주소를 바꾼 뒤 그 화면이 그려지면 초점을 옮긴다(그때 입력창이 없으면 옮기지 않는다).
 */
export function useShortcuts(page: ShortcutPage): ShortcutsController {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const [helpOpen, setHelpOpen] = useState(false)
  const pendingFocus = useRef<string | null>(null)

  const latest = useRef({ page, helpOpen, search })
  useEffect(() => {
    latest.current = { page, helpOpen, search }
  })

  // 주소를 바꾼 뒤 새 화면이 그려지면 미뤄 둔 초점을 옮긴다
  useEffect(() => {
    const id = pendingFocus.current
    pendingFocus.current = null
    if (id !== null) focusById(id)
  }, [pathname, search])

  useEffect(() => {
    const goToTab = (tab: ShortcutResultTab): boolean => {
      const params = new URLSearchParams(latest.current.search)
      if (params.get('tab') === tab || (tab === 'summary' && params.get('tab') === null)) return false
      // 결과 화면의 탭 바꾸기와 같이 방문 기록을 늘리지 않는다(useQueryParams)
      navigate({ search: `?${applyParamChanges(params, { tab }).toString()}` }, { replace: true })
      return true
    }

    const run = (action: ShortcutAction) => {
      switch (action.kind) {
        case 'toggle-help':
          setHelpOpen((open) => !open)
          return
        case 'focus-search':
          if (latest.current.page === 'search') {
            focusById(SEARCH_INPUT_ID)
          } else {
            pendingFocus.current = SEARCH_INPUT_ID
            navigate('/')
          }
          return
        case 'open-tab':
          goToTab(action.tab)
          return
        case 'focus-ask':
          if (goToTab('ask')) pendingFocus.current = ASK_INPUT_ID
          else focusById(ASK_INPUT_ID)
          return
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const target = event.target instanceof HTMLElement ? event.target : null
      const action = shortcutFor(
        {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          isComposing: event.isComposing,
          repeat: event.repeat,
          target: target && { tagName: target.tagName, isContentEditable: target.isContentEditable },
        },
        { page: latest.current.page, helpOpen: latest.current.helpOpen, otherDialogOpen: otherDialogOpen() },
      )
      if (action === null) return
      // 초점을 옮긴 입력창에 / 나 a 가 그대로 써지지 않게 한다(브라우저의 / 빠른 찾기도 막는다)
      event.preventDefault()
      run(action)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  const openHelp = useCallback(() => setHelpOpen(true), [])
  const closeHelp = useCallback(() => setHelpOpen(false), [])
  return { helpOpen, openHelp, closeHelp }
}

function focusById(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.focus()
  if (el instanceof HTMLInputElement) el.select()
}

/** 도움말이 아닌 모달 대화상자가 열려 있는지(근거 보기 SidePanel은 모달이 아니라 단축키를 받는다) */
function otherDialogOpen(): boolean {
  return Array.from(document.querySelectorAll('[aria-modal="true"], dialog[open]')).some(
    (el) => el.getAttribute('aria-labelledby') !== SHORTCUT_HELP_TITLE_ID,
  )
}

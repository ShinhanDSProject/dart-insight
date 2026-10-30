import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '@/shared/ui/Button'
import { Icon, type IconName } from '@/shared/ui/Icon'
import { SegmentedControl, type SegmentOption } from '@/shared/ui/SegmentedControl'
import { useTheme } from '@/shared/hooks/useTheme'
import { THEME_OPTIONS, type ThemeChoice } from '@/shared/lib/theme'

const THEME_ICONS: Record<ThemeChoice, IconName> = { system: 'monitor', light: 'sun', dark: 'moon' }
const THEME_SEGMENTS: SegmentOption<ThemeChoice>[] = THEME_OPTIONS.map((option) => ({
  ...option,
  icon: THEME_ICONS[option.value],
}))

/**
 * 상단 바의 화면 테마(FS-16, #548). 아이콘 버튼 하나로 두고, 누르면 시스템·밝게·어둡게를 고르는 작은 상자를 연다.
 * 고르면 상자를 닫고 버튼으로 초점을 돌린다. Esc·바깥 누르기로도 닫힌다.
 */
export function ThemeMenu() {
  const theme = useTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const current = THEME_OPTIONS.find((option) => option.value === theme.choice)?.label ?? ''

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      close()
    }
  }

  return (
    <div className="theme-menu" ref={rootRef} onKeyDown={onKeyDown}>
      <Button
        ref={buttonRef}
        variant="icon"
        className="theme-menu__button"
        aria-label={`화면 테마: ${current}`}
        title={`화면 테마: ${current}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={THEME_ICONS[theme.choice]} size={18} />
      </Button>
      {open && (
        <div id={panelId} className="theme-menu__panel">
          <SegmentedControl
            options={THEME_SEGMENTS}
            value={theme.choice}
            onChange={(choice) => {
              theme.setChoice(choice)
              close()
            }}
            aria-label="화면 테마"
          />
        </div>
      )}
    </div>
  )
}

// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ShortcutPage } from '@/shared/lib/shortcuts'
import { axeViolations } from '@/test/axe'
import { ShortcutHelp } from './ShortcutHelp'

afterEach(cleanup)

describe('단축키 도움말 접근성(axe)', () => {
  it.each<ShortcutPage>(['search', 'result', 'other'])('%s 화면에서 연 도움말에 위반이 없다', async (page) => {
    const { container } = render(<ShortcutHelp page={page} onClose={() => {}} />)
    expect(await axeViolations(container)).toBe('')
  })
})

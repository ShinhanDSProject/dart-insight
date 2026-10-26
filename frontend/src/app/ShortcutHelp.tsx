import { Badge, Dialog, Kbd } from '@/shared/ui'
import { cx } from '@/shared/lib/cx'
import { shortcutGroups, type ShortcutPage } from '@/shared/lib/shortcuts'
import { SHORTCUT_HELP_TITLE_ID } from './useShortcuts'

/** 단축키 도움말(FS-17 AC3). 지금 화면에서 쓸 수 있는 묶음을 먼저 보이고, 쓸 수 없는 묶음은 흐리게 두고 쓸 수 있는 곳을 적는다 */
export function ShortcutHelp({ page, onClose }: { page: ShortcutPage; onClose: () => void }) {
  return (
    <Dialog titleId={SHORTCUT_HELP_TITLE_ID} title="키보드 단축키" onClose={onClose} className="shortcut-help">
      {shortcutGroups(page).map((group) => (
        <section
          key={group.id}
          className={cx('shortcut-help__group', !group.available && 'shortcut-help__group--unavailable')}
          aria-labelledby={`shortcut-group-${group.id}`}
        >
          <h3 className="shortcut-help__title" id={`shortcut-group-${group.id}`}>
            {group.title}
            {group.available && group.id === 'result' && <Badge tone="accent">지금 화면</Badge>}
          </h3>
          {group.note !== null && <p className="shortcut-help__note">{group.note}</p>}
          <dl className="shortcut-help__list">
            {group.items.map((item) => (
              <div key={item.label} className="shortcut-help__item">
                <dt>
                  {item.keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </dt>
                <dd>{item.label}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p className="shortcut-help__note">
        입력창에 글을 쓰는 중이거나 한글을 조합하는 중, Ctrl·Cmd·Alt를 함께 누를 때는 단축키가 동작하지 않아요.
      </p>
    </Dialog>
  )
}

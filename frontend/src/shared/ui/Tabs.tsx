export interface TabItem<T extends string> {
  value: T
  label: string
}

interface TabsProps<T extends string> {
  /** 탭 묶음의 이름(nav aria-label) */
  label: string
  items: readonly TabItem<T>[]
  value: T
  onChange: (value: T) => void
}

/**
 * 밑줄 탭. 고른 탭은 굵은 남색 글자와 밑줄.
 * 탭이 주소(?tab=)를 바꾸는 화면 이동이라 tablist가 아니라 nav와 aria-current="page"로 알린다.
 */
export function Tabs<T extends string>({ label, items, value, onChange }: TabsProps<T>) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className="tabs__item"
          aria-current={value === item.value ? 'page' : undefined}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}

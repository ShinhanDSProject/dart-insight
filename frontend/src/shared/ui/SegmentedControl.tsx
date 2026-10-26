import { Icon, type IconName } from './Icon'

export interface SegmentOption<T extends string> {
  value: T
  label: string
  /** variant="icon"에서 보여 줄 아이콘. label은 접근 가능한 이름과 툴팁이 된다 */
  icon?: IconName
}

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentOption<T>[]
  value: T
  /** 이미 고른 값을 다시 눌러도 부른다. 무시하려면 부르는 쪽에서 거른다 */
  onChange: (value: T) => void
  disabled?: boolean
  /** text: 글자 칸(기본). icon: 아이콘만 있는 작은 알약 모양(헤더 화면 테마) */
  variant?: 'text' | 'icon'
} & ({ 'aria-label': string; 'aria-labelledby'?: never } | { 'aria-labelledby': string; 'aria-label'?: never })

/** 여러 값 중 하나를 고르는 버튼 묶음. 고른 값은 aria-pressed로 알린다(role="group"). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
  variant = 'text',
  ...labelling
}: SegmentedControlProps<T>) {
  const iconOnly = variant === 'icon'
  return (
    <div className={iconOnly ? 'segmented segmented--icon' : 'segmented'} role="group" {...labelling}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__item"
          aria-pressed={value === option.value}
          aria-label={iconOnly ? option.label : undefined}
          title={iconOnly ? option.label : undefined}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {iconOnly && option.icon !== undefined ? <Icon name={option.icon} size={16} /> : option.label}
        </button>
      ))}
    </div>
  )
}

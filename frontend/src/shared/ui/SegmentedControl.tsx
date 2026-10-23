export interface SegmentOption<T extends string> {
  value: T
  label: string
}

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentOption<T>[]
  value: T
  /** 이미 고른 값을 다시 눌러도 부른다. 무시하려면 부르는 쪽에서 거른다 */
  onChange: (value: T) => void
  disabled?: boolean
} & ({ 'aria-label': string; 'aria-labelledby'?: never } | { 'aria-labelledby': string; 'aria-label'?: never })

/** 여러 값 중 하나를 고르는 버튼 묶음. 고른 값은 aria-pressed로 알린다(role="group"). */
export function SegmentedControl<T extends string>({ options, value, onChange, disabled, ...labelling }: SegmentedControlProps<T>) {
  return (
    <div className="segmented" role="group" {...labelling}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__item"
          aria-pressed={value === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

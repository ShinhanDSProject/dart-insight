import type { Company } from '@/shared/api/companies'
import { useFavoriteCompanies } from '@/shared/hooks/useFavoriteCompanies'
import { Button, Icon } from '@/shared/ui'

/**
 * 회사 이름 옆 별 버튼(FS-18 AC1). 누르면 관심 기업에 더하고, 다시 누르면 뺀다.
 * 켜짐은 색만이 아니라 aria-pressed·채운 별·글자로도 알린다.
 */
export function FavoriteToggle({ company }: { company: Company }) {
  const favorites = useFavoriteCompanies()
  const pressed = favorites.isFavorite(company.corpCode)
  return (
    <Button
      className="favorite-toggle"
      aria-pressed={pressed}
      aria-label={pressed ? `${company.corpName} 관심 기업에서 빼기` : `${company.corpName} 관심 기업에 추가`}
      onClick={() => favorites.toggle(company)}
    >
      <span className="favorite-toggle__icon" key={pressed ? 'on' : 'off'}>
        <Icon name={pressed ? 'star-filled' : 'star'} size={16} />
      </span>
      {pressed ? '관심 기업' : '관심 기업에 추가'}
    </Button>
  )
}

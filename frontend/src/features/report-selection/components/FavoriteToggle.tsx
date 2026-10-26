import { useState } from 'react'
import { match } from 'ts-pattern'
import type { Company } from '@/shared/api/companies'
import { useFavoriteCompanies } from '@/shared/hooks/useFavoriteCompanies'
import { Button, ButtonLink, Icon } from '@/shared/ui'
import { AlertState } from '@/shared/ui/StateView'

/**
 * 회사 이름 옆 별 버튼. 누르면 관심 기업에 더하고, 다시 누르면 뺀다.
 * 관심 기업은 로그인한 회원만 쓰므로(#36), 로그인하지 않았으면 로그인 화면으로 가는 링크를 보인다.
 * 켜짐은 색만이 아니라 aria-pressed·채운 별·글자로도 알린다. 목록을 받는 중이거나 서버가 답할 때까지 버튼을 막는다.
 */
export function FavoriteToggle({ company }: { company: Company }) {
  const favorites = useFavoriteCompanies()
  const [saving, setSaving] = useState<'idle' | 'saving' | 'error'>('idle')
  const pressed = favorites.isFavorite(company.corpCode)
  const toggle = () => {
    setSaving('saving')
    favorites.toggle(company).then(() => setSaving('idle'), () => setSaving('error'))
  }
  return match(favorites.status)
    .with('anonymous', () => (
      <ButtonLink className="favorite-toggle" to="/login">
        <span className="favorite-toggle__icon">
          <Icon name="star" size={16} />
        </span>
        로그인하고 관심 기업에 추가
      </ButtonLink>
    ))
    .with('error', () => (
      <Button className="favorite-toggle" onClick={favorites.reload}>
        관심 기업 다시 불러오기
      </Button>
    ))
    .with('loading', 'ready', (status) => (
      <>
        <Button
          className="favorite-toggle"
          aria-pressed={pressed}
          aria-label={pressed ? `${company.corpName} 관심 기업에서 빼기` : `${company.corpName} 관심 기업에 추가`}
          disabled={status === 'loading' || saving === 'saving'}
          onClick={toggle}
        >
          <span className="favorite-toggle__icon" key={pressed ? 'on' : 'off'}>
            <Icon name={pressed ? 'star-filled' : 'star'} size={16} />
          </span>
          {pressed ? '관심 기업' : '관심 기업에 추가'}
        </Button>
        {saving === 'error' && (
          <AlertState title="관심 기업을 바꾸지 못했어요.">잠시 뒤 다시 시도해 주세요.</AlertState>
        )}
      </>
    ))
    .exhaustive()
}

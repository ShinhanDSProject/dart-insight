import { useEffect, useId, useRef, useState } from 'react'
import { match } from 'ts-pattern'
import type { Company } from '@/shared/api/companies'
import { useFavoriteCompanies } from '@/shared/hooks/useFavoriteCompanies'
import { Button, Chip, FieldHint, FieldLabel, Icon, Input } from '@/shared/ui'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { useCompanyLookup } from '../hooks/useCompanyLookup'
import { MAX_COMPANIES } from '../model/companyComparison'
import { LOOKUP_LIMIT, MIN_LOOKUP_LENGTH } from '../model/companyPicker'

interface CompanyPickerProps {
  corps: readonly string[]
  /** 고유번호 → 화면에 보일 이름 */
  nameOf: (corpCode: string) => string
  onAdd: (company: Company) => void
  onRemove: (corpCode: string) => void
  /** 더하지 못한 이유(예: 4곳이 차 있음). 없으면 null */
  message: string | null
}

/**
 * 비교할 기업 고르기(FS-56). 고른 기업(고른 순서), 작은 검색 칸, 로그인했으면 관심 기업 바로 고르기.
 * 첫 화면 검색과 같은 검색 API를 쓴다. 4곳이 차면 더하지 않고 안내만 한다.
 * 검색 결과는 입력칸 아래에 떠서 보여, 결과가 열리고 닫힐 때 아래 표가 밀리지 않는다(#424).
 * 더하면 입력을 비우고, Esc나 바깥을 누르면 닫는다.
 */
export function CompanyPicker({ corps, nameOf, onAdd, onRemove, message }: CompanyPickerProps) {
  const inputId = useId()
  const hintId = useId()
  const favoritesId = useId()
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const lookup = useCompanyLookup(input)
  const favorites = useFavoriteCompanies()
  const showResults = open && lookup.state.status !== 'idle'

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => document.removeEventListener('mousedown', closeOutside)
  }, [open])

  function pick(company: Company) {
    onAdd(company)
    setInput('')
    setOpen(false)
  }

  return (
    <div className="company-picker">
      <div className="company-picker__selected">
        <p className="company-picker__label">
          고른 기업 {corps.length}/{MAX_COMPANIES}
        </p>
        {corps.length === 0 ? (
          <p className="field-hint">아직 고른 기업이 없어요.</p>
        ) : (
          <ol className="company-picker__list">
            {corps.map((corpCode) => (
              <li key={corpCode} className="company-picker__item">
                <span>{nameOf(corpCode)}</span>
                <Button variant="icon" aria-label={`${nameOf(corpCode)} 빼기`} onClick={() => onRemove(corpCode)}>
                  <Icon name="x" size={16} />
                </Button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="company-picker__search" ref={searchRef}>
        <FieldLabel htmlFor={inputId}>기업 더하기</FieldLabel>
        <Input
          id={inputId}
          type="search"
          value={input}
          placeholder="회사명이나 종목코드"
          aria-describedby={hintId}
          autoComplete="off"
          onChange={(event) => {
            setInput(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false)
          }}
        />
        <FieldHint id={hintId}>
          {MIN_LOOKUP_LENGTH}자 이상 입력하면 찾아요. 최대 {MAX_COMPANIES}곳까지 고를 수 있어요.
        </FieldHint>
        <p className="company-picker__message" role="status" aria-live="polite">
          {message}
        </p>
        <div className="company-picker__popover" hidden={!showResults}>
          {match(lookup.state)
            .with({ status: 'idle' }, () => null)
            .with({ status: 'loading' }, () => <LoadingState message="기업을 찾는 중이에요…" />)
            .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={lookup.reload} />)
            .with({ status: 'success' }, ({ data }) =>
              data.items.length === 0 ? (
                <p className="field-hint">'{lookup.query}'에 맞는 기업이 없어요.</p>
              ) : (
                <ul className="company-picker__results" aria-label={`'${lookup.query}' 검색 결과`}>
                  {data.items.slice(0, LOOKUP_LIMIT).map((company) => (
                    <li key={company.corpCode} className="company-picker__result">
                      <span>
                        {company.corpName}
                        <span className="company-picker__code">
                          {company.stockCode ?? '비상장'} · {company.corpCode}
                        </span>
                      </span>
                      {corps.includes(company.corpCode) ? (
                        <span className="field-hint">고름</span>
                      ) : (
                        <Button variant="secondary" aria-label={`${company.corpName} 더하기`} onClick={() => pick(company)}>
                          더하기
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ),
            )
            .exhaustive()}
        </div>
      </div>

      {favorites.status === 'ready' && favorites.items.length > 0 && (
        <div className="company-picker__favorites">
          <p className="company-picker__label" id={favoritesId}>
            관심 기업에서 고르기
          </p>
          <div className="company-picker__chips" role="group" aria-labelledby={favoritesId}>
            {favorites.items.map((company) => {
              const picked = corps.includes(company.corpCode)
              return (
                <Chip
                  key={company.corpCode}
                  pressed={picked}
                  onClick={() => (picked ? onRemove(company.corpCode) : onAdd(company))}
                >
                  {company.corpName}
                </Chip>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

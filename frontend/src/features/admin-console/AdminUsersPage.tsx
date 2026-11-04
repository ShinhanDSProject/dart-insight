import { useId, useState, type FormEvent } from 'react'
import { match } from 'ts-pattern'
import type { AdminUserItem } from '@/shared/api/admin'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { useQueryParams } from '@/shared/hooks/useQueryParams'
import { formatInteger } from '@/shared/lib/numberFormat'
import { pageTitle } from '@/shared/lib/pageTitle'
import { Badge, Button, DataTable, Icon, Input, SegmentedControl } from '@/shared/ui'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { ConsoleHeader, KpiTile, Pager } from './components/ConsoleParts'
import { useAdminOverview, useAdminUsers } from './hooks/useAdminData'
import { lastPage, normalizeQuery, parsePage, parseRole, providerLabel, PROVIDERS, shortDate } from './model/adminConsole'

type RoleFilter = 'ALL' | 'USER' | 'ADMIN'

const ROLE_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'USER', label: '회원' },
  { value: 'ADMIN', label: '관리자' },
]

/**
 * 관리자 회원 목록(FS-72 R3). 역할·검색어(닉네임 일부 또는 이메일 전체)·쪽은 주소에 둔다.
 * 이메일은 서버가 가린 값만 오고, 화면은 전체 이메일을 다루지 않는다. 위쪽 요약은 개요 API(7일)의 회원 수를 쓴다.
 */
export function AdminUsersPage() {
  useDocumentTitle(pageTitle(['운영 콘솔', '회원']))
  const { params, update } = useQueryParams()
  const role = parseRole(params.get('role'))
  const q = normalizeQuery(params.get('q'))
  const page = parsePage(params.get('page'))
  const list = useAdminUsers({ role, q, page })
  const overview = useAdminOverview(7)
  const roleLabelId = useId()
  const searchId = useId()
  const [draft, setDraft] = useState(q ?? '')

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    update({ q: normalizeQuery(draft), page: null })
  }

  return (
    <div className="console-page">
      <ConsoleHeader title="회원" lead="가입 방식과 활동만 봐요. 이메일은 가려서 보이고, 전체 이메일은 응답에도 없어요." />
      {match(overview.state)
        .with({ status: 'success' }, ({ data }) => {
          const top = [...PROVIDERS].sort((a, b) => data.users.byProvider[b] - data.users.byProvider[a])[0]
          return (
            <div className="kpi-grid kpi-grid--four">
              <KpiTile label="전체 회원" value={formatInteger(data.users.total)} detail="지금 전체" />
              <KpiTile label="7일 신규" value={formatInteger(data.users.newInPeriod)} detail={`${data.from} ~ ${data.to}`} />
              <KpiTile label="관리자" value={formatInteger(data.users.admins)} detail="운영자가 정한 이메일" />
              <KpiTile
                label="가입 방식 1위"
                value={`${providerLabel(top)} ${formatInteger(data.users.byProvider[top])}`}
                detail={PROVIDERS.filter((p) => p !== top)
                  .map((p) => `${providerLabel(p)} ${formatInteger(data.users.byProvider[p])}`)
                  .join(' · ')}
              />
            </div>
          )
        })
        // 요약은 보조 정보라 실패해도 목록을 막지 않는다
        .otherwise(() => null)}
      <div className="console-filters">
        <span id={roleLabelId} className="visually-hidden">
          역할
        </span>
        <SegmentedControl
          aria-labelledby={roleLabelId}
          options={ROLE_OPTIONS}
          value={role ?? 'ALL'}
          onChange={(value) => update({ role: value === 'ALL' ? null : value, page: null })}
        />
        <form className="console-search" role="search" aria-label="회원 찾기" onSubmit={onSearch}>
          <label htmlFor={searchId} className="visually-hidden">
            닉네임 또는 이메일 전체
          </label>
          <Icon name="search" size={16} />
          <Input
            id={searchId}
            type="search"
            value={draft}
            maxLength={50}
            placeholder="닉네임 또는 이메일 전체"
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" variant="secondary">
            찾기
          </Button>
        </form>
      </div>
      {match(list.state)
        .with({ status: 'loading' }, () => <LoadingState message="회원을 불러오는 중이에요…" />)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={list.reload} />)
        .with({ status: 'success' }, ({ data }) =>
          data.totalItems === 0 ? (
            <EmptyState title="조건에 맞는 회원이 없어요">
              <p className="console-gate-text">이메일로 찾을 때는 전체 주소를 넣어 주세요.</p>
            </EmptyState>
          ) : (
            <section className="console-card" aria-labelledby="users-title">
              <div className="console-card__head">
                <h2 className="console-card__title" id="users-title">
                  회원 {formatInteger(data.totalItems)}명
                </h2>
                <span className="console-card__note">가입 최근 순</span>
              </div>
              <DataTable caption="회원 목록. ID, 닉네임, 가린 이메일, 가입 방식, 역할, 가입일, 관심 기업 수, 글 수 순입니다." density="compact">
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">닉네임</th>
                    <th scope="col">이메일(가림)</th>
                    <th scope="col">가입 방식</th>
                    <th scope="col">역할</th>
                    <th scope="col">가입일</th>
                    <th scope="col">관심 기업</th>
                    <th scope="col">글</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((user) => (
                    <UserRow key={user.userId} user={user} />
                  ))}
                </tbody>
              </DataTable>
              <p className="console-hint">닉네임을 아직 정하지 않은 회원은 —로 보여요.</p>
              <Pager
                page={data.page}
                last={lastPage(data.totalItems, data.size)}
                total={data.totalItems}
                size={data.size}
                onChange={(next) => update({ page: next === 0 ? null : String(next + 1) })}
              />
            </section>
          ),
        )
        .exhaustive()}
    </div>
  )
}

function UserRow({ user }: { user: AdminUserItem }) {
  return (
    <tr>
      <td className="jobs__num">{user.userId}</td>
      <th scope="row">{user.nickname ?? <span className="console-muted">—</span>}</th>
      <td>{user.maskedEmail ?? <span className="console-muted">—</span>}</td>
      <td>
        <span className="badge-row">
          {user.providers.map((p) => (
            <Badge key={p}>{providerLabel(p)}</Badge>
          ))}
        </span>
      </td>
      <td>
        <Badge tone={user.role === 'ADMIN' ? 'accent' : 'neutral'}>{user.role === 'ADMIN' ? '관리자' : '회원'}</Badge>
      </td>
      <td className="jobs__num">{shortDate(user.createdAt.slice(0, 10))}</td>
      <td className="jobs__num">{formatInteger(user.favoriteCount)}</td>
      <td className="jobs__num">{formatInteger(user.postCount)}</td>
    </tr>
  )
}

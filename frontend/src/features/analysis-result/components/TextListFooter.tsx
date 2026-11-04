import { match, P } from 'ts-pattern'
import { Button } from '@/shared/ui'
import { ErrorState } from '@/shared/ui/StateView'
import { moreLabel } from '../model/textFilter'
import type { MoreState } from '../model/textList'

interface TextListFooterProps {
  loaded: number
  total: number
  more: MoreState
  onMore: () => void
}

/** 문장 변화 목록 아래의 받은 건수와 '더 보기'. 다음 쪽을 받지 못하면 다시 시도할 수 있다 */
export function TextListFooter({ loaded, total, more, onMore }: TextListFooterProps) {
  return (
    <>
      <div className="change-list__more">
        <span className="panel__note" role="status">
          {loaded} / {total}건
        </span>
        {loaded < total && (
          <Button variant="secondary" disabled={more.status === 'loading'} onClick={onMore}>
            {more.status === 'loading' ? '불러오는 중…' : moreLabel(loaded, total)}
          </Button>
        )}
      </div>
      {match(more)
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={onMore} />)
        .with({ status: P.union('idle', 'loading') }, () => null)
        .exhaustive()}
    </>
  )
}

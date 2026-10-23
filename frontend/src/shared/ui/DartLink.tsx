import { useState } from 'react'
import { verifiedDartUrl } from '@/shared/lib/dart'
import { Button, ButtonAnchor } from './Button'

type CopyState = 'idle' | 'copied' | 'failed'

interface DartLinkProps {
  rceptNo: string
  dartUrl: string | null | undefined
}

/**
 * DART 원문 열기(1.4). 새 창으로 열고, 열리지 않을 때를 위해 링크 복사와 다시 여는 방법을 함께 보여 준다.
 * 주소가 이 보고서의 접수번호를 가리키지 않으면 링크를 만들지 않는다.
 */
export function DartLinkActions({ rceptNo, dartUrl }: DartLinkProps) {
  const url = verifiedDartUrl(rceptNo, dartUrl)
  const [copy, setCopy] = useState<CopyState>('idle')

  if (url === null) {
    return (
      <p className="dart-link__help" role="status">
        원문 링크를 확인하지 못했어요. DART(dart.fss.or.kr)에서 접수번호 <code>{rceptNo}</code>로 검색해 주세요.
      </p>
    )
  }

  async function copyLink(target: string) {
    try {
      await navigator.clipboard.writeText(target)
      setCopy('copied')
    } catch {
      setCopy('failed')
    }
  }

  return (
    <div className="dart-link">
      <div className="dart-link__actions">
        <ButtonAnchor variant="secondary" href={url} target="_blank" rel="noopener noreferrer">
          DART 원문 열기 <span aria-hidden="true">↗</span>
          <span className="visually-hidden">(새 창)</span>
        </ButtonAnchor>
        <Button variant="secondary" onClick={() => void copyLink(url)}>
          링크 복사
        </Button>
        <span className="dart-link__status" role="status" aria-live="polite">
          {copy === 'copied' && '링크를 복사했어요.'}
        </span>
      </div>
      {copy === 'failed' && (
        <label className="dart-link__manual">
          복사하지 못했어요. 아래 주소를 직접 선택해 복사해 주세요.
          <input className="input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        </label>
      )}
      <p className="dart-link__help">
        새 창이 열리지 않거나 DART 화면에 오류가 나오면 잠시 뒤 다시 열어 주세요. 그래도 안 되면 링크를 복사해 브라우저
        주소창에 붙여 넣거나, DART에서 접수번호 <code>{rceptNo}</code>로 검색해 주세요.
      </p>
    </div>
  )
}

/** 표 안에서 쓰는 짧은 원문 링크. 주소를 확인하지 못하면 '확인 안 됨'. */
export function DartLinkInline({ rceptNo, dartUrl, label }: DartLinkProps & { label: string }) {
  const url = verifiedDartUrl(rceptNo, dartUrl)
  if (url === null) {
    return <span className="dart-link__help">확인 안 됨</span>
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${label} DART 원문 새 창으로 열기`}>
      열기 <span aria-hidden="true">↗</span>
    </a>
  )
}

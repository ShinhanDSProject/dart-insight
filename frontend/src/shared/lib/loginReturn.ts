/**
 * 로그인 뒤 보던 화면으로 돌아가기. 로그인 링크에 지금 주소를 ?next=로 싣고, 로그인 화면이 끝나면 그 주소로 보낸다.
 * 외부 사이트로 보내지 않도록 이 앱 안의 경로(/로 시작, //·\ 아님)만 받고, 로그인·가입·비밀번호 찾기 화면으로는 돌아가지 않는다.
 * 소셜 로그인은 제공자를 거쳐 다시 /login으로 오므로, 떠나기 전에 세션 저장소에 잠깐 남긴다.
 */
const RETURN_KEY = 'dart-insight:login-return'
const AUTH_PAGES = ['/login', '/signup', '/password-reset']

/** 돌아가도 되는 이 앱의 경로면 그대로, 아니면 null */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null
  const pathname = raw.split(/[?#]/)[0]
  if (AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))) return null
  return raw
}

/** 지금 화면(from)으로 돌아오는 로그인 주소. 돌아갈 수 없는 화면이면 그냥 /login */
export function loginPath(from: string): string {
  const next = safeReturnPath(from)
  return next === null || next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`
}

type ReturnStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function sessionStore(): ReturnStorage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** 소셜 로그인으로 떠나기 전에 돌아갈 주소를 남긴다. 저장소를 못 쓰면 첫 화면으로 돌아간다 */
export function rememberReturn(path: string | null, storage: ReturnStorage | null = sessionStore()): void {
  try {
    if (path === null) storage?.removeItem(RETURN_KEY)
    else storage?.setItem(RETURN_KEY, path)
  } catch {
    // 저장하지 못하면 로그인 뒤 첫 화면으로 간다
  }
}

/** 남겨 둔 주소를 꺼내고 지운다. 안전하지 않거나 없으면 null */
export function takeReturn(storage: ReturnStorage | null = sessionStore()): string | null {
  try {
    const raw = storage?.getItem(RETURN_KEY) ?? null
    storage?.removeItem(RETURN_KEY)
    return safeReturnPath(raw)
  } catch {
    return null
  }
}

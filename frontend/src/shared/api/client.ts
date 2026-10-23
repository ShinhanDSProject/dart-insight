/**
 * Spring Boot API 호출 모듈. 화면은 이 모듈로만 서버를 부른다.
 * 에러 응답({ code, message, traceId, errors })은 ApiError로 바꿔 던진다.
 */

export interface FieldError {
  field: string
  reason: string
}

export interface ErrorBody {
  code: string
  message: string
  traceId: string | null
  errors: FieldError[]
}

/** 서버가 응답하지 않을 때 쓰는 화면 전용 코드 */
export const NETWORK_ERROR = 'NETWORK_ERROR'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly traceId: string | null
  readonly errors: FieldError[]

  constructor(status: number, body: ErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.traceId = body.traceId
    this.errors = body.errors
  }
}

const baseUrl: string = import.meta.env.VITE_API_BASE_URL ?? ''
let accessToken: string | null = null
let refreshPromise: Promise<void> | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

type Query = Record<string, string | number | boolean | undefined | null>

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  }
  const search = params.toString()
  return `${baseUrl}${path}${search ? `?${search}` : ''}`
}

function isErrorBody(value: unknown): value is ErrorBody {
  return typeof value === 'object' && value !== null && 'code' in value && 'message' in value
}

/** 요청 옵션. signal로 화면을 떠나거나 다시 요청할 때 이전 요청을 취소한다(conventions.yaml ST-5) */
export interface RequestOptions {
  signal?: AbortSignal
}

async function requestOnce<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  query?: Query,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  let response: Response
  try {
    const headers: Record<string, string> = body === undefined
      ? { Accept: 'application/json' }
      : { Accept: 'application/json', 'Content-Type': 'application/json' }
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
      ...(options.signal ? { signal: options.signal } : {}),
    })
  } catch (error) {
    // 취소한 요청은 연결 오류로 바꾸지 않고 그대로 던진다(부른 쪽이 무시한다)
    if (options.signal?.aborted) throw error
    throw new ApiError(0, {
      code: NETWORK_ERROR,
      message: '서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
      traceId: null,
      errors: [],
    })
  }

  const text = await response.text()
  let data: unknown = null
  let parsed = text === ''
  if (text) {
    try {
      data = JSON.parse(text)
      parsed = true
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    if (isErrorBody(data)) {
      throw new ApiError(response.status, {
        code: data.code,
        message: data.message,
        traceId: data.traceId ?? response.headers.get('X-Trace-Id'),
        errors: Array.isArray(data.errors) ? data.errors : [],
      })
    }
    throw new ApiError(response.status, {
      code: 'COMMON_INTERNAL_ERROR',
      message: '서버에서 오류가 발생했습니다.',
      traceId: response.headers.get('X-Trace-Id'),
      errors: [],
    })
  }

  // 성공 응답인데 JSON이 아니면(예: API 주소가 잘못돼 화면 HTML을 받음) 성공으로 보지 않는다
  if (!parsed || (data === null && response.status !== 204)) {
    throw new ApiError(response.status, {
      code: 'COMMON_INTERNAL_ERROR',
      message: '서버 응답을 읽지 못했습니다. API 주소(VITE_API_BASE_URL) 설정을 확인해 주세요.',
      traceId: response.headers.get('X-Trace-Id'),
      errors: [],
    })
  }
  return data as T
}

async function refreshAccessToken(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${baseUrl}/api/session-refreshes`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      credentials: 'include',
      body: '{}',
    }).then(async (response) => {
      if (!response.ok) throw new Error('refresh failed')
      const session = await response.json() as { accessToken?: unknown }
      if (typeof session.accessToken !== 'string') throw new Error('invalid refresh response')
      setAccessToken(session.accessToken)
    }).finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

async function request<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  query?: Query,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  try {
    return await requestOnce<T>(method, path, query, body, options)
  } catch (error) {
    const canRefresh = error instanceof ApiError && error.status === 401 && accessToken !== null
      && path !== '/api/session-refreshes' && path !== '/api/sessions' && !options.signal?.aborted
    if (!canRefresh) throw error
    try {
      await refreshAccessToken()
    } catch {
      setAccessToken(null)
      throw error
    }
    return requestOnce<T>(method, path, query, body, options)
  }
}

export function apiGet<T>(path: string, query?: Query, options?: RequestOptions): Promise<T> {
  return request<T>('GET', path, query, undefined, options)
}

export function apiPost<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
  return request<T>('POST', path, undefined, body, options)
}

export function apiDelete(path: string, options?: RequestOptions): Promise<void> {
  return request<void>('DELETE', path, undefined, undefined, options)
}

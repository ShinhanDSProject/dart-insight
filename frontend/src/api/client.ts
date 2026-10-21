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

async function request<T>(method: 'GET' | 'POST', path: string, query?: Query, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, {
      code: NETWORK_ERROR,
      message: '서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
      traceId: null,
      errors: [],
    })
  }

  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
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

  return data as T
}

export function apiGet<T>(path: string, query?: Query): Promise<T> {
  return request<T>('GET', path, query)
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>('POST', path, undefined, body)
}

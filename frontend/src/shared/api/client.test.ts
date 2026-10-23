import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, NETWORK_ERROR, apiGet, apiPost, setAccessToken } from './client'

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

afterEach(() => {
  setAccessToken(null)
  vi.unstubAllGlobals()
})

describe('인증 갱신', () => {
  it('인증된 요청의 401은 재발급 한 번 뒤 다시 요청한다', async () => {
    setAccessToken('expired-access')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(401, { code: 'AUTH_UNAUTHORIZED', message: '만료', errors: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { userId: 1, accessToken: 'new-access', expiresIn: 900 }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiGet('/api/companies')).resolves.toEqual({ items: [] })
    expect(fetchMock.mock.calls[1][0]).toBe('/api/session-refreshes')
    expect((fetchMock.mock.calls[2][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer new-access' })
  })
})

describe('apiGet', () => {
  it('returns parsed JSON and drops empty query values', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [] }))
    vi.stubGlobal('fetch', fetchMock)

    const data = await apiGet<{ items: unknown[] }>('/api/companies', { query: '삼성', limit: undefined, page: '' })

    expect(data).toEqual({ items: [] })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/companies?query=%EC%82%BC%EC%84%B1')
  })

  it('turns an error body into ApiError with code, message, traceId and errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(400, {
          code: 'COMMON_INVALID_INPUT',
          message: '입력값을 확인해 주세요.',
          traceId: 'abc123',
          errors: [{ field: 'query', reason: '2자 이상 입력해 주세요.' }],
        }),
      ),
    )

    const error = await apiGet('/api/companies', { query: 'a' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 400,
      code: 'COMMON_INVALID_INPUT',
      message: '입력값을 확인해 주세요.',
      traceId: 'abc123',
      errors: [{ field: 'query', reason: '2자 이상 입력해 주세요.' }],
    })
  })

  it('uses a common error when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502, headers: { 'X-Trace-Id': 't-502' } })),
    )

    const error = await apiGet('/api/companies').catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 502, code: 'COMMON_INTERNAL_ERROR', traceId: 't-502' })
  })

  it('reports a network failure as NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const error = await apiGet('/api/companies').catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 0, code: NETWORK_ERROR })
  })
})

describe('apiPost', () => {
  it('sends a JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(202, { analysisId: 1 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiPost('/api/analyses', { corpCode: '00126380' })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"corpCode":"00126380"}')
  })
})

describe('non-JSON success', () => {
  it('is not treated as success (e.g. index.html returned for a wrong API address)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<!doctype html><html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } })),
    )

    const error = await apiGet('/api/companies').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('COMMON_INTERNAL_ERROR')
  })
})

describe('요청 취소', () => {
  it('signal을 fetch에 넘긴다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await apiGet('/api/companies', undefined, { signal: controller.signal })

    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBe(controller.signal)
  })

  it('취소한 요청은 연결 오류(NETWORK_ERROR)로 바꾸지 않고 원래 오류를 던진다', async () => {
    const controller = new AbortController()
    const abortError = new DOMException('aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError))
    controller.abort()

    const error = await apiGet('/api/companies', undefined, { signal: controller.signal }).catch((e: unknown) => e)

    expect(error).toBe(abortError)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, NETWORK_ERROR, apiGet, apiPost } from './client'

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
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

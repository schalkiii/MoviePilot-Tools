import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  cache: {} as Record<string, unknown>,
  publicStore: { schema: 1 } as Record<string, unknown>,
  getPublicStoreCalls: 0,
}))

vi.mock('../core/http', () => ({
  api: {
    get: vi.fn(),
  },
}))

vi.mock('../core/store-repository', () => ({
  getPublicStore: vi.fn(async () => {
    state.getPublicStoreCalls += 1
    return structuredClone(state.publicStore)
  }),
  updatePublicStore: vi.fn(async () => structuredClone(state.publicStore)),
  storeRepository: {
    getCache: vi.fn(async (key: string) => structuredClone(state.cache[key] ?? null)),
    setCache: vi.fn(async (key: string, value: unknown) => {
      state.cache[key] = structuredClone(value)
    }),
  },
}))

vi.mock('../core/private-vault', () => ({
  getPrivateStore: vi.fn(async () => ({ schema: 1 })),
  updatePrivateStore: vi.fn(async () => ({ schema: 1 })),
}))

import { api } from '../core/http'

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  state.cache = {}
  state.publicStore = { schema: 1 }
  state.getPublicStoreCalls = 0
})

describe('站点首屏缓存与批量状态', () => {
  it('适配目录跨弹窗上下文从持久缓存恢复', async () => {
    state.cache.siteSupporting = {
      'example.com': { id: 1, name: '示例站', domain: 'example.com' },
    }
    const { fetchSupportingSites, loadCachedSupportingSites } = await import(
      '../services/site-supporting'
    )

    await expect(loadCachedSupportingSites()).resolves.toEqual(state.cache.siteSupporting)
    await expect(fetchSupportingSites()).resolves.toEqual(state.cache.siteSupporting)
    expect(api.get).not.toHaveBeenCalled()
  })

  it('强制刷新成功后更新适配目录快照', async () => {
    const { fetchSupportingSites } = await import('../services/site-supporting')
    vi.mocked(api.get).mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: {
        'new.example.com': { id: 2, name: '新站' },
      },
    })

    await expect(fetchSupportingSites(true)).resolves.toEqual({
      'new.example.com': {
        id: 2,
        name: '新站',
        domain: 'new.example.com',
      },
    })
    expect(api.get).toHaveBeenCalledWith('/api/v1/site/supporting')
    expect(state.cache.siteSupporting).toEqual({
      'new.example.com': {
        id: 2,
        name: '新站',
        domain: 'new.example.com',
      },
    })
  })

  it('一次读取公共存储批量补齐站点禁用状态', async () => {
    state.publicStore = {
      schema: 1,
      sites: {
        disabledIds: [1, 3],
        autoUpdateDisabledIds: [2],
      },
    }
    const { withSiteDisableStates } = await import('../services/site-manage')

    await expect(
      withSiteDisableStates([
        { id: 1, name: 'A', domain: 'a.example.com' },
        { id: 2, name: 'B', domain: 'b.example.com' },
        { id: 3, name: 'C', domain: 'c.example.com' },
        { id: 4, name: 'D', domain: 'd.example.com' },
      ]),
    ).resolves.toEqual([
      expect.objectContaining({ id: 1, isDisabled: true, isUpdateDisabled: false }),
      expect.objectContaining({ id: 2, isDisabled: false, isUpdateDisabled: true }),
      expect.objectContaining({ id: 3, isDisabled: true, isUpdateDisabled: false }),
      expect.objectContaining({ id: 4, isDisabled: false, isUpdateDisabled: false }),
    ])
    expect(state.getPublicStoreCalls).toBe(1)
  })
})

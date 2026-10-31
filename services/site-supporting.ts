import { api } from '../core/http'
import { storeRepository } from '../core/store-repository'
import type { SiteSupportingInfo } from '../core/types'

export type SupportingDict = Record<string, SiteSupportingInfo>

const SUPPORTING_CACHE_KEY = 'siteSupporting'
const SUPPORTING_CACHE_TTL_MS = 30 * 60 * 1000

let supportingCache: SupportingDict | null = null
let supportingRequest: Promise<SupportingDict> | null = null

function unwrapSupportingData(data: unknown): Record<string, Omit<SiteSupportingInfo, 'domain'>> | null {
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>
  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    return obj.data as Record<string, Omit<SiteSupportingInfo, 'domain'>>
  }
  if (!Array.isArray(data)) {
    return data as Record<string, Omit<SiteSupportingInfo, 'domain'>>
  }
  return null
}

/** 读取跨 popup 上下文的适配目录快照，仅用于首屏展示。 */
export async function loadCachedSupportingSites(): Promise<SupportingDict | null> {
  if (supportingCache) return supportingCache
  try {
    const cached = await storeRepository.getCache<SupportingDict>(SUPPORTING_CACHE_KEY)
    if (cached && typeof cached === 'object') {
      supportingCache = cached
      return supportingCache
    }
  } catch {
    /* 缓存损坏或不可用时回退到网络请求。 */
  }
  return null
}

/**
 * 获取已适配站点字典，并补齐每项的 canonical `domain`。
 * 成功结果在当前扩展上下文内缓存，并写入本地 TTL 快照供下次弹窗立即展示；
 * 并发请求共享同一个 Promise。`force` 跳过成功缓存并强制刷新网络数据。
 */
export async function fetchSupportingSites(force = false): Promise<SupportingDict> {
  if (!force && supportingCache) return supportingCache
  if (supportingRequest) return supportingRequest

  supportingRequest = api
    .get<unknown>('/api/v1/site/supporting')
    .then(async (res) => {
      const dict = unwrapSupportingData(res.data)
      if (!res.ok || !dict) return supportingCache || {}
      supportingCache = Object.fromEntries(
        Object.entries(dict)
          .filter(([key]) => key !== 'success' && key !== 'message' && key !== 'data')
          .map(([domain, info]) => [domain, { ...info, domain }]),
      )
      await storeRepository.setCache(SUPPORTING_CACHE_KEY, supportingCache, SUPPORTING_CACHE_TTL_MS)
      return supportingCache
    })
    .catch(() => supportingCache || {})
    .finally(() => {
      supportingRequest = null
    })
  return supportingRequest
}

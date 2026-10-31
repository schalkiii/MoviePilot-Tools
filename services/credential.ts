import { bufToB64, deriveAesKey, randomBytes, sha256Hex } from '../core/crypto'
import { getPrivateStore, updatePrivateStore } from '../core/private-vault'
import { getPublicStore, updatePublicStore } from '../core/store-repository'
import type { CredentialCategory, CredentialGroup, PtCredential, SiteBlacklistEntry } from '../core/types'
import { isPrivateHost } from '../utils/url'
import {
  buildDomainAliasIndex,
  domainsMatch,
  fetchSupportingDomains,
  findSiteIdsByDomain,
  loadCustomDomainAliases,
} from './site-domain-alias'
import { clearPinSessionUnlocked, isPinSessionUnlocked, markPinSessionUnlocked } from '../core/pin-session'

let pinKey: CryptoKey | null = null
let runtimeCredentials: PtCredential[] | null = null

function normalizeCredentialCategory(item: PtCredential): CredentialCategory {
  if (item.category === 'pt' || item.category === 'intranet' || item.category === 'custom') {
    return item.category
  }
  if (isPrivateHost(item.domain)) return 'intranet'
  return item.domain ? 'pt' : 'custom'
}

function normalizeCredential(item: PtCredential): PtCredential {
  return {
    ...item,
    id: item.id || crypto.randomUUID(),
    password: item.password || '',
    category: normalizeCredentialCategory(item),
  }
}

function normalizeCredentialGroup(item: CredentialGroup): CredentialGroup | null {
  const id = item.id?.trim()
  const name = item.name?.trim()
  if (!id || !name) return null
  return { ...item, id, name }
}

export async function setPin(pin: string, frequency: 'session' | 'always' = 'session'): Promise<void> {
  if (!pin) throw new Error('PIN 不能为空')
  const salt = randomBytes(16)
  const pinSalt = bufToB64(salt)
  const pinHash = await sha256Hex(pin + pinSalt)
  await updatePrivateStore((draft) => {
    draft.security = {
      pinSalt,
      pinHash,
      pinFrequency: frequency === 'always' ? 'always' : undefined,
    }
  })
  pinKey = await deriveAesKey(pin, salt)
  runtimeCredentials = await loadPtCredentials()
  if (frequency === 'session') await markPinSessionUnlocked()
  else await clearPinSessionUnlocked()
}

export async function verifyPin(pin: string): Promise<boolean> {
  const security = (await getPrivateStore()).security
  if (!security?.pinSalt || !security.pinHash) return false
  try {
    const candidate = await sha256Hex(pin + security.pinSalt)
    return timingSafeEqual(candidate, security.pinHash)
  } catch {
    return false
  }
}

export async function unlock(pin: string): Promise<boolean> {
  const security = (await getPrivateStore()).security
  if (!security?.pinSalt || !security.pinHash || !(await verifyPin(pin))) return false
  try {
    const salt = Uint8Array.from(atob(security.pinSalt), (char) => char.charCodeAt(0))
    pinKey = await deriveAesKey(pin, salt)
    runtimeCredentials = await loadPtCredentials()
    if ((security.pinFrequency || 'session') === 'session') await markPinSessionUnlocked()
    else await clearPinSessionUnlocked()
    return true
  } catch {
    return false
  }
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index]
  return diff === 0
}

export function lock(): void {
  pinKey = null
  runtimeCredentials = null
}

export async function lockAndClearSession(): Promise<void> {
  lock()
  await clearPinSessionUnlocked()
}

export async function hasPin(): Promise<boolean> {
  return !!(await getPrivateStore()).security?.pinHash
}

export function isUnlocked(): boolean {
  return pinKey !== null
}

export async function pinFrequency(): Promise<'session' | 'always'> {
  return (await getPrivateStore()).security?.pinFrequency || 'session'
}

export async function setPinFrequency(frequency: 'session' | 'always'): Promise<void> {
  await updatePrivateStore((draft) => {
    if (!draft.security) return
    draft.security.pinFrequency = frequency === 'always' ? 'always' : undefined
  })
  if (frequency === 'always') runtimeCredentials = null
}

export async function disablePin(): Promise<void> {
  pinKey = null
  runtimeCredentials = null
  await clearPinSessionUnlocked()
  await updatePrivateStore((draft) => {
    delete draft.security
  })
}

export async function tryRestoreSessionUnlock(): Promise<boolean> {
  if ((await pinFrequency()) !== 'session') return false
  if (!(await isPinSessionUnlocked())) return false
  runtimeCredentials = await loadPtCredentials()
  return true
}

export async function clearSessionUnlock(): Promise<void> {
  runtimeCredentials = null
  await clearPinSessionUnlocked()
}

function scheduleAutoBackup(): void {
  void import('./webdav')
    .then((module) => module.scheduleAutoBackupOnChange())
    .catch(() => undefined)
  void import('./mp-backup')
    .then((module) => module.scheduleMpAutoBackupOnChange())
    .catch(() => undefined)
}

export async function savePtCredentials(list: PtCredential[]): Promise<void> {
  const normalized = list.map(normalizeCredential)
  await updatePrivateStore((draft) => {
    draft.vault = { ...(draft.vault || {}), credentials: normalized }
  })
  runtimeCredentials = normalized
  scheduleAutoBackup()
}

export async function loadPtCredentials(): Promise<PtCredential[]> {
  return ((await getPrivateStore()).vault?.credentials || []).map(normalizeCredential)
}

export async function loadCredentialGroups(): Promise<CredentialGroup[]> {
  return ((await getPrivateStore()).vault?.credentialGroups || [])
    .map(normalizeCredentialGroup)
    .filter((item): item is CredentialGroup => !!item)
}

export async function saveCredentialGroups(groups: CredentialGroup[]): Promise<void> {
  const normalized = groups
    .map(normalizeCredentialGroup)
    .filter((item): item is CredentialGroup => !!item)
  await updatePrivateStore((draft) => {
    draft.vault = { ...(draft.vault || {}), credentialGroups: normalized }
  })
  scheduleAutoBackup()
}

export async function saveRuntimeCredentials(list: PtCredential[]): Promise<void> {
  runtimeCredentials = list.map(normalizeCredential)
  await savePtCredentials(runtimeCredentials)
}

export async function loadRuntimeCredentials(): Promise<PtCredential[]> {
  // Service Worker、popup/sidepanel 分属独立 JS 上下文，模块级缓存不会跨上下文同步。
  // 每次按域名自动填充都从 Device 信封读取最新凭据，避免后台长期持有旧的空数组或旧值。
  runtimeCredentials = await loadPtCredentials()
  return runtimeCredentials.map((item) => ({ ...item }))
}

export async function reconcileCredentialsAfterUnlock(): Promise<void> {
  runtimeCredentials = await loadPtCredentials()
}

export function normalizeCredentialHost(raw?: string): string {
  const input = (raw || '').trim().toLowerCase()
  if (!input) return ''
  try {
    const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`
    return new URL(withProtocol).hostname.replace(/^www\./, '').replace(/^\./, '')
  } catch {
    return input
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .replace(/^www\./, '')
      .replace(/^\./, '')
  }
}

function normalizeCredentialOrigin(raw?: string): string {
  const input = (raw || '').trim()
  if (!input) return ''
  try {
    const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`
    const url = new URL(withProtocol)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return `${url.protocol}//${url.host}`
  } catch {
    return ''
  }
}

/** 域名匹配保持 PT 别名/子域语义，非默认端口必须一致；空端口仅表示默认端口。 */
function credentialLocationMatches(credentialDomain: string, target: string): boolean {
  const credentialOrigin = normalizeCredentialOrigin(credentialDomain)
  const targetOrigin = normalizeCredentialOrigin(target)
  if (!credentialOrigin || !targetOrigin) return false
  const credentialUrl = new URL(credentialOrigin)
  const targetUrl = new URL(targetOrigin)
  return credentialUrl.port === targetUrl.port && domainsMatch(credentialUrl.hostname, targetUrl.hostname)
}

export async function getCredentialByHost(host: string): Promise<PtCredential | null> {
  const target = normalizeCredentialHost(host)
  if (!target) return null
  const credentials = await loadRuntimeCredentials()
  const direct = credentials.filter((credential) => credentialLocationMatches(credential.domain, host))
  if (direct.length === 1) return direct[0]
  if (direct.length > 1) return null

  try {
    const [supporting, customAliases] = await Promise.all([
      fetchSupportingDomains(),
      loadCustomDomainAliases(),
    ])
    const index = buildDomainAliasIndex(supporting, customAliases)
    const targetSiteIds = findSiteIdsByDomain(index, target)
    if (targetSiteIds.length !== 1) return null

    const matched = credentials.filter((credential) => {
      if (!credentialLocationMatches(credential.domain, host)) return false
      const credentialSiteIds = findSiteIdsByDomain(index, credential.domain)
      return credentialSiteIds.length === 1 && credentialSiteIds[0] === targetSiteIds[0]
    })
    return matched.length === 1 ? matched[0] : null
  } catch {
    return null
  }
}

export async function addOrUpdateCredentialFromLogin(input: {
  domain: string
  username: string
  password: string
  name?: string
}): Promise<'created' | 'updated'> {
  const storeDomain = normalizeCredentialOrigin(input.domain)
  const host = normalizeCredentialHost(storeDomain)
  const username = input.username.trim()
  if (!host || !storeDomain) throw new Error('域名无效')
  if (!username || !input.password) throw new Error('账号或密码为空')

  let name = input.name?.trim() || host
  let category: CredentialCategory = isPrivateHost(storeDomain) ? 'intranet' : 'custom'
  try {
    const fill = await import('./credential-site').then((module) =>
      module.resolveCredentialSiteFill(storeDomain, input.name),
    )
    name = fill.name || name
    category = fill.category
  } catch {
    // 使用页面名称和自定义分类
  }

  const list = await loadPtCredentials()
  const index = list.findIndex(
    (credential) =>
      credentialLocationMatches(credential.domain, storeDomain) &&
      credential.username.trim().toLowerCase() === username.toLowerCase(),
  )
  const now = new Date().toISOString()
  let action: 'created' | 'updated' = 'created'
  if (index >= 0) {
    const previous = list[index]
    list[index] = {
      ...previous,
      domain: previous.domain || storeDomain,
      username,
      password: input.password,
      name: previous.name || name,
      category: previous.category || category,
      updatedAt: now,
    }
    action = 'updated'
  } else {
    list.push({
      id: crypto.randomUUID(),
      domain: storeDomain,
      username,
      password: input.password,
      name,
      category,
      autoSaveEnabled: true,
      autoFillEnabled: true,
      createdAt: now,
      updatedAt: now,
    })
  }
  await savePtCredentials(list)
  return action
}

export async function loadBlacklist(): Promise<SiteBlacklistEntry[]> {
  const entries = (await getPublicStore()).sites?.blacklist || []
  return entries.map((entry) => ({
    id: entry.id,
    domain: entry.domain,
    name: entry.name,
    blockLoginFill: !!entry.blockLoginFill,
    blockCaptchaFill: !!entry.blockCaptchaFill,
    blockCredentialSavePrompt: !!entry.blockCredentialSavePrompt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }))
}

export async function saveBlacklist(list: SiteBlacklistEntry[]): Promise<void> {
  await updatePublicStore((draft) => {
    draft.sites = {
      ...(draft.sites || {}),
      blacklist: list.map((entry) => ({
        id: entry.id,
        domain: entry.domain,
        name: entry.name,
        blockLoginFill: entry.blockLoginFill || undefined,
        blockCaptchaFill: entry.blockCaptchaFill || undefined,
        blockCredentialSavePrompt: entry.blockCredentialSavePrompt || undefined,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      })),
    }
  })
}

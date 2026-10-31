import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  privateStore: { schema: 1 } as Record<string, unknown>,
}))

vi.mock('../core/private-vault', () => ({
  getPrivateStore: vi.fn(async () => structuredClone(mocks.privateStore)),
  updatePrivateStore: vi.fn(async (mutator: (draft: Record<string, unknown>) => void) => {
    const draft = structuredClone(mocks.privateStore)
    mutator(draft)
    mocks.privateStore = draft
    return structuredClone(draft)
  }),
}))

vi.mock('../core/store-repository', () => ({
  getPublicStore: vi.fn(async () => ({ schema: 1 })),
  updatePublicStore: vi.fn(async () => ({ schema: 1 })),
}))

vi.mock('../core/pin-session', () => ({
  clearPinSessionUnlocked: vi.fn(async () => undefined),
  isPinSessionUnlocked: vi.fn(async () => false),
  markPinSessionUnlocked: vi.fn(async () => undefined),
}))

vi.mock('../services/credential-site', () => ({
  resolveCredentialSiteFill: vi.fn(async () => ({
    category: 'intranet' as const,
    name: '本地服务',
    isPt: false,
  })),
}))

vi.mock('../services/site-domain-alias', () => {
  const normalize = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .split('/')[0]
  return {
    buildDomainAliasIndex: vi.fn(() => ({ aliasesBySiteId: new Map(), siteIdsByDomain: new Map() })),
    domainsMatch: vi.fn((left: string, right: string) => {
      const a = normalize(left)
      const b = normalize(right)
      return Boolean(a && b && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)))
    }),
    fetchSupportingDomains: vi.fn(async () => ({})),
    findSiteIdsByDomain: vi.fn(() => []),
    loadCustomDomainAliases: vi.fn(async () => []),
    normalizeDomain: vi.fn(normalize),
  }
})

vi.mock('../services/webdav', () => ({
  scheduleAutoBackupOnChange: vi.fn(),
}))

vi.mock('../services/mp-backup', () => ({
  scheduleMpAutoBackupOnChange: vi.fn(),
}))

import {
  addOrUpdateCredentialFromLogin,
  getCredentialByHost,
} from '../services/credential'

afterEach(() => {
  mocks.privateStore = { schema: 1 }
})

describe('后台凭据运行时读取', () => {
  it('后台曾读取空列表后仍能发现其他扩展上下文新保存的凭据', async () => {
    expect(await getCredentialByHost('zq.example-pt.test')).toBeNull()

    mocks.privateStore = {
      schema: 1,
      vault: {
        credentials: [
          {
            id: 'zq-example',
            domain: 'https://zq.example-pt.test',
            username: 'zq-example-user',
            password: 'zq-example-password',
            autoFillEnabled: true,
          },
        ],
      },
    }

    await expect(getCredentialByHost('zq.example-pt.test')).resolves.toEqual(
      expect.objectContaining({
        domain: 'https://zq.example-pt.test',
        username: 'zq-example-user',
        password: 'zq-example-password',
      }),
    )
  })

  it('每次查询都能读取其他上下文更新后的密码', async () => {
    mocks.privateStore = {
      schema: 1,
      vault: {
        credentials: [
          {
            id: 'zq-example',
            domain: 'zq.example-pt.test',
            username: 'user',
            password: 'old-password',
          },
        ],
      },
    }
    expect((await getCredentialByHost('zq.example-pt.test'))?.password).toBe('old-password')

    const credentials = (mocks.privateStore.vault as { credentials: Array<Record<string, unknown>> })
      .credentials
    credentials[0].password = 'new-password'

    expect((await getCredentialByHost('zq.example-pt.test'))?.password).toBe('new-password')
  })

  it('本机多端口凭据互不匹配', async () => {
    mocks.privateStore = {
      schema: 1,
      vault: {
        credentials: [
          {
            id: 'port-9091',
            domain: 'http://127.0.0.1:9091',
            username: 'user',
            password: 'password-9091',
          },
          {
            id: 'port-9092',
            domain: 'http://127.0.0.1:9092',
            username: 'user',
            password: 'password-9092',
          },
        ],
      },
    }

    expect((await getCredentialByHost('http://127.0.0.1:9091'))?.id).toBe('port-9091')
    expect((await getCredentialByHost('http://127.0.0.1:9092'))?.id).toBe('port-9092')
    await expect(getCredentialByHost('http://127.0.0.1')).resolves.toBeNull()
  })

  it('无端口记录只匹配默认端口页面', async () => {
    mocks.privateStore = {
      schema: 1,
      vault: {
        credentials: [
          {
            id: 'default-port',
            domain: 'https://localhost',
            username: 'user',
            password: 'default-password',
          },
        ],
      },
    }

    expect((await getCredentialByHost('https://localhost'))?.id).toBe('default-port')
    expect((await getCredentialByHost('http://localhost'))?.id).toBe('default-port')
    await expect(getCredentialByHost('http://localhost:9091')).resolves.toBeNull()
    await expect(getCredentialByHost('https://localhost:9092')).resolves.toBeNull()
  })

  it('相同用户名在不同端口创建独立凭据并仅更新对应端口', async () => {
    await expect(
      addOrUpdateCredentialFromLogin({
        domain: 'http://127.0.0.1:9091',
        username: 'admin',
        password: 'first-password',
      }),
    ).resolves.toBe('created')
    await expect(
      addOrUpdateCredentialFromLogin({
        domain: 'http://127.0.0.1:9092',
        username: 'admin',
        password: 'second-password',
      }),
    ).resolves.toBe('created')

    let credentials = (mocks.privateStore.vault as { credentials: Array<Record<string, unknown>> })
      .credentials
    expect(credentials).toHaveLength(2)
    expect(credentials.map((item) => item.domain)).toEqual([
      'http://127.0.0.1:9091',
      'http://127.0.0.1:9092',
    ])

    await expect(
      addOrUpdateCredentialFromLogin({
        domain: 'http://127.0.0.1:9091',
        username: 'admin',
        password: 'updated-password',
      }),
    ).resolves.toBe('updated')

    credentials = (mocks.privateStore.vault as { credentials: Array<Record<string, unknown>> })
      .credentials
    expect(credentials).toHaveLength(2)
    expect((await getCredentialByHost('http://127.0.0.1:9091'))?.password).toBe('updated-password')
    expect((await getCredentialByHost('http://127.0.0.1:9092'))?.password).toBe('second-password')
  })
})

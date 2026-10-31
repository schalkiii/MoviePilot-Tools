// PT 凭据：登录检测、保存/更新提示、自动填充
// 规则：
// - 站点无凭据 → 提示「保存凭据」
// - 已有凭据且账号+密码完全一致 → 不提示
// - 已有凭据但账号或密码不一致 → 提示「更新站点凭据」
import { MSG, sendMessage } from '../core/bus'

import { loadBlacklist } from '../services/credential'
import { getPublicStore } from '../core/store-repository'
import { domainsMatch } from '../services/site-domain-alias'

interface CredLite {
  username: string
  password: string
  name?: string
  domain: string
  autoSaveEnabled?: boolean
  autoFillEnabled?: boolean
}

export function initPtCreds(): void {
  if (window.self !== window.top) return
  void bootstrap()
}

async function bootstrap(): Promise<void> {
  const origin = location.origin
  const rules = await getBlacklistRules(origin)

  // 登录提交检测：始终挂载（是否弹窗由后续规则决定）
  setupLoginDetection()
  // 页面加载后若已登录成功（密码框消失）也检查一次
  window.setTimeout(() => void checkLoginSuccessAndPrompt(), 800)

  if (!rules.blockLoginFill) {
    void tryAutoFill(origin)
  }
}

function normalizeHost(raw?: string): string {
  const input = (raw || '').trim().toLowerCase()
  if (!input) return ''
  try {
    const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`
    return new URL(withProto).hostname.replace(/^www\./, '').replace(/^\./, '')
  } catch {
    return input
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .replace(/^www\./, '')
      .replace(/^\./, '')
  }
}

function hostMatches(a: string, b: string): boolean {
  return domainsMatch(a, b)
}

async function getBlacklistRules(domain: string): Promise<{
  blockLoginFill: boolean
  blockCredentialSavePrompt: boolean
}> {
  try {
    const list = await loadBlacklist()
    const host = normalizeHost(domain)
    const matched = list.find((e) => hostMatches(normalizeHost(e.domain), host))
    return {
      blockLoginFill: matched ? matched.blockLoginFill !== false : false,
      blockCredentialSavePrompt: matched
        ? matched.blockCredentialSavePrompt === true
        : false,
    }
  } catch {
    return { blockLoginFill: false, blockCredentialSavePrompt: false }
  }
}

async function fetchCred(domain: string): Promise<CredLite | null> {
  try {
    const data = await sendMessage<{ credential: CredLite | null }>(MSG.PT_GET_CRED, {
      domain,
    })
    return data?.credential || null
  } catch {
    return null
  }
}

function findLoginFields(): {
  userInput: HTMLInputElement | null
  pwInput: HTMLInputElement | null
} {
  try {
    const inputs = Array.from(document.querySelectorAll('input')) as HTMLInputElement[]
    let pwInput =
      inputs.find((i) => i.type === 'password' && (i.offsetWidth > 0 || i.offsetHeight > 0)) ||
      null
    if (!pwInput) pwInput = inputs.find((i) => i.type === 'password') || null
    if (!pwInput) return { userInput: null, pwInput: null }

    const eligible = inputs.filter((input) => {
      if (input === pwInput) return false
      const type = (input.type || 'text').toLowerCase()
      if (
        ['password', 'checkbox', 'radio', 'submit', 'button', 'hidden', 'file', 'image', 'reset'].includes(
          type,
        )
      ) {
        return false
      }
      return input.offsetWidth > 0 || input.offsetHeight > 0
    })
    if (!eligible.length) return { userInput: null, pwInput }

    const criteria = [
      (input: HTMLInputElement) =>
        /user|login|member|mail|phone|username|email/i.test(input.name || '') ||
        /user|login|member|mail|phone|username|email/i.test(input.id || ''),
      (input: HTMLInputElement) => /用户名|账号|邮箱|手机|登/i.test(input.placeholder || ''),
      () => true,
    ]
    for (const c of criteria) {
      const m = eligible.find(c)
      if (m) return { userInput: m, pwInput }
    }
    return { userInput: eligible[0] || null, pwInput }
  } catch {
    return { userInput: null, pwInput: null }
  }
}

function hasVisiblePasswordInput(): boolean {
  try {
    return Array.from(document.querySelectorAll('input[type="password"]')).some((el) => {
      const i = el as HTMLInputElement
      return i.offsetWidth > 0 || i.offsetHeight > 0
    })
  } catch {
    return false
  }
}

export function setCredentialInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  if (setter) setter.call(input, value)
  else input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function fillCredentials(username: string, password: string): boolean {
  const { userInput, pwInput } = findLoginFields()
  if (!pwInput) return false
  try {
    // 浏览器密码管理器若已填充值则保持原值；仅密码凭据不要求存在用户名输入框。
    if (username && userInput && !userInput.value) setCredentialInputValue(userInput, username)
    if (!pwInput.value) setCredentialInputValue(pwInput, password)
    return !!pwInput.value && (!username || !!userInput?.value)
  } catch {
    return false
  }
}

async function tryAutoFill(origin: string): Promise<void> {
  const cred = await fetchCred(origin)
  if (!cred?.password) return
  if (cred.autoFillEnabled === false) return

  let stableSince = 0
  let stopped = false
  let timer = 0
  const observer = new MutationObserver(() => attempt())
  const stop = () => {
    if (stopped) return
    stopped = true
    observer.disconnect()
    if (timer) window.clearInterval(timer)
  }
  const attempt = () => {
    if (stopped) return
    if (!fillCredentials(cred.username, cred.password)) {
      stableSince = 0
      return
    }
    if (!stableSince) stableSince = Date.now()
    // React/Ant Design 初始化可能在首次填充后重置受控值；稳定一段时间后再停止重试。
    if (Date.now() - stableSince >= 1200) stop()
  }

  observer.observe(document.documentElement || document.body, { childList: true, subtree: true })
  attempt()
  timer = window.setInterval(attempt, 250)
  window.setTimeout(stop, 10000)
}

function setupLoginDetection(): void {
  let checkTimeout: number | undefined

  const updatePendingFromFields = () => {
    const { userInput, pwInput } = findLoginFields()
    if (userInput && pwInput && userInput.value.trim() && pwInput.value.trim()) {
      try {
        sessionStorage.setItem('mp_pending_username', userInput.value.trim())
        sessionStorage.setItem('mp_pending_password', pwInput.value.trim())
        sessionStorage.setItem('mp_pending_domain', location.origin)
        sessionStorage.setItem('mp_pending_time', String(Date.now()))
      } catch {
        /* 页面存储不可用时跳过本次凭据暂存，后续输入事件仍可重试。 */
      }
    }
  }

  const triggerDeferredSuccessCheck = () => {
    if (checkTimeout) window.clearTimeout(checkTimeout)
    checkTimeout = window.setTimeout(() => {
      void checkLoginSuccessAndPrompt()
    }, 1500)
  }

  document.addEventListener(
    'blur',
    (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') updatePendingFromFields()
    },
    true,
  )
  document.addEventListener(
    'change',
    (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') updatePendingFromFields()
    },
    true,
  )
  document.addEventListener(
    'submit',
    () => {
      updatePendingFromFields()
      triggerDeferredSuccessCheck()
    },
    true,
  )
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName === 'INPUT') {
        updatePendingFromFields()
        triggerDeferredSuccessCheck()
      }
    },
    true,
  )
  document.addEventListener(
    'click',
    (e) => {
      let el = e.target as HTMLElement | null
      let isSubmitBtn = false
      for (let i = 0; i < 4 && el; i++) {
        const text = (el.textContent || '').trim()
        const value = el instanceof HTMLInputElement ? el.value : ''
        const clickable =
          el.tagName === 'BUTTON' ||
          el.tagName === 'A' ||
          (el.tagName === 'INPUT' &&
            ['submit', 'button'].includes((el as HTMLInputElement).type)) ||
          el.classList.contains('btn') ||
          el.style.cursor === 'pointer'
        if (
          clickable &&
          (/登\s*录|登\s*陆|提\s*交|login|sign\s*in|submit|确\s*定|进\s*入/i.test(text) ||
            /登\s*录|登\s*陆|提\s*交|login|sign\s*in|submit|确\s*定|进\s*入/i.test(value) ||
            el.matches('button[type="submit"], input[type="submit"]'))
        ) {
          isSubmitBtn = true
          break
        }
        el = el.parentElement
      }
      if (isSubmitBtn) {
        updatePendingFromFields()
        triggerDeferredSuccessCheck()
      }
    },
    true,
  )
}

function clearPendingCreds(): void {
  try {
    sessionStorage.removeItem('mp_pending_username')
    sessionStorage.removeItem('mp_pending_password')
    sessionStorage.removeItem('mp_pending_domain')
    sessionStorage.removeItem('mp_pending_time')
  } catch {
    /* 页面存储不可用时无法清理暂存凭据，过期时间仍会阻止其后续使用。 */
  }
}

/**
 * 登录成功后决定是否弹窗：
 * 1) 黑名单拦截保存提示 → 不弹
 * 2) 无已存凭据 → 弹「保存」
 * 3) 已存且账号+密码一致 → 不弹
 * 4) 已存但账号或密码不一致 → 弹「更新」（且该凭据未关闭 autoSave）
 */
async function checkLoginSuccessAndPrompt(): Promise<void> {
  try {
    const storedTimeStr = sessionStorage.getItem('mp_pending_time')
    if (!storedTimeStr) return
    const storedTime = parseInt(storedTimeStr, 10)
    if (Date.now() - storedTime > 120 * 1000) {
      clearPendingCreds()
      return
    }

    const domain = sessionStorage.getItem('mp_pending_domain') || ''
    const username = sessionStorage.getItem('mp_pending_username') || ''
    const password = sessionStorage.getItem('mp_pending_password') || ''
    if (!domain || domain !== location.origin || !username || !password) return
    // 仍可见密码框 ≈ 登录页，未成功
    if (hasVisiblePasswordInput()) return

    clearPendingCreds()

    const rules = await getBlacklistRules(domain)
    if (rules.blockCredentialSavePrompt) return

    const existing = await fetchCred(domain)

    // 已有凭据：账密完全一致 → 不提示
    if (
      existing &&
      existing.username === username &&
      existing.password === password
    ) {
      return
    }

    // 已有凭据但该条关闭了「登录后提示」
    if (existing && existing.autoSaveEnabled === false) return

    const mode: 'save' | 'update' = existing ? 'update' : 'save'
    await injectSaveBanner(domain, username, password, mode)
  } catch {
    /* 凭据读取或提示注入失败时不阻断宿主页面的登录流程。 */
  }
}

async function isDarkMode(): Promise<boolean> {
  try {
    const mode = (await getPublicStore()).ui?.theme

    if (mode === 'dark') return true
    if (mode === 'light') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

async function showToast(
  message: string,
  type: 'success' | 'error' | 'info' = 'info',
): Promise<void> {
  const toastHostId = 'mp-pt-toast-host'
  let host = document.getElementById(toastHostId)
  if (!host) {
    host = document.createElement('div')
    host.id = toastHostId
    host.style.cssText =
      'position:fixed!important;top:20px!important;right:20px!important;z-index:999999999!important;display:flex!important;flex-direction:column!important;gap:8px!important;pointer-events:none!important;'
    document.body.appendChild(host)
  }
  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' })
  let container = shadow.querySelector('.toast-container') as HTMLElement | null
  if (!container) {
    container = document.createElement('div')
    container.className = 'toast-container'
    container.style.cssText =
      'display:flex!important;flex-direction:column!important;gap:8px!important;align-items:flex-end!important;'
    shadow.appendChild(container)
  }
  const dark = await isDarkMode()
  const toast = document.createElement('div')
  const bg =
    type === 'success'
      ? dark
        ? 'rgba(6,78,59,.9)'
        : '#f0fdfa'
      : type === 'error'
        ? dark
          ? 'rgba(127,29,29,.9)'
          : '#fef2f2'
        : dark
          ? 'rgba(30,41,59,.9)'
          : '#f8fafc'
  const color =
    type === 'success'
      ? dark
        ? '#6ee7b7'
        : '#0f766e'
      : type === 'error'
        ? dark
          ? '#fca5a5'
          : '#991b1b'
        : dark
          ? '#cbd5e1'
          : '#334155'
  toast.style.cssText = `display:flex!important;align-items:center!important;gap:8px!important;background:${bg}!important;border-radius:8px!important;padding:8px 12px!important;color:${color}!important;font-size:12px!important;font-weight:500!important;opacity:0!important;transform:translateX(40px)!important;transition:all .3s!important;pointer-events:auto!important;white-space:nowrap!important;`
  toast.textContent = message
  container.appendChild(toast)
  requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateX(0)'
  })
  window.setTimeout(() => {
    toast.style.opacity = '0'
    window.setTimeout(() => toast.remove(), 300)
  }, 2800)
}

async function injectSaveBanner(
  domain: string,
  username: string,
  password: string,
  mode: 'save' | 'update',
): Promise<void> {
  const hostId = 'mp-pt-save-banner-host'
  if (document.getElementById(hostId)) return

  const host = document.createElement('div')
  host.id = hostId
  host.style.cssText =
    'position:fixed!important;top:20px!important;right:-360px!important;width:320px!important;z-index:99999999!important;transition:right .4s cubic-bezier(.175,.885,.32,1.275)!important;'
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'closed' })
  const dark = await isDarkMode()

  const banner = document.createElement('div')
  banner.style.cssText = `background:${dark ? 'rgba(30,41,59,.98)' : 'rgba(255,255,255,.98)'}!important;backdrop-filter:blur(10px)!important;box-shadow:0 10px 25px rgba(0,0,0,.12)!important;border:1px solid ${dark ? 'rgba(71,85,105,.6)' : 'rgba(226,232,240,.9)'}!important;border-radius:12px!important;padding:10px 12px!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;width:100%!important;position:relative!important;box-sizing:border-box!important;`

  const closeBtn = document.createElement('button')
  closeBtn.innerHTML = '&times;'
  closeBtn.style.cssText =
    'position:absolute!important;top:6px!important;right:8px!important;width:20px!important;height:20px!important;border:none!important;background:transparent!important;color:#94a3b8!important;font-size:16px!important;cursor:pointer!important;padding:0!important;'
  closeBtn.onclick = () => dismissBanner()

  // 顶部信息行：品牌 logo + 标题 + 描述
  const topRow = document.createElement('div')
  topRow.style.cssText = 'display:flex!important;align-items:center!important;gap:10px!important;'

  const logo = document.createElement('img')
  logo.src = chrome.runtime.getURL('/icons/icon.png')
  logo.alt = 'MoviePilot Tools'
  logo.style.cssText = 'width:28px!important;height:28px!important;flex-shrink:0!important;border-radius:6px!important;display:block!important;'

  const textWrap = document.createElement('div')
  textWrap.style.cssText = 'flex:1!important;min-width:0!important;padding-right:18px!important;'

  const title = document.createElement('div')
  title.textContent = 'MoviePilot Tools'
  title.style.cssText = `font-size:12px!important;font-weight:700!important;color:${dark ? '#f1f5f9' : '#0f172a'}!important;text-align:left!important;line-height:1.3!important;`

  const desc = document.createElement('div')
  desc.textContent =
    mode === 'update'
      ? `检测到 ${domain} 登录账号/密码与已存凭据不一致，是否更新？`
      : `检测到 ${domain} 登录，是否保存凭据？`
  desc.style.cssText = `font-size:11px!important;color:${dark ? '#94a3b8' : '#64748b'}!important;margin-top:1px!important;text-align:left!important;line-height:1.3!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;`

  textWrap.appendChild(title)
  textWrap.appendChild(desc)
  topRow.appendChild(logo)
  topRow.appendChild(textWrap)

  const btnRow = document.createElement('div')
  btnRow.style.cssText =
    'display:flex!important;gap:6px!important;margin-top:10px!important;justify-content:flex-end!important;flex-wrap:wrap!important;'

  const mkBtn = (text: string, primary = false) => {
    const b = document.createElement('button')
    b.textContent = text
    b.style.cssText = primary
      ? `padding:4px 12px!important;border:none!important;background:${dark ? '#16a34a' : '#16a34a'}!important;color:#fff!important;border-radius:6px!important;font-size:11px!important;cursor:pointer!important;font-weight:600!important;`
      : `padding:4px 10px!important;border:1px solid ${dark ? 'rgba(148,163,184,.3)' : '#e2e8f0'}!important;background:transparent!important;color:${dark ? '#cbd5e1' : '#475569'}!important;border-radius:6px!important;font-size:11px!important;cursor:pointer!important;font-weight:600!important;`
    return b
  }

  const blacklistBtn = mkBtn('加入黑名单')
  blacklistBtn.onclick = () => {
    void sendMessage(MSG.PT_BLOCK_SITE, { domain })
      .then(() => {
        dismissBanner()
        void showToast(`${domain} 已加入黑名单`, 'success')
      })
      .catch((e) => void showToast(`加入黑名单失败：${String(e)}`, 'error'))
  }

  const neverBtn = mkBtn('不再提示')
  neverBtn.onclick = () => {
    void sendMessage(MSG.PT_BLOCK_SAVE_PROMPT, { domain })
      .then(() => {
        dismissBanner()
        void showToast(`${domain} 后续不再提示保存凭据`, 'success')
      })
      .catch((e) => void showToast(`设置失败：${String(e)}`, 'error'))
  }

  const saveBtn = mkBtn(mode === 'update' ? '更新凭据' : '保存凭据', true)
  saveBtn.onclick = () => {
    // 附带标签页标题：非 PT 站用作名称；PT 站由后台 matching 官方名覆盖
    const pageTitle = (document.title || '').trim() || undefined
    void sendMessage(MSG.PT_SAVE_CRED, {
      domain,
      username,
      password,
      name: pageTitle,
    })
      .then(() => {
        dismissBanner()
        void showToast(mode === 'update' ? '凭据已更新' : '凭据保存成功', 'success')
      })
      .catch((e) => void showToast(`保存失败：${String(e)}`, 'error'))
  }

  btnRow.appendChild(blacklistBtn)
  btnRow.appendChild(neverBtn)
  btnRow.appendChild(saveBtn)
  banner.appendChild(closeBtn)
  banner.appendChild(topRow)
  banner.appendChild(btnRow)
  shadow.appendChild(banner)

  window.setTimeout(() => {
    host.style.setProperty('right', '20px', 'important')
  }, 50)

  const autoDismissTimer = window.setTimeout(() => dismissBanner(), 12000)

  function dismissBanner() {
    if (autoDismissTimer) window.clearTimeout(autoDismissTimer)
    host.style.setProperty('right', '-360px', 'important')
    window.setTimeout(() => host.remove(), 400)
  }
}

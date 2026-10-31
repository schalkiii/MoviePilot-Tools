<template>
  <div class="mp-app" :class="{ 'has-custom-bg': bgActive }">
    <div
      v-if="bgActive"
      class="custom-bg-layer"
      :style="{
        backgroundImage: `url(${bgState.image})`,
        opacity: bgState.opacity,
        filter: bgState.blurEnabled ? `blur(${bgState.blur}px)` : 'none',
        transform: bgState.blurEnabled ? 'scale(1.08)' : 'none',
      }"
    />
    <!-- 启动鉴权完成前不渲染登录/PIN，避免 session 解锁时先闪 PIN 页 -->
    <div v-if="!authReady" class="mp-boot" />
    <LoginView
      v-else-if="!appState.loggedIn"
      @logged-in="onLoggedIn"
      @need-pin="onNeedPin"
    />
    <PinUnlockView v-else-if="pinSet && !appState.unlocked" @unlocked="onUnlocked" />
    <div v-else class="mp-main">
      <Sidebar :current="appState.currentView" @select="onSelect" />
      <div class="mp-content">
        <TopBar :title="title" :icon="icon" :icon-color="iconColor" />
        <main
          ref="viewEl"
          class="mp-view"
          :class="{
            'mp-view--full':
              appState.currentView === 'plugins' || appState.currentView === 'agent',
            'mp-view--sites': appState.currentView === 'sites',
            /* 站点管理 / 下载 / 两步验证 / 凭据 / 智能助手：顶栏贴边，滚动交给页面内部列表区 */
            'mp-view--flush':
              appState.currentView === 'sites' ||
              appState.currentView === 'downloads' ||
              appState.currentView === 'totp' ||
              appState.currentView === 'credentials' ||
              appState.currentView === 'agent',
          }"
        >
          <PluginsView v-if="pluginsMounted" v-show="appState.currentView === 'plugins'" />
          <AgentAssistantView v-if="agentMounted" v-show="appState.currentView === 'agent'" />
          <template v-if="appState.currentView !== 'plugins' && appState.currentView !== 'agent'">
            <component
              v-if="bgActive"
              :is="currentComp"
              :key="`bg-${appState.currentView}`"
            />
            <transition v-else name="mp-view" mode="out-in">
              <component :is="currentComp" :key="appState.currentView" />
            </transition>
          </template>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, markRaw, type Component } from 'vue'
import {
  mdiWeb,
  mdiChartLine,
  mdiDownload,
  mdiShieldKey,
  mdiKeyOutline,
  mdiPuzzleOutline,
  mdiRobotOutline,
  mdiAccountCircle,
  mdiCogOutline,
  mdiInformationOutline,
} from '@mdi/js'
import Sidebar from './Sidebar.vue'
import TopBar from './TopBar.vue'
import LoginView from '../views/LoginView.vue'
import PinUnlockView from '../views/PinUnlockView.vue'
import SiteManageView from '../views/SiteManageView.vue'
import SiteDataView from '../views/SiteDataView.vue'
import DownloadsView from '../views/DownloadsView.vue'
import TotpView from '../views/TotpView.vue'
import CredentialsView from '../views/CredentialsView.vue'
import PluginsView from '../views/PluginsView.vue'
import AgentAssistantView from '../views/AgentAssistantView.vue'
import UserView from '../views/UserView.vue'
import SettingsView from '../views/SettingsView.vue'
import AboutView from '../views/AboutView.vue'
import { appState } from '../core/state'
import { initTheme, initBackground, bgState, isBgActive } from '../core/theme'
import { getToken, refreshTokenSilently } from '../services/auth'
import { hasPin, tryRestoreSessionUnlock } from '../services/credential'
import { loadUser } from '../services/user'
import { STORAGE_KEYS, storageGet, storageRemove, storageSet, watchStorage } from '../core/storage'
import { onUnauthorized } from '../core/http'
import { getWebEmbedFeaturesConfig } from '../core/web-embed-features'

const NAV = [
  { key: 'sites', label: '站点管理', icon: mdiWeb, color: '#3b82f6' },
  { key: 'site-data', label: '站点数据', icon: mdiChartLine, color: '#3b82f6' },
  { key: 'downloads', label: '下载管理', icon: mdiDownload, color: '#52c41a' },
  { key: 'totp', label: '两步验证', icon: mdiShieldKey, color: '#1677ff' },
  { key: 'credentials', label: '凭据管理', icon: mdiKeyOutline, color: '#16a34a' },
  { key: 'plugins', label: '插件管理', icon: mdiPuzzleOutline, color: '#1677ff' },
  { key: 'agent', label: '智能助手', icon: mdiRobotOutline, color: '#7c3aed' },
  { key: 'user', label: '用户信息', icon: mdiAccountCircle, color: '#1677ff' },
  { key: 'settings', label: '设置', icon: mdiCogOutline, color: '#2563eb' },
  { key: 'about', label: '关于', icon: mdiInformationOutline, color: '#64748b' },
]

const COMPONENTS: Record<string, Component> = {
  sites: markRaw(SiteManageView),
  'site-data': markRaw(SiteDataView),
  downloads: markRaw(DownloadsView),
  totp: markRaw(TotpView),
  credentials: markRaw(CredentialsView),
  plugins: markRaw(PluginsView),
  agent: markRaw(AgentAssistantView),
  user: markRaw(UserView),
  settings: markRaw(SettingsView),
  about: markRaw(AboutView),
}

// 本地 ref 使用 `pinSet`，避免遮蔽导入的 `hasPin()` 函数。
const pinSet = ref(false)
/** 启动鉴权（Token / PIN / session 恢复）是否完成；未完成前不展示 PIN 页 */
const authReady = ref(false)
const bgActive = computed(() => isBgActive())
/** 主内容滚动容器：切页时回到顶部 */
const viewEl = ref<HTMLElement | null>(null)

const currentComp = computed(() => COMPONENTS[appState.currentView] ?? AboutView)
const pluginsMounted = ref(appState.currentView === 'plugins')
const agentMounted = ref(appState.currentView === 'agent')
const currentNav = computed(() => NAV.find((n) => n.key === appState.currentView))
const title = computed(() => currentNav.value?.label ?? '')
const icon = computed(() => currentNav.value?.icon ?? '')
const iconColor = computed(() => currentNav.value?.color ?? '#34495e')
let pageKeepEnabled = false
let restoringInitialView = true
let stopPageKeepWatch: (() => void) | null = null

function isValidView(value: unknown): value is string {
  return typeof value === 'string' && value in COMPONENTS
}

async function restoreLastView(): Promise<void> {
  const config = await getWebEmbedFeaturesConfig()
  pageKeepEnabled = config.pageKeepEnabled
  if (!pageKeepEnabled) {
    appState.currentView = 'sites'
    return
  }
  const lastView = await storageGet<string>(STORAGE_KEYS.LAST_VIEW)
  if (isValidView(lastView)) appState.currentView = lastView
}

function scrollViewToTop(): void {
  const el = viewEl.value
  if (!el) return
  el.scrollTop = 0
  el.scrollLeft = 0
}

function onSelect(key: string): void {
  if (appState.currentView === key) {
    // 再次点击当前页：也滚回顶部
    scrollViewToTop()
    return
  }
  appState.currentView = key
}

// 任意来源切换视图（侧栏 / pending route 等）都重置滚动
watch(
  () => appState.currentView,
  async (view) => {
    if (view === 'plugins') pluginsMounted.value = true
    if (view === 'agent') agentMounted.value = true
    if (!restoringInitialView && pageKeepEnabled && isValidView(view)) {
      await storageSet(STORAGE_KEYS.LAST_VIEW, view)
    }
    await nextTick()
    scrollViewToTop()
  },
)

async function forceLoginUI(): Promise<void> {
  appState.loggedIn = false
  appState.unlocked = false
  pinSet.value = false
}

async function refreshLogin(): Promise<void> {
  try {
    let token = await getToken()
    // 无 Token 时使用已保存的加密凭据尝试静默登录。
    if (!token) {
      token = await refreshTokenSilently()
    }
    if (!token) {
      await forceLoginUI()
      return
    }

    // 先完成 PIN / session 判定，再暴露 loggedIn，避免中间态闪 PIN 页
    const needPin = await hasPin()
    pinSet.value = needPin
    if (!needPin) {
      appState.loggedIn = true
      appState.unlocked = true
      await loadUser()
      return
    }

    // session 频率：浏览器会话内已解锁则恢复 Master Key，免再次输入 PIN
    const restored = await tryRestoreSessionUnlock()
    appState.loggedIn = true
    appState.unlocked = restored
    if (restored) await loadUser()
  } finally {
    authReady.value = true
  }
}

function onLoggedIn(): void {
  appState.loggedIn = true
  appState.unlocked = true
  pinSet.value = false
  authReady.value = true
  void loadUser()
}
function onNeedPin(): void {
  // 登录成功且已设 PIN：先尝试 session 恢复，成功则不展示 PIN 页
  void (async () => {
    const restored = await tryRestoreSessionUnlock()
    pinSet.value = true
    appState.loggedIn = true
    appState.unlocked = restored
    authReady.value = true
    if (restored) await loadUser()
  })()
}
async function onUnlocked(): Promise<void> {
  appState.unlocked = true
  await loadUser()
  await consumePendingRoute()
}

/** PT 悬浮按钮等入口：若有待打开路由则切换到对应页面 */
async function consumePendingRoute(): Promise<void> {
  try {
    type PendingRoute =
      | string
      | {
          path?: string
          query?: { from?: string; url?: string; title?: string }
        }
    const route = (await storageGet<PendingRoute>(STORAGE_KEYS.PENDING_ROUTE)) as PendingRoute | null
    const isDownloads =
      route === 'downloads' ||
      (typeof route === 'object' &&
        !!route &&
        (route.path === 'downloads' || route.path === '/download'))
    if (isDownloads) appState.currentView = 'downloads'
  } catch {
    /* 待打开路由读取失败时保留当前页面。 */
  }
}

onMounted(async () => {
  // 401/静默刷新失败 → 退回登录页（不主动清加密凭据，仅清会话在 http/auth 侧处理）
  onUnauthorized(() => {
    void forceLoginUI()
  })
  await initTheme()
  await initBackground()
  await restoreLastView()
  stopPageKeepWatch = watchStorage<Partial<{ pageKeepEnabled: boolean }>>(
    STORAGE_KEYS.WEB_EMBED_FEATURES,
    (config) => {
      pageKeepEnabled = !!config?.pageKeepEnabled
      if (pageKeepEnabled && !restoringInitialView && isValidView(appState.currentView)) {
        void storageSet(STORAGE_KEYS.LAST_VIEW, appState.currentView)
      }
    },
  )
  await refreshLogin()
  if (appState.loggedIn && appState.unlocked) {
    const pickerView = await storageGet<string>(STORAGE_KEYS.FILE_PICKER_VIEW)
    if (pickerView && pickerView in COMPONENTS) {
      appState.currentView = pickerView
      await storageRemove(STORAGE_KEYS.FILE_PICKER_VIEW)
    }
    await consumePendingRoute()
  }
  restoringInitialView = false
  if (pageKeepEnabled && isValidView(appState.currentView)) {
    await storageSet(STORAGE_KEYS.LAST_VIEW, appState.currentView)
  }
})

onBeforeUnmount(() => {
  stopPageKeepWatch?.()
  stopPageKeepWatch = null
})
</script>

<style scoped>
.mp-app,
.mp-main {
  width: 100%;
  height: 100%;
  display: flex;
}
.mp-app {
  position: relative;
}
/* 启动鉴权占位：与 popup 同色底，避免闪白/闪 PIN */
.mp-boot {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  height: 100%;
  background: var(--mp-color-bg, #f8fafc);
}
:global(html[data-theme='dark']) .mp-boot {
  background: #0f172a;
}
/* PIN 解锁页作为唯一内容时铺满弹窗 */
.mp-app > :deep(.pin-lock-page) {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
}
/*
 * 自定义背景视觉样式在 styles/theme/custom-bg.css（全局）。
 * 此处只保留布局结构；勿在底层再铺清晰背景图，否则 filter:blur 看不出效果。
 */
.custom-bg-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  pointer-events: none;
  transition:
    opacity 0.3s ease,
    filter 0.3s ease,
    transform 0.3s ease;
}
.mp-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--mp-color-bg);
  color: var(--mp-color-text);
}
.mp-view {
  flex: 1;
  overflow-y: scroll;
  overflow-x: hidden;
  padding: 10px;
  color: var(--mp-color-text);
}

:global(html[data-theme='dark']) .mp-content {
  background: #0f172a;
  color: #e2e8f0;
}

:global(html[data-theme='dark']) .mp-view {
  color: #e2e8f0;
}
/* 插件 iframe：去边距并裁切滚动 */
.mp-view--full {
  padding: 0;
  overflow: hidden;
}

/*
 * 下载 / 两步验证 / 凭据：去外边距；
 * 滚动交给页面内部列表区，顶部 toolbar/tabs 固定不随列表滚走。
 */
.mp-view--flush {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.mp-view--flush > :deep(*) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* 站点管理保留页面间距；滚动仅发生在站点列表内部。 */
.mp-view--sites {
  padding: 10px;
  overflow: hidden;
}
.mp-view-enter-active,
.mp-view-leave-active {
  transition:
    opacity 0.2s var(--mp-ease),
    transform 0.2s var(--mp-ease);
}
.mp-view-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.mp-view-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
@media (prefers-reduced-motion: reduce) {
  .mp-view-enter-active,
  .mp-view-leave-active {
    transition: none;
  }
  .mp-view-enter-from,
  .mp-view-leave-to {
    transform: none;
  }
}
</style>

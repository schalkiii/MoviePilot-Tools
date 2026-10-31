<template>
  <div class="site-manage">
    <!-- 统计面板 -->
    <div class="sm-stats">
      <div class="sm-stat sm-stat--supporting">
        <div class="sm-stat-num">{{ supportingCount }}</div>
        <div class="sm-stat-label">已适配</div>
      </div>
      <div class="sm-stat sm-stat--config">
        <div class="sm-stat-num">{{ configuredCount }}</div>
        <div class="sm-stat-label">已配置</div>
      </div>
      <div class="sm-stat sm-stat--filtered">
        <div class="sm-stat-num">{{ filteredSites.length }}</div>
        <div class="sm-stat-label">过滤后</div>
      </div>
      <div class="sm-stat sm-stat--pending">
        <div class="sm-stat-num">{{ pendingCount }}</div>
        <div class="sm-stat-label">待更新</div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="sm-toolbar">
      <div class="sm-filters">
        <el-checkbox v-model="filters.browser" @change="onFilterChange">浏览器</el-checkbox>
        <el-checkbox v-model="filters.server" @change="onFilterChange">服务器</el-checkbox>
        <el-checkbox v-model="filters.cookieDiff" @change="onFilterChange">CK差异</el-checkbox>
        <el-checkbox v-model="filters.uaDiff" @change="onFilterChange">UA差异</el-checkbox>
        <el-checkbox v-model="filters.notLoggedIn" @change="onFilterChange">未登录</el-checkbox>
        <el-checkbox v-model="filters.notAdded" @change="onFilterChange">未添加</el-checkbox>
        <el-checkbox v-model="filters.notOwned" @change="onFilterChange">未拥有</el-checkbox>
      </div>
      <div class="sm-search-row">
        <el-input
          v-model="siteSearch"
          size="small"
          clearable
          class="sm-search-input"
          placeholder="搜索站点..."
          aria-label="搜索当前筛选结果中的站点"
        >
          <template #prefix>
            <svg viewBox="0 0 24 24" class="sm-search-icon"><path :d="mdiMagnify" /></svg>
          </template>
        </el-input>
        <el-button size="small" type="primary" class="sm-add-site-btn" title="添加站点" @click="openCreate">
          <svg viewBox="0 0 24 24" class="sm-btn-icon"><path :d="mdiPlus" /></svg>添加站点
        </el-button>
      </div>
      <div class="sm-tools">
        <el-button
          size="small"
          class="sm-tool-btn"
          title="一键打开所有站点"
          :disabled="!filteredSites.length"
          @click="openAll"
        >
          <svg viewBox="0 0 24 24" class="sm-btn-icon"><path :d="mdiOpenInNew" /></svg>打开
        </el-button>
        <el-button size="small" class="sm-tool-btn" title="刷新站点数据" :disabled="loading || refreshing" @click="refresh">
          <svg viewBox="0 0 24 24" class="sm-btn-icon" :class="{ 'sm-spin': loading || refreshing }"><path :d="mdiRefresh" /></svg>刷新
        </el-button>
        <el-button
          size="small"
          class="sm-tool-btn"
          title="一键将服务器Cookie覆盖到浏览器"
          type="danger"
          :disabled="!canOverwrite"
          @click="overwriteAll"
        >
          <svg viewBox="0 0 24 24" class="sm-btn-icon"><path :d="mdiCookie" /></svg>覆盖
        </el-button>
        <el-button
          size="small"
          class="sm-tool-btn"
          title="一键更新Cookie和UserAgent到服务器"
          type="primary"
          :disabled="!canUpdate"
          @click="updateAll"
        >
          <svg viewBox="0 0 24 24" class="sm-btn-icon"><path :d="mdiUpload" /></svg>更新
        </el-button>
      </div>
    </div>

    <div class="sm-scroll">
    <el-skeleton v-if="loading" :rows="6" animated />
    <el-result v-else-if="error" icon="error" title="加载失败" :sub-title="error">
      <template #extra>
        <el-button type="primary" size="small" @click="load">重试</el-button>
      </template>
    </el-result>
    <el-empty v-else-if="!filteredSites.length" description="暂无匹配的站点" />

    <div v-else class="sm-list">
      <div
        v-for="site in filteredSites"
        :key="siteRowKey(site)"
        class="sm-card"
        :class="{
          'sm-card--disabled': site.isDisabled,
          'sm-card--inactive': !site.is_active,
        }"
      >
        <div class="sm-card-head">
          <div
            class="sm-avatar"
            :class="{ 'has-icon': !!siteIconKey(site) }"
            :style="siteIconKey(site) ? undefined : { background: avatarBg(site) }"
          >
            <img
              v-if="siteIconKey(site)"
              :src="siteIconKey(site)!"
              class="sm-icon-img"
              alt=""
              @error="onIconError"
            />
            <span v-else>{{ avatarChar(site) }}</span>
          </div>
          <div class="sm-title">
            <div class="sm-name" :title="site.name || site.domain">
              {{ site.name || site.domain }}
            </div>
            <a
              class="sm-domain"
              :href="siteLink(site)"
              target="_blank"
              rel="noopener noreferrer"
              :title="site.url || site.domain"
              @click="openSiteDomain($event, siteLink(site))"
            >
              <svg viewBox="0 0 24 24" width="9" height="9" class="sm-domain-icon">
                <path :d="mdiOpenInNew" />
              </svg>
              {{ site.domain || hostnameOf(site.url || '') }}
            </a>
          </div>
          <div v-if="cardTags(site).length" class="sm-card-head-tags">
            <span
              v-for="t in cardTags(site)"
              :key="t.text"
              class="sm-tag"
              :class="t.cls"
              >{{ t.text }}</span
            >
          </div>
        </div>

        <div class="sm-card-bottom">
          <div class="sm-actions">
            <el-button
              v-if="showOverwrite(site)"
              size="small"
              class="sm-act-btn sm-act-overwrite"
              title="将服务器 Cookie 覆盖到浏览器"
              @click="doOverwrite(site)"
            >
              <svg viewBox="0 0 24 24" width="10" height="10"><path :d="mdiDownload" /></svg>覆盖
            </el-button>
            <el-button
              v-if="showUpdate(site)"
              size="small"
              class="sm-act-btn sm-act-update"
              title="更新 Cookie 和 User-Agent 到服务器"
              @click="doUpdate(site)"
            >
              <svg viewBox="0 0 24 24" width="10" height="10"><path :d="mdiUpload" /></svg>更新
            </el-button>
            <el-button
              v-if="showUpdateUA(site)"
              size="small"
              class="sm-act-btn sm-act-update"
              title="更新 User-Agent 到服务器"
              @click="doUpdate(site)"
            >
              <svg viewBox="0 0 24 24" width="10" height="10"><path :d="mdiUpload" /></svg>更新UA
            </el-button>
            <el-button
              v-if="showLogin(site)"
              size="small"
              class="sm-act-btn sm-act-login"
              title="前往站点登录"
              @click="doLogin(site)"
            >
              <svg viewBox="0 0 24 24" width="10" height="10"><path :d="mdiLock" /></svg>登录
            </el-button>
            <el-button
              v-if="showAdd(site)"
              size="small"
              class="sm-act-btn sm-act-add"
              title="添加站点"
              @click="openAddForSite(site)"
            >
              <svg viewBox="0 0 24 24" width="10" height="10"><path :d="mdiPlus" /></svg>添加
            </el-button>
          </div>
          <div class="sm-more-wrap">
            <el-dropdown
              trigger="click"
              popper-class="sm-site-dropdown"
              @command="(c: string) => onMenu(c, site)"
            >
              <button type="button" class="sm-more" title="更多操作">
                <svg viewBox="0 0 24 24" width="13" height="13"><path :d="mdiDotsVertical" /></svg>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="site.id && site.id > 0" command="addDomainAlias">
                    <div class="dropdown-item-content">
                      <svg viewBox="0 0 24 24" width="13" height="13" class="mr-1"><path :d="mdiWeb" /></svg>备用域名
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item v-if="isPureNotOwned(site)" command="visit">
                    <div class="dropdown-item-content">
                      <svg viewBox="0 0 24 24" width="13" height="13" class="mr-1"><path :d="mdiOpenInNew" /></svg>访问站点
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item v-if="site.id && site.id > 0" command="test">
                    <div class="dropdown-item-content">
                      <svg viewBox="0 0 24 24" width="13" height="13" class="mr-1"><path :d="mdiWifi" /></svg>测试连接
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item v-if="site.id && site.id > 0" command="edit">
                    <div class="dropdown-item-content">
                      <svg viewBox="0 0 24 24" width="13" height="13" class="mr-1"><path :d="mdiPencil" /></svg>编辑站点
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item v-if="site.id && site.id > 0" command="toggleDisable">
                    <div class="dropdown-item-content">
                      <svg viewBox="0 0 24 24" width="13" height="13" class="mr-1"><path :d="mdiUpload" /></svg>
                      {{ site.isDisabled ? '开启站点' : '禁用站点' }}
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item v-if="site.id && site.id > 0" command="toggleUpdateDisable">
                    <div class="dropdown-item-content">
                      <svg viewBox="0 0 24 24" width="13" height="13" class="mr-1"><path :d="mdiUploadOff" /></svg>
                      {{ site.isUpdateDisabled ? '启用一键更新' : '禁用一键更新' }}
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="site.id && site.id > 0"
                    command="delete"
                    divided
                    class="delete-menu-item"
                  >
                    <div class="dropdown-item-content text-danger">
                      <svg viewBox="0 0 24 24" width="13" height="13" class="mr-1"><path :d="mdiDelete" /></svg>删除站点
                    </div>
                  </el-dropdown-item>
                  <el-dropdown-item
                    v-if="showClearCookie(site)"
                    command="clearCookie"
                    :divided="!!(site.id && site.id > 0)"
                    class="delete-menu-item"
                  >
                    <div class="dropdown-item-content text-danger">
                      <svg viewBox="0 0 24 24" width="13" height="13" class="mr-1"><path :d="mdiCookie" /></svg>删除浏览器Cookie
                    </div>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>
    </div>
    </div>

    <!-- 添加/编辑站点：仅覆盖主内容区，保留侧栏与顶栏 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editing ? '编辑站点' : '添加站点'"
      width="100%"
      class="site-dialog"
      modal-class="site-dialog-modal"
      append-to-body
      destroy-on-close
      :show-close="true"
      :close-on-click-modal="false"
      :fullscreen="true"
      @opened="onDialogOpened"
      @closed="resetForm"
    >
      <div class="dialog-content">
        <el-form :model="form" label-width="0" class="site-form">
          <div class="main-layout">
            <div class="top-section">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiToggleSwitch">
                      <path :d="mdiToggleSwitch" />
                    </svg>
                    状态
                  </label>
                  <el-select v-model="form.is_active" placeholder="选择状态" class="form-select">
                    <el-option label="启用" :value="true" />
                    <el-option label="停用" :value="false" />
                  </el-select>
                </div>

                <div class="form-group">
                  <label class="form-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiPriorityHigh">
                      <path :d="mdiPriorityHigh" />
                    </svg>
                    优先级
                  </label>
                  <el-select v-model="form.pri" placeholder="选择优先级" class="form-select">
                    <el-option
                      v-for="item in priorityOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </div>

                <div class="form-group">
                  <label class="form-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiTimer">
                      <path :d="mdiTimer" />
                    </svg>
                    超时时间
                  </label>
                  <el-input v-model="form.timeout" placeholder="秒" class="form-input" />
                </div>

                <div class="form-group">
                  <label class="form-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiDownload">
                      <path :d="mdiDownload" />
                    </svg>
                    下载器
                  </label>
                  <el-select v-model="form.downloader" placeholder="默认" class="form-select">
                    <el-option label="默认" value="" />
                    <el-option
                      v-for="item in downloaderOptions"
                      :key="item.name"
                      :label="item.name"
                      :value="item.name"
                    />
                  </el-select>
                </div>
              </div>
            </div>

            <div class="bottom-section">
              <div class="form-group">
                <label class="form-label">
                  <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiWeb">
                    <path :d="mdiWeb" />
                  </svg>
                  站点地址
                </label>
                <el-input
                  v-model="form.url"
                  placeholder="格式: http://www.example.com/"
                  class="form-input"
                />
              </div>

              <div class="form-group">
                <label class="form-label">
                  <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiRss">
                    <path :d="mdiRss" />
                  </svg>
                  RSS地址
                </label>
                <el-input v-model="form.rss" placeholder="RSS订阅地址" class="form-input" />
                <div class="form-hint">订阅模式为`站点RSS`时使用的订阅链接,如未自动获取需手动补充</div>
              </div>
            </div>
          </div>

          <div class="auth-section">
            <el-tabs v-model="siteType" class="auth-tabs">
              <el-tab-pane name="cookie">
                <template #label>
                  <span class="tab-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" class="tab-icon" data-icon="mdiCookie">
                      <path :d="mdiCookie" />
                    </svg>
                    COOKIE
                  </span>
                </template>
                <div class="auth-content">
                  <div class="form-group">
                    <div class="form-label-row">
                      <label class="form-label">
                        <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiCookie">
                          <path :d="mdiCookie" />
                        </svg>
                        站点Cookie
                      </label>
                      <el-button
                        size="small"
                        class="field-fill-btn"
                        :loading="fetchingCookie"
                        title="根据站点地址读取当前浏览器 Cookie"
                        @click="fillSiteCookieFromBrowser"
                      >
                        获取
                      </el-button>
                    </div>
                    <el-input
                      v-model="form.cookie"
                      type="textarea"
                      :rows="3"
                      placeholder="站点请求头中的Cookie信息"
                      class="form-textarea"
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">
                      <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiAccount">
                        <path :d="mdiAccount" />
                      </svg>
                      站点User-Agent
                    </label>
                    <el-input
                      v-model="form.ua"
                      placeholder="获取Cookie的浏览器对应的User-Agent"
                      class="form-input ua-input"
                    >
                      <template #append>
                        <el-button class="field-fill-btn ua-fill-btn" title="填充当前浏览器 User-Agent" @click="fillCurrentUserAgent">
                          获取
                        </el-button>
                      </template>
                    </el-input>
                  </div>
                </div>
              </el-tab-pane>

              <el-tab-pane name="api">
                <template #label>
                  <span class="tab-label">
                    <svg viewBox="0 0 24 24" width="16" height="16" class="tab-icon" data-icon="mdiApi">
                      <path :d="mdiApi" />
                    </svg>
                    API
                  </span>
                </template>
                <div class="auth-content">
                  <div class="form-group">
                    <label class="form-label">
                      <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiKey">
                        <path :d="mdiKey" />
                      </svg>
                      请求头 (Authorization)
                    </label>
                    <el-input
                      v-model="form.token"
                      placeholder="站点请求头中的Authorization信息,特殊站点需要"
                      class="form-input"
                    />
                  </div>
                  <div class="form-group">
                    <label class="form-label">
                      <svg viewBox="0 0 24 24" width="16" height="16" class="label-icon" data-icon="mdiApi">
                        <path :d="mdiApi" />
                      </svg>
                      令牌 (API Key)
                    </label>
                    <el-input
                      v-model="form.apikey"
                      placeholder="站点的访问API Key,特殊站点需要"
                      class="form-input"
                    />
                  </div>
                </div>
              </el-tab-pane>
            </el-tabs>
          </div>

          <div class="bottom-options">
            <div class="option-item">
              <el-switch v-model="isLimit" />
              <span class="option-label">限制站点访问频率</span>
            </div>
            <div class="option-item">
              <el-switch v-model="form.proxy" />
              <span class="option-label">使用代理访问</span>
            </div>
            <div class="option-item">
              <el-switch v-model="form.render" />
              <span class="option-label">浏览器仿真</span>
            </div>
          </div>

          <div v-if="isLimit" class="limit-settings">
            <div class="limit-title">限流设置</div>
            <div class="limit-fields">
              <div class="form-group">
                <label class="form-label">限流间隔</label>
                <el-input-number v-model="form.limit_interval" :min="0" class="form-input-number" />
              </div>
              <div class="form-group">
                <label class="form-label">限流次数</label>
                <el-input-number v-model="form.limit_count" :min="0" class="form-input-number" />
              </div>
              <div class="form-group">
                <label class="form-label">限流秒数</label>
                <el-input-number v-model="form.limit_seconds" :min="0" class="form-input-number" />
              </div>
            </div>
          </div>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSave">
          {{ editing ? '更新' : '添加' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="aliasDialogVisible"
      title="备用域名"
      class="alias-dialog"
      width="92%"
      append-to-body
      :align-center="false"
      :close-on-click-modal="false"
      @closed="resetAliasDialog"
    >
      <div class="alias-dialog__content">
        <div class="alias-field-label">新增备用域名</div>
        <div class="alias-add-row">
          <el-input
            v-model="aliasInput"
            size="small"
            placeholder="输入域名或完整地址"
            clearable
            @keyup.enter="addAliasToSite"
          />
          <el-button
            type="primary"
            size="small"
            class="alias-add-button"
            :loading="aliasSaving"
            title="添加备用域名"
            @click="addAliasToSite"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path :d="mdiPlus" /></svg>
            <span class="sr-only">添加备用域名</span>
          </el-button>
        </div>
        <p class="alias-dialog__hint">仅填写备用网址；系统会自动提取并保存域名。</p>

        <div class="alias-primary">
          <div>
            <span class="alias-primary__label">当前主域名</span>
            <strong>{{ aliasSite?.domain || '未设置' }}</strong>
          </div>
          <span>默认用于站点访问与同步</span>
        </div>

        <div class="alias-list-label">备用域名<span>{{ aliasDomains.length }}</span></div>
        <div class="alias-list" aria-live="polite">
          <div v-if="!aliasDomains.length" class="alias-empty">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path :d="mdiWeb" /></svg>
            <span>可添加备用域名，并在需要时一键切换</span>
          </div>
          <div v-for="domain in aliasDomains" :key="domain" class="alias-list__item">
            <span class="alias-list__domain">{{ domain }}</span>
            <div class="alias-list__actions">
              <el-button text type="primary" size="small" :loading="aliasSwitching === domain" @click="setAliasAsPrimary(domain)">设为主域名</el-button>
              <el-button text size="small" class="alias-list__remove" :disabled="!!aliasSwitching" @click="removeAliasFromSite(domain)">移除</el-button>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="alias-dialog__footer">
          <el-button size="small" @click="aliasDialogVisible = false">完成</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import {
  mdiPlus,
  mdiMagnify,
  mdiOpenInNew,
  mdiRefresh,
  mdiCookie,
  mdiUpload,
  mdiDownload,
  mdiLock,
  mdiDotsVertical,
  mdiWifi,
  mdiPencil,
  mdiDelete,
  mdiUploadOff,
  mdiToggleSwitch,
  mdiPriorityHigh,
  mdiTimer,
  mdiWeb,
  mdiRss,
  mdiAccount,
  mdiKey,
  mdiApi,
} from '@mdi/js'
import {
  fetchSites,
  loadStoredSites,
  updateSite,
  createSite,
  deleteSite,
  fetchSupporting,
  overwriteSiteCookie,
  syncSiteToServer,
  clearSiteBrowserCookie,
  testConnection,
  saveDisableState,
  saveUpdateDisableState,
  withSiteDisableStates,
  buildSiteRows,
  applySiteFilters,
  migrateSiteFilters,
  DEFAULT_SITE_FILTERS,
  isApiSite,
  type SiteFilterKey,
  type SupportingDict,
} from '../services/site-manage'
import { loadCachedSupportingSites } from '../services/site-supporting'
import { fetchClients } from '../services/download'
import type { DownloadClient, Site, SiteRow, SiteStatus } from '../core/types'
import { STORAGE_KEYS, storageGet, storageSet } from '../core/storage'
import { hostnameOf } from '../utils/url'
import { stablePaletteValue } from '../utils/format'
import { buildBrowserCookieMap, getDomainCookies, type BrowserSessionMap } from '../utils/cookie'
import { ElMessage, confirmAction, confirmDelete } from '../utils/ui'
import { resolveSiteIconsBatch } from '../services/site-icon'
import {
  addCustomDomainAlias,
  loadCustomDomainAliases,
  removeCustomDomainAlias,
  swapPrimaryDomainAlias,
} from '../services/site-domain-alias'

const sites = ref<Site[]>([])
const siteRows = ref<SiteRow[]>([])
const siteIconMap = ref<Record<string, string>>({})
const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
let hasLoadedSnapshot = false
let loadGeneration = 0
const dialogVisible = ref(false)
const saving = ref(false)
const fetchingCookie = ref(false)
const editing = ref<Site | null>(null)
const aliasDialogVisible = ref(false)
const aliasSite = ref<Site | null>(null)
const aliasInput = ref('')
const aliasDomains = ref<string[]>([])
const aliasSaving = ref(false)
const aliasSwitching = ref('')

/** 重建行用的缓存（刷新 load 时更新） */
const configuredCache = ref<Site[]>([])
const supportingDetails = ref<SupportingDict>({})
const browserSessionMap = ref<BrowserSessionMap>(new Map())

const filters = reactive<Record<SiteFilterKey, boolean>>({ ...DEFAULT_SITE_FILTERS })
const siteSearch = ref('')

const siteType = ref<'cookie' | 'api'>('cookie')
const isLimit = ref(false)
const downloaderOptions = ref<DownloadClient[]>([])
const priorityOptions = Array.from({ length: 100 }, (_, i) => ({ label: String(i), value: i }))

interface SiteForm {
  url: string
  rss: string
  cookie: string
  ua: string
  apikey: string
  token: string
  pri: number
  timeout: string
  downloader: string
  is_active: boolean
  proxy: boolean
  render: boolean
  limit_interval: number
  limit_count: number
  limit_seconds: number
}
function emptyForm(): SiteForm {
  return {
    url: '',
    rss: '',
    cookie: '',
    ua: '',
    apikey: '',
    token: '',
    pri: 0,
    timeout: '',
    downloader: '',
    is_active: true,
    proxy: false,
    render: false,
    limit_interval: 0,
    limit_count: 0,
    limit_seconds: 0,
  }
}
const form = reactive<SiteForm>(emptyForm())

onMounted(async () => {
  await Promise.all([load(), loadDownloaders()])
})

async function loadDownloaders(): Promise<void> {
  try {
    downloaderOptions.value = await fetchClients()
  } catch {
    downloaderOptions.value = []
  }
}

async function onDialogOpened(): Promise<void> {
  if (!downloaderOptions.value.length) await loadDownloaders()
}

// 数据加载
function rebuildRows(): void {
  siteRows.value = buildSiteRows({
    configured: configuredCache.value,
    supporting: supportingDetails.value,
    browserMap: browserSessionMap.value,
    browserUA: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    expandNotOwned: !!filters.notOwned,
  })
  sites.value = siteRows.value.map((r) => r.site!).filter(Boolean)
}

async function readBrowserCookies(): Promise<chrome.cookies.Cookie[]> {
  return new Promise((resolve) => {
    try {
      chrome.cookies.getAll({}, (cookies) => resolve(cookies ?? []))
    } catch {
      resolve([])
    }
  })
}

async function applySnapshot(
  serverSites: Site[],
  supporting: SupportingDict,
  allCookies: chrome.cookies.Cookie[],
): Promise<void> {
  supportingDetails.value = supporting
  browserSessionMap.value = buildBrowserCookieMap(allCookies)
  configuredCache.value = await withSiteDisableStates(serverSites)
  rebuildRows()
  hasLoadedSnapshot = true
  loading.value = false
}

async function resolveIcons(generation: number): Promise<void> {
  const iconInputs = sites.value.map((s) => {
    const domain = (s.domain || hostnameOf(s.url || '')).toLowerCase()
    return { domain, id: s.id, icon: s.icon, name: s.name, url: s.url }
  })
  const icons = await resolveSiteIconsBatch(iconInputs, {
    deferNetworkDiscover: true,
    onUpdate: (map) => {
      if (generation === loadGeneration) siteIconMap.value = map
    },
  })
  if (generation === loadGeneration) siteIconMap.value = icons
}

async function load(): Promise<void> {
  const generation = ++loadGeneration
  error.value = ''
  refreshing.value = true

  // 本地快照先渲染对比状态，MP 网络结果到达后再替换，避免每次打开 popup 都等待远端。
  try {
    const [cachedSites, cachedSupporting, cachedCookies] = await Promise.all([
      loadStoredSites(),
      loadCachedSupportingSites(),
      readBrowserCookies(),
    ])
    if (!hasLoadedSnapshot && (cachedSites.length || cachedSupporting)) {
      await applySnapshot(cachedSites, cachedSupporting || {}, cachedCookies)
    }
  } catch {
    /* 快照失败时继续请求网络数据。 */
  }

  try {
    const [serverSites, supporting, allCookies] = await Promise.all([
      fetchSites(),
      fetchSupporting(true),
      readBrowserCookies(),
    ])
    if (generation !== loadGeneration) return
    await applySnapshot(serverSites, supporting, allCookies)
    void resolveIcons(generation)
  } catch (e) {
    if (!hasLoadedSnapshot) error.value = String(e)
    else if (generation === loadGeneration) void resolveIcons(generation)
  } finally {
    if (generation === loadGeneration) {
      loading.value = false
      refreshing.value = false
    }
  }
}

async function refresh(): Promise<void> {
  await load()
  if (!error.value) ElMessage.success('已刷新')
}

// 辅助
function statusOf(s: Site): SiteStatus {
  return s.status || {
    browser: false,
    server: false,
    cookieDiff: false,
    uaDiff: false,
    notLoggedIn: false,
    notAdded: false,
    notOwned: false,
  }
}

function siteRowKey(site: Site): string {
  if (!site.id) return `v:${site.domain || site.url || site.name || ''}`
  return `c:${site.id}`
}

function cardTags(s: Site): { text: string; cls: string }[] {
  // 禁用态（已禁用 / 禁更新）互斥且优先级最高：仅显示单一灰色标签，不再叠加运行态差异
  if (s.isDisabled) return [{ text: '已禁用', cls: 'sm-tag--disabled' }]
  if (s.isUpdateDisabled && !!s.id) return [{ text: '禁更新', cls: 'sm-tag--disabled' }]
  const t: { text: string; cls: string }[] = []
  if (!!s.public && !!s.id) t.push({ text: '公开站点', cls: 'sm-tag--public' })
  const st = statusOf(s)
  if (isApiSite(s) && s.id) t.push({ text: 'API站点', cls: 'sm-tag--api' })
  if (st.notAdded) t.push({ text: '未添加', cls: 'sm-tag--not-added' })
  else if (st.notOwned) t.push({ text: '未拥有', cls: 'sm-tag--unsupported' })
  if (st.notLoggedIn) t.push({ text: '未登录', cls: 'sm-tag--login' })
  // 未登录时不展示 CK/UA 差异（未登录本身即解释差异）
  if (!st.notLoggedIn && st.cookieDiff) t.push({ text: 'CK差异', cls: 'sm-tag--cookie' })
  if (!st.notLoggedIn && st.uaDiff) t.push({ text: 'UA差异', cls: 'sm-tag--ua' })
  if (!s.is_active && !!s.id) t.push({ text: '已停用', cls: 'sm-tag--disabled' })
  return t
}

function showOverwrite(s: Site): boolean {
  // 已配置 + 服务端有 CK +（CK 差异 或 未登录）+ 非 API
  const st = statusOf(s)
  return !!(
    s.id &&
    s.cookie &&
    !s.isDisabled &&
    !isApiSite(s) &&
    (s.cookieDiff || st.notLoggedIn)
  )
}
function showUpdate(s: Site): boolean {
  return !!(
    s.id &&
    (s.cookieDiff || s.uaDiff) &&
    !s.isDisabled &&
    !s.isUpdateDisabled &&
    !isApiSite(s) &&
    statusOf(s).browser
  )
}
function showUpdateUA(s: Site): boolean {
  return !!(isApiSite(s) && s.id && s.uaDiff && !s.isDisabled)
}
function showLogin(s: Site): boolean {
  return !!(s.id && statusOf(s).notLoggedIn && !s.isDisabled)
}
function showAdd(s: Site): boolean {
  // 仅「未添加」可添加；纯「未拥有」左下角不显示任何按钮
  return !s.id && !s.isDisabled && !!statusOf(s).notAdded
}
function isPureNotOwned(s: Site): boolean {
  const st = statusOf(s)
  return !!(st.notOwned && !st.notAdded)
}
function showClearCookie(s: Site): boolean {
  // 纯未拥有：无鉴权会话，不展示清 Cookie
  const st = statusOf(s)
  if (st.notOwned && !st.notAdded) return false
  return !!(s.browserCookies || st.browser || st.notAdded)
}

function siteIconKey(s: Site): string | null {
  const domain = (s.domain || hostnameOf(s.url || '')).toLowerCase()
  return (domain && siteIconMap.value[domain]) || null
}

function avatarChar(s: Site): string {
  const name = (s.name || s.domain || '?').replace(/^www\./i, '')
  return name.charAt(0).toUpperCase() || '?'
}

const SITE_AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
  'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
  'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
] as const

function avatarBg(s: Site): string {
  const name = (s.domain || s.name || '').replace(/^www\./i, '')
  return stablePaletteValue(name, SITE_AVATAR_GRADIENTS)
}

function onIconError(e: Event): void {
  ;(e.target as HTMLImageElement).style.display = 'none'
}
function siteLink(site: Site): string {
  return site.url || (site.domain ? `https://${site.domain}` : '')
}

function openLink(url?: string): void {
  if (!url) return
  try {
    void chrome.tabs
      .create({ url })
      .catch(() => window.open(url, '_blank'))
  } catch {
    window.open(url, '_blank')
  }
}

function openSiteDomain(event: MouseEvent, url?: string): void {
  // 鼠标中键保留原生 <a> 行为，由浏览器直接在新标签页打开。
  if (!url || event.button === 1) return
  event.preventDefault()
  openLink(url)
}

// 计算属性
const filteredSites = computed<Site[]>(() => {
  if (loading.value) return []
  const filtered = applySiteFilters(siteRows.value, filters)
    .map((r) => r.site!)
    .filter(Boolean)
  const keyword = siteSearch.value.trim().toLowerCase()
  if (!keyword) return filtered
  return filtered.filter((site) =>
    [site.name, site.domain, site.url]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(keyword)),
  )
})
const configuredCount = computed(() => configuredCache.value.length)
const supportingCount = computed(() => Object.keys(supportingDetails.value).length)
const pendingCount = computed(
  () =>
    filteredSites.value.filter(
      (s) =>
        !!(s.cookieDiff || s.uaDiff) &&
        !!s.id &&
        !s.isDisabled &&
        !s.isUpdateDisabled,
    ).length,
)
const canOverwrite = computed(() =>
  filteredSites.value.some((s) => {
    const st = statusOf(s)
    return !!s.id && !!s.cookie && !isApiSite(s) && !s.isDisabled && (s.cookieDiff || st.notLoggedIn)
  }),
)
const canUpdate = computed(() =>
  filteredSites.value.some(
    (s) =>
      !!s.id &&
      !!(s.cookieDiff || s.uaDiff) &&
      !s.isDisabled &&
      !s.isUpdateDisabled,
  ),
)

// 筛选持久化
async function saveFilters(): Promise<void> {
  const active = (Object.entries(filters) as [SiteFilterKey, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => k)
  await storageSet(STORAGE_KEYS.SITE_FILTERS, active)
}
async function loadFilters(): Promise<void> {
  const saved = await storageGet<unknown>(STORAGE_KEYS.SITE_FILTERS)
  Object.assign(filters, migrateSiteFilters(saved))
}
async function onFilterChange(): Promise<void> {
  await saveFilters()
  rebuildRows()
}

// 批量操作
async function openAll(): Promise<void> {
  const list = filteredSites.value
  if (!list.length) return
  try {
    for (let i = 0; i < list.length; i += 5) {
      const batch = list.slice(i, i + 5)
      await Promise.all(
        batch.map((s) =>
          chrome.tabs.create({ url: s.url || `https://${s.domain}`, active: false }),
        ),
      )
      if (i + 5 < list.length) await new Promise((r) => setTimeout(r, 500))
    }
    ElMessage.success(`已打开 ${list.length} 个站点`)
  } catch {
    ElMessage.error('打开站点失败')
  }
}

async function overwriteAll(): Promise<void> {
  const list = filteredSites.value.filter((s) => {
    const st = statusOf(s)
    return !!s.cookie && !isApiSite(s) && !s.isDisabled && (s.cookieDiff || st.notLoggedIn)
  })
  if (!list.length) return
  try {
    await confirmAction(`确定将 ${list.length} 个站点的服务器 Cookie 覆盖到浏览器吗？`, {
      title: '确认覆盖',
      kind: 'warning',
      confirmButtonText: '确定覆盖',
    })
  } catch {
    return
  }
  let ok = 0
  const fails: string[] = []
  for (const s of list) {
    try {
      const res = await overwriteSiteCookie(s)
      if (res.ok) ok++
      else fails.push(`${s.name || s.domain || s.id}: ${res.failed.join(', ') || '未知'}`)
    } catch {
      fails.push(`${s.name || s.domain || s.id || ''}`)
    }
  }
  await refresh()
  if (fails.length) {
    ElMessage.warning(`已覆盖 ${ok} 个，失败 ${fails.length} 个：${fails.join('；')}`)
  } else {
    ElMessage.success(`已覆盖 ${ok} 个站点`)
  }
}

async function updateAll(): Promise<void> {
  const list = filteredSites.value.filter(
    (s) => (s.cookieDiff || s.uaDiff) && !s.isDisabled && !s.isUpdateDisabled,
  )
  if (!list.length) return
  try {
    await confirmAction(`确定要更新 ${list.length} 个有差异的站点信息吗？`, {
      title: '确认更新',
      kind: 'warning',
      confirmButtonText: '确定',
    })
  } catch {
    return
  }
  let ok = 0
  for (const s of list) {
    try {
      if ((await syncSiteToServer(s)).ok) ok++
    } catch {
      /* 单个站点同步失败时继续处理其余站点。 */
    }
  }
  await refresh()
  ElMessage.success(`已更新 ${ok} 个站点`)
}

// 单站操作
async function doOverwrite(s: Site): Promise<void> {
  try {
    const res = await overwriteSiteCookie(s)
    if (!res.ok) {
      ElMessage.error(`覆盖失败：${res.failed.join(', ') || '未知'}`)
      return
    }
    await refresh()
    ElMessage.success('Cookie 覆盖成功')
  } catch {
    ElMessage.error('覆盖失败')
  }
}
async function doUpdate(s: Site): Promise<void> {
  try {
    const result = await syncSiteToServer(s)
    if (result.ok) {
      await refresh()
      ElMessage.success('站点信息更新成功')
    } else {
      ElMessage.error(result.message || '更新失败')
    }
  } catch {
    ElMessage.error('更新失败')
  }
}
function doLogin(s: Site): void {
  openLink(siteLink(s))
}
async function onMenu(command: string, s: Site): Promise<void> {
  switch (command) {
    case 'visit':
      openLink(siteLink(s))
      break
    case 'test':
      await doTest(s)
      break
    case 'edit':
      openEdit(s)
      break
    case 'addDomainAlias':
      await openDomainAliasManager(s)
      break
    case 'toggleDisable':
      await toggleDisable(s)
      break
    case 'toggleUpdateDisable':
      await toggleUpdateDisable(s)
      break
    case 'clearCookie':
      await clearCookie(s)
      break
    case 'delete':
      await onDelete(s)
      break
    case 'add':
      openAddForSite(s)
      break
  }
}
async function openDomainAliasManager(s: Site): Promise<void> {
  if (!s.id) return
  aliasSite.value = s
  aliasInput.value = ''
  aliasDomains.value = (await loadCustomDomainAliases())
    .filter((alias) => String(alias.siteId) === String(s.id))
    .map((alias) => alias.domain)
  aliasDialogVisible.value = true
}

async function addAliasToSite(): Promise<void> {
  const site = aliasSite.value
  const value = aliasInput.value.trim()
  if (!site?.id || !value) {
    ElMessage.warning('请输入备用域名')
    return
  }

  aliasSaving.value = true
  try {
    await addCustomDomainAlias(site.id, value)
    aliasDomains.value = (await loadCustomDomainAliases())
      .filter((alias) => String(alias.siteId) === String(site.id))
      .map((alias) => alias.domain)
    aliasInput.value = ''
    ElMessage.success('备用域名已关联')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存备用域名失败')
  } finally {
    aliasSaving.value = false
  }
}

async function removeAliasFromSite(domain: string): Promise<void> {
  const site = aliasSite.value
  if (!site?.id) return

  try {
    await removeCustomDomainAlias(domain)
    aliasDomains.value = aliasDomains.value.filter((alias) => alias !== domain)
    ElMessage.success('备用域名已移除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '移除备用域名失败')
  }
}

async function setAliasAsPrimary(domain: string): Promise<void> {
  const site = aliasSite.value
  const nextDomain = hostnameOf(domain)
  const currentDomain = site?.domain || ''
  if (!site?.id || !currentDomain || !nextDomain) return

  try {
    await confirmAction(`将「${domain}」设为主域名后，原主域名会自动保留为备用域名。`, {
      title: '切换主域名',
      confirmButtonText: '确认切换',
    })
  } catch {
    return
  }

  aliasSwitching.value = domain
  try {
    const baseUrl = site.url || `https://${currentDomain}`
    const parsed = new URL(baseUrl)
    parsed.hostname = nextDomain
    const nextSite = {
      ...site,
      domain: nextDomain,
      url: parsed.toString(),
    }
    const result = await updateSite(nextSite)
    if (!result.ok) throw new Error(result.message || '主域名更新失败')

    await swapPrimaryDomainAlias(site.id, currentDomain, nextDomain)
    aliasSite.value = nextSite
    const index = sites.value.findIndex((item) => item.id === site.id)
    if (index >= 0) sites.value[index] = nextSite
    aliasDomains.value = (await loadCustomDomainAliases())
      .filter((alias) => String(alias.siteId) === String(site.id))
      .map((alias) => alias.domain)
    ElMessage.success('主域名已切换')
    await refresh()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '切换主域名失败')
  } finally {
    aliasSwitching.value = ''
  }
}

function resetAliasDialog(): void {
  aliasSite.value = null
  aliasInput.value = ''
  aliasDomains.value = []
  aliasSaving.value = false
  aliasSwitching.value = ''
}

async function doTest(s: Site): Promise<void> {
  try {
    const ok = await testConnection(s)
    if (ok) {
      ElMessage.success(`「${s.name || s.domain}」连接测试成功`)
    } else {
      ElMessage.error(`「${s.name || s.domain}」连接测试失败`)
    }
  } catch {
    ElMessage.error('连接测试失败')
  }
}
async function toggleDisable(s: Site): Promise<void> {
  s.isDisabled = !s.isDisabled
  await saveDisableState(s, !!s.isDisabled)
  ElMessage.success(s.isDisabled ? '站点已禁用' : '站点已开启')
}
async function toggleUpdateDisable(s: Site): Promise<void> {
  s.isUpdateDisabled = !s.isUpdateDisabled
  await saveUpdateDisableState(s, !!s.isUpdateDisabled)
  ElMessage.success(s.isUpdateDisabled ? '已禁用一键更新' : '已启用一键更新')
}
async function clearCookie(s: Site): Promise<void> {
  try {
    await confirmDelete(`确定删除浏览器中「${s.name || s.domain}」的 Cookie 吗？`, {
      title: '确认删除',
      confirmButtonText: '确定删除',
    })
  } catch {
    return
  }
  const n = await clearSiteBrowserCookie(s)
  await refresh()
  ElMessage.success(`已删除 ${n} 个 Cookie`)
}

// 对话框
function openCreate(): void {
  editing.value = null
  Object.assign(form, emptyForm())
  siteType.value = 'cookie'
  isLimit.value = false
  dialogVisible.value = true
}
function fillCurrentUserAgent(): void {
  form.ua = navigator.userAgent || ''
  if (form.ua) ElMessage.success('已填充当前浏览器 User-Agent')
  else ElMessage.warning('无法读取当前浏览器 User-Agent')
}

/** 按表单中的站点地址，读取浏览器 Cookie 并填充 */
async function fillSiteCookieFromBrowser(): Promise<void> {
  const url = (form.url || '').trim()
  if (!url) {
    ElMessage.warning('请先填写站点地址')
    return
  }
  const host = hostnameOf(url)
  if (!host) {
    ElMessage.warning('站点地址无效，无法解析域名')
    return
  }
  fetchingCookie.value = true
  try {
    const cookie = await getDomainCookies(url)
    form.cookie = cookie
    if (cookie) ElMessage.success(`已获取 ${host} 的浏览器 Cookie`)
    else ElMessage.warning(`未找到 ${host} 的浏览器 Cookie`)
  } catch (e) {
    ElMessage.error(`获取 Cookie 失败: ${String(e)}`)
  } finally {
    fetchingCookie.value = false
  }
}

function openEdit(s: Site): void {
  editing.value = s
  const anySite = s as Site & { proxy?: number | boolean; render?: number | boolean }
  Object.assign(form, emptyForm(), {
    url: s.url ?? '',
    rss: s.rss ?? '',
    cookie: s.cookie ?? '',
    ua: s.ua ?? '',
    apikey: s.apikey ?? '',
    token: s.token ?? '',
    pri: s.pri ?? 0,
    timeout: s.timeout != null ? String(s.timeout) : '',
    downloader: s.downloader ?? '',
    is_active: s.is_active ?? true,
    proxy:
      s.is_proxy !== undefined
        ? !!s.is_proxy
        : Number(anySite.proxy) === 1 || anySite.proxy === true,
    render:
      s.is_browser_simulated !== undefined
        ? !!s.is_browser_simulated
        : Number(anySite.render) === 1 || anySite.render === true,
    limit_interval: s.limit_interval ?? 0,
    limit_count: s.limit_count ?? 0,
    limit_seconds: s.limit_seconds ?? 0,
  })
  siteType.value = s.apikey || s.token ? 'api' : 'cookie'
  isLimit.value = !!(s.limit_interval || s.limit_count || s.limit_seconds)
  dialogVisible.value = true
}
function openAddForSite(s: Site): void {
  editing.value = null
  Object.assign(form, emptyForm(), {
    url: s.url ?? '',
    rss: s.rss ?? '',
    cookie: s.browserCookies ?? '',
    ua: navigator.userAgent,
    is_active: true,
    pri: 0,
  })
  siteType.value = 'cookie'
  isLimit.value = false
  dialogVisible.value = true
}
function resetForm(): void {
  editing.value = null
  Object.assign(form, emptyForm())
  siteType.value = 'cookie'
  isLimit.value = false
}

async function onSave(): Promise<void> {
  const url = form.url.trim()
  if (!url) {
    ElMessage.warning('请输入站点地址')
    return
  }
  if (!/^https?:\/\/.+/.test(url)) {
    ElMessage.warning('请输入有效的 URL 地址')
    return
  }

  const domain = hostnameOf(url) || (editing.value?.domain ?? '')
  const name = editing.value?.name || domain || url
  const timeout = form.timeout ? parseInt(form.timeout, 10) || 15 : 15

  const payload: Record<string, unknown> = {
    url,
    rss: form.rss,
    pri: form.pri,
    timeout,
    downloader: form.downloader || '',
    is_active: form.is_active,
    // 表单字段转换为 MoviePilot 站点接口字段。
    proxy: form.proxy ? 1 : 0,
    render: form.render ? 1 : 0,
    is_proxy: form.proxy,
    is_browser_simulated: form.render,
    is_limited: isLimit.value,
    name,
    domain,
    icon: editing.value?.icon ?? '',
  }

  if (siteType.value === 'cookie') {
    payload.cookie = form.cookie
    payload.ua = form.ua
    payload.apikey = ''
    payload.token = ''
  } else {
    payload.apikey = form.apikey
    payload.token = form.token
    payload.cookie = ''
    payload.ua = ''
  }

  if (isLimit.value) {
    payload.limit_interval = form.limit_interval || 0
    payload.limit_count = form.limit_count || 0
    payload.limit_seconds = form.limit_seconds || 0
  } else {
    payload.limit_interval = 0
    payload.limit_count = 0
    payload.limit_seconds = 0
  }

  saving.value = true
  try {
    let result: { ok: boolean; message?: string }
    if (editing.value && editing.value.id) {
      // 合并原始站点字段，避免漏传导致后端覆盖为空
      const updateData = {
        ...(editing.value as Site),
        ...payload,
        id: editing.value.id,
        name: editing.value.name || name,
        domain: editing.value.domain || domain,
      } as Site
      result = await updateSite(updateData)
    } else {
      result = await createSite(payload as Omit<Site, 'id'>)
    }
    if (result.ok) {
      ElMessage.success(editing.value ? '更新成功' : '添加成功')
      dialogVisible.value = false
      await refresh()
    } else {
      ElMessage.error(result.message || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

async function onDelete(s: Site): Promise<void> {
  try {
    await confirmDelete(`确认删除站点「${s.name || s.domain}」？`)
  } catch {
    return
  }
  const result = await deleteSite(s.id)
  if (result.ok) {
    ElMessage.success('已删除')
    await refresh()
  } else {
    ElMessage.error(result.message || '删除失败')
  }
}

void loadFilters()
</script>

<style scoped>
.site-manage {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

/* 站点列表是页面唯一滚动容器，避免外层 mp-view 与内容区出现双重滚动条。 */
.sm-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}
/* 统计面板 */
.sm-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.sm-stat {
  border: none;
  border-radius: var(--mp-radius);
  padding: 8px 7px;
  text-align: center;
  transition: border-color 0.18s var(--mp-ease);
}
.sm-stat-num {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.15;
}
.sm-stat-label {
  font-size: 10px;
  font-weight: 500;
  margin-top: 1px;
}
/* 已适配 - 青色 */
.sm-stat--supporting {
  background: linear-gradient(135deg, #e0f7fa 0%, #e8f5e9 100%);
  border-color: #b2dfdb;
}
.sm-stat--supporting .sm-stat-num {
  color: #00838f;
}
.sm-stat--supporting .sm-stat-label {
  color: #006064;
}
/* 已配置 - 蓝色 */
.sm-stat--config {
  background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  border-color: #bbdefb;
}
.sm-stat--config .sm-stat-num {
  color: #1976d2;
}
.sm-stat--config .sm-stat-label {
  color: #1565c0;
}
/* 过滤后 - 橙色 */
.sm-stat--filtered {
  background: linear-gradient(135deg, #fff3e0 0%, #fce4ec 100%);
  border-color: #ffcc80;
}
.sm-stat--filtered .sm-stat-num {
  color: #f57c00;
}
.sm-stat--filtered .sm-stat-label {
  color: #ef6c00;
}
/* 待更新 - 紫色 */
.sm-stat--pending {
  background: linear-gradient(135deg, #f3e5f5 0%, #e8eaf6 100%);
  border-color: #ce93d8;
}
.sm-stat--pending .sm-stat-num {
  color: #7b1fa2;
}
.sm-stat--pending .sm-stat-label {
  color: #6a1b9a;
}
/* 工具栏（筛选区卡片化） */
.sm-toolbar {
  --sm-ctrl-h: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 6px 12px;
  background: var(--mp-color-surface);
  border: 1px solid var(--mp-color-border);
  border-radius: var(--mp-radius);
  box-sizing: border-box;
  min-height: 132px;
  overflow: hidden;
}
/* 站点筛选 */
.sm-filters {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 10px;
  align-self: center;
  width: 100%;
  max-width: 320px;
}
.sm-filters :deep(.el-checkbox) {
  margin-right: 0;
}
/* 功能按钮与搜索行共用四列网格，添加按钮和上方单个按钮等宽。 */
.sm-tools,
.sm-search-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: center;
  gap: 4px;
  align-self: center;
  width: 100%;
  max-width: 320px;
}
.sm-tools .el-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  width: 100%;
  height: var(--sm-ctrl-h);
  padding: 0 4px;
  font-size: 11px;
  line-height: 1;
  border-radius: var(--el-border-radius-base);
  margin-left: 0;
  transition: background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.sm-search-input {
  grid-column: 1 / 4;
  min-width: 0;
  height: var(--sm-ctrl-h);
}
.sm-search-input :deep(.el-input__wrapper) {
  height: var(--sm-ctrl-h);
  min-height: var(--sm-ctrl-h);
  padding: 0 8px;
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-blank);
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
}
.sm-search-input :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-border-color-hover) inset;
}
.sm-search-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}
.sm-search-input :deep(.el-input__inner) {
  height: var(--sm-ctrl-h);
  line-height: var(--sm-ctrl-h);
  font-size: 11px;
}
.sm-search-icon {
  width: 13px;
  height: 13px;
  color: var(--el-text-color-placeholder);
  fill: currentColor;
  opacity: 0.72;
}
.sm-add-site-btn.el-button {
  grid-column: 4;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: var(--sm-ctrl-h);
  min-height: var(--sm-ctrl-h);
  margin: 0;
  padding: 0 6px;
  border-radius: var(--el-border-radius-base);
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}
.sm-add-site-btn .sm-btn-icon {
  width: 13px;
  height: 13px;
  margin-right: 3px;
  fill: currentColor;
  flex-shrink: 0;
}

/* 工具栏按钮 hover 实色填充；禁用按钮不响应悬停。 */
.sm-tool-btn:not(:disabled):hover {
  background: #6366f1 !important;
  border-color: #6366f1 !important;
  color: #fff !important;
}
.sm-tool-btn.el-button--danger:not(:disabled):hover {
  background: #ef4444 !important;
  border-color: #ef4444 !important;
  color: #fff !important;
}
.sm-tool-btn.el-button--primary:not(:disabled):hover {
  background: #2563eb !important;
  border-color: #2563eb !important;
  color: #fff !important;
}

/* 只校正两排操作按钮的 EP 内层 span，避免影响页面内其他按钮。 */
.sm-tools :deep(.el-button > span),
.sm-actions :deep(.sm-act-btn > span) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.sm-actions :deep(.sm-act-btn > span) {
  gap: 3px;
}
.sm-tools .el-button:first-child {
  margin-left: 0;
}
.sm-tools .el-button .sm-btn-icon {
  display: inline-block;
  vertical-align: middle;
  width: 13px;
  height: 13px;
  margin-right: 3px;
  fill: currentColor;
  flex-shrink: 0;
}
/* 刷新按钮加载态：CSS 旋转替代 EP loading，避免额外图标导致按钮宽度变化 */
.sm-spin {
  animation: sm-spin 1s linear infinite;
}
@keyframes sm-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
/* 站点列表使用两行卡片布局。 */
.sm-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  /* 允许首卡 hover 上浮阴影溢出，避免顶边被裁切 */
  overflow: visible;
  padding: 2px 1px 4px;
  margin: -2px -1px -4px;
}
/* 卡片 */
.sm-card {
  background: var(--mp-color-card, #fff);
  border: 1px solid var(--mp-color-border, #e2e8f0);
  border-radius: 12px;
  padding: 9px 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 1px 3px rgba(15, 23, 42, 0.06);
  transition:
    border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 0;
  overflow: hidden;
  box-sizing: border-box;
  width: 100%;
}
.sm-card:hover {
  z-index: 2;
  border-color: rgba(59, 130, 246, 0.28);
  box-shadow:
    0 2px 6px rgba(15, 23, 42, 0.06),
    0 8px 20px rgba(15, 23, 42, 0.08),
    0 0 0 1px rgba(59, 130, 246, 0.06);
  transform: translateY(-1px);
}
.sm-card--inactive {
  opacity: 0.7;
}
.sm-card--inactive .sm-name {
  color: #64748b;
}
.sm-card--inactive .sm-domain {
  color: #94a3b8;
}
.sm-card--disabled {
  opacity: 0.65;
}
.sm-card--disabled .sm-avatar {
  filter: grayscale(1) brightness(0.9);
}
/* 卡片顶行 */
.sm-card-head {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: nowrap;
  min-width: 0;
}
/* 头像：有图标时不加背景/阴影，占位字母才用渐变底 */
.sm-avatar {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);
}
.sm-avatar.has-icon {
  background: transparent !important;
  box-shadow: none;
  color: inherit;
}
.sm-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: inherit;
  display: block;
  background: transparent;
}
/* 站点名称区 */
.sm-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sm-name {
  font-weight: 700;
  font-size: 12.5px;
  color: var(--mp-color-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.25;
}
.sm-domain {
  font-size: 10px;
  color: #3b82f6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
}
.sm-domain-icon {
  flex-shrink: 0;
  fill: currentColor;
}
.sm-domain:hover {
  text-decoration: underline;
}
/* 站点状态标签 */
.sm-card-head-tags {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
  flex-shrink: 0;
  max-width: 112px !important;
  overflow: hidden;
}
.sm-card-head-tags .sm-tag {
  display: inline-flex;
  align-items: center;
  height: 16px;
  padding: 0 5px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 600;
  border: 1px solid transparent;
  white-space: nowrap !important;
}
.sm-tag--disabled {
  background: rgba(100, 116, 139, 0.14);
  color: #475569;
  border-color: rgba(100, 116, 139, 0.30);
}
.sm-tag--api {
  background: rgba(139, 92, 246, 0.10);
  color: #7c3aed;
  border-color: rgba(139, 92, 246, 0.25);
}
.sm-tag--public {
  background: rgba(34, 197, 94, 0.10);
  color: #16a34a;
  border-color: rgba(34, 197, 94, 0.25);
}
.sm-tag--cookie {
  background: rgba(245, 158, 11, 0.10);
  color: #d97706;
  border-color: rgba(245, 158, 11, 0.25);
}
.sm-tag--ua {
  background: rgba(6, 182, 212, 0.10);
  color: #0891b2;
  border-color: rgba(6, 182, 212, 0.25);
}
.sm-tag--login {
  background: rgba(249, 115, 22, 0.10);
  color: #ea580c;
  border-color: rgba(249, 115, 22, 0.25);
}
.sm-tag--not-added {
  background: rgba(20, 184, 166, 0.10);
  color: #0d9488;
  border-color: rgba(20, 184, 166, 0.25);
}
.sm-tag--unsupported {
  background: rgba(100, 116, 139, 0.10);
  color: #64748b;
  border-color: rgba(100, 116, 139, 0.25);
}
/* 站点操作区 */
.sm-card-bottom {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding-top: 6px;
  border-top: 1px dashed rgba(15, 23, 42, 0.08);
}
.sm-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.sm-more-wrap {
  position: relative;
  margin-left: auto;
  flex-shrink: 0;
}
.sm-more {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  padding: 0;
  background: #f8fafc;
  color: #475569;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}
.sm-more svg {
  fill: currentColor;
}
.sm-more:hover {
  background: #e2e8f0;
  color: #0f172a;
}
.sm-actions .sm-act-btn.el-button {
  height: 24px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin: 0;
  border: none;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.sm-actions .sm-act-btn svg {
  fill: currentColor;
  flex-shrink: 0;
}
.sm-act-update {
  background: rgba(59, 130, 246, 0.08);
  color: #60a5fa;
}
.sm-act-overwrite {
  background: rgba(239, 68, 68, 0.08);
  color: #f87171;
}
.sm-act-login {
  background: rgba(16, 185, 129, 0.08);
  color: #34d399;
}
.sm-act-add {
  background: rgba(99, 102, 241, 0.08);
  color: #818cf8;
}
/* 统一普通/暗色主题的卡片按钮悬停色；自定义背景在全局主题文件中覆盖。 */
.sm-actions .sm-act-update:not(:disabled):hover {
  background: #3b82f6 !important;
  color: #fff !important;
}
.sm-actions .sm-act-overwrite:not(:disabled):hover {
  background: #ef4444 !important;
  color: #fff !important;
}
.sm-actions .sm-act-login:not(:disabled):hover {
  background: #10b981 !important;
  color: #fff !important;
}
.sm-actions .sm-act-add:not(:disabled):hover {
  background: #6366f1 !important;
  color: #fff !important;
}

/* 暗色主题 */
:global(html[data-theme='dark']) .sm-card {
  background: var(--mp-color-card, #1e293b);
  border-color: var(--mp-color-border, #334155);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.2),
    0 1px 3px rgba(0, 0, 0, 0.25);
}
:global(html[data-theme='dark']) .sm-card:hover {
  border-color: rgba(96, 165, 250, 0.35);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.28),
    0 10px 22px rgba(0, 0, 0, 0.32),
    0 0 0 1px rgba(96, 165, 250, 0.1);
}
:global(html[data-theme='dark']) .sm-name {
  color: var(--mp-color-text, #f1f5f9);
}
:global(html[data-theme='dark']) .sm-domain {
  color: #60a5fa;
}
:global(html[data-theme='dark']) .sm-card--inactive .sm-name {
  color: #94a3b8;
}
:global(html[data-theme='dark']) .sm-card--inactive .sm-domain {
  color: #64748b;
}
:global(html[data-theme='dark']) .sm-card-bottom {
  border-top-color: rgba(148, 163, 184, 0.16);
}
/* 更多操作：!important 覆盖浅色 #f8fafc 底 */
:global(html[data-theme='dark']) .sm-more {
  background: #334155 !important;
  color: #cbd5e1 !important;
}
:global(html[data-theme='dark']) .sm-more:hover {
  background: #475569 !important;
  color: #e2e8f0 !important;
}
:global(html[data-theme='dark']) .sm-more svg,
:global(html[data-theme='dark']) .sm-more svg path {
  color: inherit !important;
  fill: currentColor !important;
}
:global(html[data-theme='dark']) .sm-act-update {
  background: rgba(59, 130, 246, 0.16);
  color: #93c5fd;
}
:global(html[data-theme='dark']) .sm-act-overwrite {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
}
:global(html[data-theme='dark']) .sm-act-login {
  background: rgba(16, 185, 129, 0.16);
  color: #6ee7b7;
}
:global(html[data-theme='dark']) .sm-act-add {
  background: rgba(99, 102, 241, 0.16);
  color: #a5b4fc;
}

/* 顶部统计卡深色规则使用高优先级覆盖浅色渐变。 */
:global(html[data-theme='dark']) .sm-stat {
  border-color: #334155 !important;
  background: #1e293b !important;
}
:global(html[data-theme='dark']) .sm-stat--supporting {
  background: linear-gradient(
    135deg,
    rgba(0, 131, 143, 0.18) 0%,
    rgba(30, 41, 59, 0.92) 100%
  ) !important;
  border-color: rgba(0, 131, 143, 0.32) !important;
}
:global(html[data-theme='dark']) .sm-stat--supporting .sm-stat-num {
  color: #22d3ee !important;
}
:global(html[data-theme='dark']) .sm-stat--supporting .sm-stat-label {
  color: #06b6d4 !important;
}
:global(html[data-theme='dark']) .sm-stat--config {
  background: linear-gradient(
    135deg,
    rgba(25, 118, 210, 0.18) 0%,
    rgba(30, 41, 59, 0.92) 100%
  ) !important;
  border-color: rgba(25, 118, 210, 0.32) !important;
}
:global(html[data-theme='dark']) .sm-stat--config .sm-stat-num {
  color: #60a5fa !important;
}
:global(html[data-theme='dark']) .sm-stat--config .sm-stat-label {
  color: #3b82f6 !important;
}
:global(html[data-theme='dark']) .sm-stat--filtered {
  background: linear-gradient(
    135deg,
    rgba(245, 124, 0, 0.18) 0%,
    rgba(30, 41, 59, 0.92) 100%
  ) !important;
  border-color: rgba(245, 124, 0, 0.32) !important;
}
:global(html[data-theme='dark']) .sm-stat--filtered .sm-stat-num {
  color: #fbbf24 !important;
}
:global(html[data-theme='dark']) .sm-stat--filtered .sm-stat-label {
  color: #f59e0b !important;
}
:global(html[data-theme='dark']) .sm-stat--pending {
  background: linear-gradient(
    135deg,
    rgba(123, 31, 162, 0.18) 0%,
    rgba(30, 41, 59, 0.92) 100%
  ) !important;
  border-color: rgba(123, 31, 162, 0.32) !important;
}
:global(html[data-theme='dark']) .sm-stat--pending .sm-stat-num {
  color: #c084fc !important;
}
:global(html[data-theme='dark']) .sm-stat--pending .sm-stat-label {
  color: #a855f7 !important;
}
:global(html[data-theme='dark']) .sm-toolbar {
  background: #1e293b !important;
  border-color: #334155 !important;
}
:global(html[data-theme='dark']) .sm-search-input :deep(.el-input__wrapper) {
  background: #0f172a !important;
  box-shadow: 0 0 0 1px #334155 inset !important;
}
:global(html[data-theme='dark']) .sm-search-input :deep(.el-input__inner) {
  color: #e2e8f0 !important;
}
:global(html[data-theme='dark']) .sm-search-icon {
  color: #94a3b8 !important;
}

/* 更多操作下拉： SiteManagement.vue */
.dropdown-item-content {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.mr-1 {
  width: 14px;
  height: 14px;
  fill: currentColor;
  flex-shrink: 0;
}
.text-danger,
:deep(.text-danger) {
  color: #ef4444;
}
/* popper 挂到 body，需 :global */
:global(.sm-site-dropdown .dropdown-item-content) {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
:global(.sm-site-dropdown .mr-1) {
  width: 14px;
  height: 14px;
  fill: currentColor;
  flex-shrink: 0;
}
:global(.sm-site-dropdown .text-danger) {
  color: #ef4444;
}
:global(.sm-site-dropdown .delete-menu-item:hover) {
  background-color: #fef2f2 !important;
  color: #ef4444 !important;
}
:global(html[data-theme='dark'] .sm-site-dropdown .el-dropdown-menu) {
  background: #1e293b;
  border-color: #334155;
}
:global(html[data-theme='dark'] .sm-site-dropdown .el-dropdown-menu__item) {
  color: #e2e8f0;
}
:global(html[data-theme='dark'] .sm-site-dropdown .el-dropdown-menu__item:not(.is-disabled):hover) {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}
:global(html[data-theme='dark'] .sm-site-dropdown .text-danger) {
  color: #f87171;
}
:global(html[data-theme='dark'] .sm-site-dropdown .delete-menu-item:hover) {
  background-color: rgba(239, 68, 68, 0.12) !important;
  color: #f87171 !important;
}

/* 添加与编辑站点弹窗 */
/* 遮罩与弹窗只覆盖主内容区：侧栏 48px + 顶栏 44px 保持可见 */
:global(.site-dialog-modal.el-overlay) {
  left: 48px !important;
  top: 44px !important;
  right: 0 !important;
  bottom: 0 !important;
  width: auto !important;
  height: auto !important;
  background: rgba(15, 23, 42, 0.28) !important;
}

:global(.site-dialog.el-dialog.is-fullscreen),
:global(.site-dialog.el-dialog) {
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  margin: 0 !important;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  display: flex !important;
  flex-direction: column;
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
}

:global(.site-dialog .el-dialog__header) {
  flex-shrink: 0;
  padding: 10px 12px 8px;
  margin-right: 0;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

:global(.site-dialog .el-dialog__headerbtn) {
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
}

:global(.site-dialog .el-dialog__title) {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

:global(.site-dialog .el-dialog__body) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding: 0;
  display: flex;
  flex-direction: column;
}

:global(.site-dialog .el-dialog__footer) {
  flex-shrink: 0;
  padding: 8px 12px 10px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}

/* 单一滚动容器：滚动条贴内容区右侧 */
.dialog-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 10px 10px 12px;
  box-sizing: border-box;
}

.dialog-content::-webkit-scrollbar {
  width: 4px;
}

.dialog-content::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.35);
  border-radius: 6px;
}

.dialog-content::-webkit-scrollbar-track {
  background: transparent;
}

.site-form {
  max-width: 100%;
}

.main-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.bottom-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group {
  margin-bottom: 8px;
}

.bottom-section .form-group {
  margin-bottom: 0;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

/* 用 color + path fill:currentColor，避免深色全局规则把图标刷成文字色 */
.label-icon {
  color: #6b7280;
  fill: currentColor;
  flex-shrink: 0;
}

.label-icon path {
  fill: currentColor;
}

.form-label .label-icon[data-icon='mdiToggleSwitch'] {
  color: #10b981;
}
.form-label .label-icon[data-icon='mdiPriorityHigh'] {
  color: #f59e0b;
}
.form-label .label-icon[data-icon='mdiTimer'] {
  color: #8b5cf6;
}
.form-label .label-icon[data-icon='mdiDownload'] {
  color: #06b6d4;
}
.form-label .label-icon[data-icon='mdiWeb'] {
  color: #3b82f6;
}
.form-label .label-icon[data-icon='mdiRss'] {
  color: #f97316;
}
.form-label .label-icon[data-icon='mdiCookie'] {
  color: #84cc16;
}
.form-label .label-icon[data-icon='mdiAccount'] {
  color: #6366f1;
}
.form-label .label-icon[data-icon='mdiKey'] {
  color: #ef4444;
}
.form-label .label-icon[data-icon='mdiApi'] {
  color: #ec4899;
}

.form-input,
.form-select,
.form-textarea,
.form-input-number {
  width: 100%;
}

.form-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.form-label-row .form-label {
  margin-bottom: 0;
}

.field-fill-btn {
  flex: 0 0 auto;
  margin: 0 !important;
  padding: 0 10px !important;
  height: 26px !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  color: #6366f1 !important;
  background: #eef2ff !important;
  border: 1px solid #c7d2fe !important;
  border-radius: 6px !important;
}

.field-fill-btn:hover {
  color: #4f46e5 !important;
  background: #e0e7ff !important;
  border-color: #a5b4fc !important;
}

.ua-input :deep(.el-input-group__append) {
  padding: 0;
  background: transparent;
  border-color: var(--el-border-color);
}

.ua-fill-btn {
  height: 100% !important;
  border: none !important;
  border-radius: 0 6px 6px 0 !important;
  padding: 0 12px !important;
}

.form-hint {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
  line-height: 1.4;
}

.auth-section {
  margin-bottom: 12px;
}

.auth-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}

.auth-tabs :deep(.el-tabs__item) {
  padding: 0 14px;
  height: 36px;
  font-weight: 500;
  color: #6b7280;
}

.auth-tabs :deep(.el-tabs__item.is-active) {
  color: #6366f1;
  font-weight: 600;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tab-icon {
  color: inherit;
  fill: currentColor;
}

.tab-icon path {
  fill: currentColor;
}

.tab-icon[data-icon='mdiCookie'] {
  color: #84cc16;
}

.tab-icon[data-icon='mdiApi'] {
  color: #ec4899;
}

.auth-tabs :deep(.el-tabs__item.is-active) .tab-icon[data-icon='mdiCookie'] {
  color: #84cc16;
}

.auth-tabs :deep(.el-tabs__item.is-active) .tab-icon[data-icon='mdiApi'] {
  color: #ec4899;
}

.auth-content {
  padding: 4px 0 8px;
}

.bottom-options {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 20px;
  margin-bottom: 12px;
  padding: 10px 4px;
  user-select: none;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.limit-settings {
  padding: 4px 0 8px;
  margin-bottom: 8px;
}

.limit-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 10px;
}

.limit-fields {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}

.limit-fields .form-group {
  margin-bottom: 0;
}

:global(html[data-theme='dark'] .site-dialog-modal.el-overlay) {
  background: rgba(2, 6, 23, 0.45) !important;
}

:global(html[data-theme='dark'] .site-dialog.el-dialog) {
  background: #1e293b !important;
  border-color: #334155 !important;
  color: #e2e8f0;
}

:global(html[data-theme='dark'] .site-dialog .el-dialog__header),
:global(html[data-theme='dark'] .site-dialog .el-dialog__footer) {
  border-color: rgba(148, 163, 184, 0.14);
  background: #1e293b;
}

:global(html[data-theme='dark'] .site-dialog .el-dialog__title) {
  color: #f1f5f9 !important;
}

:global(html[data-theme='dark'] .site-dialog .el-dialog__headerbtn .el-dialog__close) {
  color: #94a3b8;
}

:global(html[data-theme='dark'] .site-dialog .el-dialog__body) {
  color: #e2e8f0;
  background: #1e293b;
}

/*
 * append-to-body 弹窗：必须整段 :global(...)，
 * 不可写 :global(html[...]) .form-label（后者会带 data-v 作用域，teleport 后匹配失败）
 */
:global(html[data-theme='dark'] .site-dialog .dialog-content) {
  color: #e2e8f0;
}

:global(html[data-theme='dark'] .site-dialog .dialog-content::-webkit-scrollbar-thumb) {
  background: rgba(148, 163, 184, 0.35);
}

/* 状态 / 优先级 / 超时 / 下载器 等标题（主文字色，不过亮） */
:global(html[data-theme='dark'] .site-dialog .form-label) {
  color: #e2e8f0 !important;
  font-weight: 600 !important;
  opacity: 1 !important;
}

:global(html[data-theme='dark'] .site-dialog .option-label),
:global(html[data-theme='dark'] .site-dialog .limit-title) {
  color: #e2e8f0 !important;
  font-weight: 600 !important;
  opacity: 1 !important;
}

:global(html[data-theme='dark'] .site-dialog .form-hint) {
  color: #94a3b8 !important;
}

/* 标签图标：深色下提亮品牌色 */
:global(html[data-theme='dark'] .site-dialog .label-icon) {
  color: #cbd5e1 !important;
}

:global(html[data-theme='dark'] .site-dialog .form-label .label-icon[data-icon='mdiToggleSwitch']) {
  color: #34d399 !important;
}
:global(html[data-theme='dark'] .site-dialog .form-label .label-icon[data-icon='mdiPriorityHigh']) {
  color: #fbbf24 !important;
}
:global(html[data-theme='dark'] .site-dialog .form-label .label-icon[data-icon='mdiTimer']) {
  color: #a78bfa !important;
}
:global(html[data-theme='dark'] .site-dialog .form-label .label-icon[data-icon='mdiDownload']) {
  color: #22d3ee !important;
}
:global(html[data-theme='dark'] .site-dialog .form-label .label-icon[data-icon='mdiWeb']) {
  color: #60a5fa !important;
}
:global(html[data-theme='dark'] .site-dialog .form-label .label-icon[data-icon='mdiRss']) {
  color: #fb923c !important;
}
:global(html[data-theme='dark'] .site-dialog .form-label .label-icon[data-icon='mdiCookie']) {
  color: #a3e635 !important;
}
:global(html[data-theme='dark'] .site-dialog .form-label .label-icon[data-icon='mdiAccount']) {
  color: #818cf8 !important;
}
:global(html[data-theme='dark'] .site-dialog .form-label .label-icon[data-icon='mdiKey']) {
  color: #f87171 !important;
}
:global(html[data-theme='dark'] .site-dialog .form-label .label-icon[data-icon='mdiApi']) {
  color: #f472b6 !important;
}

:global(html[data-theme='dark'] .site-dialog .label-icon path) {
  fill: currentColor !important;
}

/* 认证 Tabs */
:global(html[data-theme='dark'] .site-dialog .auth-tabs .el-tabs__item) {
  color: #94a3b8 !important;
}

:global(html[data-theme='dark'] .site-dialog .auth-tabs .el-tabs__item.is-active) {
  color: #a5b4fc !important;
}

:global(html[data-theme='dark'] .site-dialog .auth-tabs .el-tabs__nav-wrap::after) {
  background-color: #334155;
}

:global(html[data-theme='dark'] .site-dialog .auth-tabs .el-tabs__active-bar) {
  background-color: #818cf8;
}

:global(html[data-theme='dark'] .site-dialog .tab-icon[data-icon='mdiCookie']) {
  color: #a3e635 !important;
}

:global(html[data-theme='dark'] .site-dialog .tab-icon[data-icon='mdiApi']) {
  color: #f472b6 !important;
}

:global(html[data-theme='dark'] .site-dialog .tab-icon path) {
  fill: currentColor !important;
}

/* 开关旁文字 */
:global(html[data-theme='dark'] .site-dialog .bottom-options .el-checkbox__label),
:global(html[data-theme='dark'] .site-dialog .option-item .el-checkbox__label) {
  color: #e2e8f0 !important;
}

/* 表单控件 */
:global(html[data-theme='dark'] .site-dialog .site-form .el-input__inner),
:global(html[data-theme='dark'] .site-dialog .site-form .el-textarea__inner),
:global(html[data-theme='dark'] .site-dialog .site-form .el-select__selected-item),
:global(html[data-theme='dark'] .site-dialog .site-form .el-select__placeholder) {
  color: #e2e8f0 !important;
}

:global(html[data-theme='dark'] .site-dialog .site-form .el-input__wrapper),
:global(html[data-theme='dark'] .site-dialog .site-form .el-textarea__inner),
:global(html[data-theme='dark'] .site-dialog .site-form .el-select__wrapper) {
  background: #0f172a !important;
  box-shadow: 0 0 0 1px #334155 inset !important;
}

/* Cookie/UA「获取」按钮：覆盖浅色 indigo 硬编码 */
:global(html[data-theme='dark'] .site-dialog .field-fill-btn.el-button),
:global(html[data-theme='dark'] .site-dialog .field-fill-btn) {
  color: #c4b5fd !important;
  background: rgba(99, 102, 241, 0.18) !important;
  border-color: rgba(129, 140, 248, 0.35) !important;
}
:global(html[data-theme='dark'] .site-dialog .field-fill-btn.el-button:hover),
:global(html[data-theme='dark'] .site-dialog .field-fill-btn:hover),
:global(html[data-theme='dark'] .site-dialog .field-fill-btn.el-button:focus),
:global(html[data-theme='dark'] .site-dialog .field-fill-btn:focus) {
  color: #ddd6fe !important;
  background: rgba(99, 102, 241, 0.28) !important;
  border-color: rgba(167, 139, 250, 0.5) !important;
}
:global(html[data-theme='dark'] .site-dialog .ua-input .el-input-group__append) {
  background: transparent !important;
  border-color: #334155 !important;
  box-shadow: none !important;
}
:global(html[data-theme='dark'] .site-dialog .ua-fill-btn.el-button),
:global(html[data-theme='dark'] .site-dialog .ua-fill-btn) {
  color: #c4b5fd !important;
  background: rgba(99, 102, 241, 0.18) !important;
  border: none !important;
}
:global(html[data-theme='dark'] .site-dialog .ua-fill-btn.el-button:hover),
:global(html[data-theme='dark'] .site-dialog .ua-fill-btn:hover) {
  color: #ddd6fe !important;
  background: rgba(99, 102, 241, 0.28) !important;
}

/* 备用域名弹窗 */
:global(.alias-dialog.el-dialog) {
  width: 92% !important;
  max-width: 348px;
  overflow: hidden;
  border-radius: 12px;
}

:global(.alias-dialog .el-dialog__header) {
  margin-right: 0;
  padding: 12px 14px 10px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

:global(.alias-dialog .el-dialog__title) {
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
}

:global(.alias-dialog .el-dialog__headerbtn) {
  top: 10px;
  right: 12px;
  width: 28px;
  height: 28px;
}

:global(.alias-dialog .el-dialog__body) {
  padding: 12px 14px 6px;
}

:global(.alias-dialog .el-dialog__footer) {
  padding: 10px 14px 12px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
}

.alias-field-label,
.alias-list-label {
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.25;
}

.alias-add-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30px;
  gap: 8px;
  margin-top: 6px;
  align-items: center;
}

:global(.alias-add-row .el-input--small .el-input__wrapper) {
  min-height: 30px;
  height: 30px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e2e8f0 inset;
}

:global(.alias-add-row .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #6366f1 inset !important;
}

.alias-add-button {
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 8px;
}

.alias-add-button svg,
.alias-empty svg {
  fill: currentColor;
}

.alias-dialog__hint {
  margin: 6px 0 0;
  color: #94a3b8;
  font-size: 11px;
  line-height: 1.4;
}

.alias-primary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding: 9px 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.alias-primary > div {
  min-width: 0;
}

.alias-primary__label {
  display: block;
  margin-bottom: 2px;
  color: #64748b;
  font-size: 11px;
}

.alias-primary strong {
  display: block;
  overflow: hidden;
  color: #334155;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alias-primary > span {
  flex: none;
  color: #94a3b8;
  font-size: 11px;
  white-space: nowrap;
}

.alias-list-label {
  display: flex;
  justify-content: space-between;
  margin-top: 14px;
}

.alias-list-label span {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 500;
}

.alias-list {
  min-height: 96px;
  max-height: 192px;
  margin-top: 6px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.alias-list__item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 8px 0 10px;
}

.alias-list__item + .alias-list__item {
  border-top: 1px solid #f1f5f9;
}

.alias-list__domain {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #334155;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.alias-list__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 2px;
}

.alias-list__actions :deep(.el-button) {
  min-height: 28px;
  padding: 0 4px;
  font-size: 12px;
}

:global(.alias-list__remove.el-button) {
  min-height: 28px;
  padding: 0 4px;
  color: #dc5a67;
  font-size: 12px;
}

.alias-empty {
  display: flex;
  min-height: 94px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: #94a3b8;
  font-size: 12px;
}

.alias-dialog__footer {
  display: flex;
  justify-content: flex-end;
}

.alias-dialog__footer :deep(.el-button) {
  min-width: 72px;
  height: 30px;
  border-radius: 8px;
  font-size: 12px;
  padding: 0 14px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

:global(html[data-theme='dark'] .alias-dialog.el-dialog) {
  background: #1e293b;
  border: 1px solid #334155;
}

:global(html[data-theme='dark'] .alias-dialog .el-dialog__header),
:global(html[data-theme='dark'] .alias-dialog .el-dialog__footer) {
  border-color: rgba(148, 163, 184, 0.14);
}

:global(html[data-theme='dark'] .alias-dialog .el-dialog__title) {
  color: #f1f5f9;
}

:global(html[data-theme='dark'] .alias-dialog .el-dialog__headerbtn .el-dialog__close),
:global(html[data-theme='dark'] .alias-dialog__hint),
:global(html[data-theme='dark'] .alias-list-label span),
:global(html[data-theme='dark'] .alias-primary__label),
:global(html[data-theme='dark'] .alias-primary > span),
:global(html[data-theme='dark'] .alias-empty) {
  color: #94a3b8;
}

:global(html[data-theme='dark'] .alias-field-label),
:global(html[data-theme='dark'] .alias-list-label) {
  color: #cbd5e1;
}

:global(html[data-theme='dark'] .alias-add-row .el-input__wrapper) {
  background: #0f172a;
  box-shadow: 0 0 0 1px #334155 inset !important;
}

:global(html[data-theme='dark'] .alias-add-row .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #818cf8 inset !important;
}

:global(html[data-theme='dark'] .alias-add-row .el-input__inner),
:global(html[data-theme='dark'] .alias-primary strong),
:global(html[data-theme='dark'] .alias-list__domain) {
  color: #e2e8f0;
}

:global(html[data-theme='dark'] .alias-primary) {
  background: #0f172a;
  border-color: #334155;
}

:global(html[data-theme='dark'] .alias-list) {
  border-color: #334155;
}

:global(html[data-theme='dark'] .alias-list__item + .alias-list__item) {
  border-top-color: #334155;
}

@media (min-width: 520px) {
  .form-row {
    grid-template-columns: 1fr 1fr 1fr 1fr;
  }
}
</style>

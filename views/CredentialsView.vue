<template>
  <div class="pt-manager-root">
    <div class="toolbar">
        <div class="toolbar-row">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索站点名/用户名..."
            size="small"
            clearable
            class="search-input"
          >
            <template #prefix>
              <svg viewBox="0 0 24 24" width="14" height="14" class="icon-prefix">
                <path :d="mdiMagnify" />
              </svg>
            </template>
          </el-input>
          <el-button
            class="compact add-button"
            size="small"
            type="primary"
            :title="currentTab === 'blacklist' ? '添加黑名单' : '新增凭据'"
            @click="onAddClick"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" class="icon-btn-only">
              <path :d="mdiPlus" />
            </svg>
          </el-button>
          <el-dropdown trigger="click" @command="handleGroupCommand">
            <el-button class="compact group-button" size="small" title="新建分组">
              <svg viewBox="0 0 24 24" width="16" height="16" class="icon-btn-only">
                <path :d="mdiFolderPlusOutline" />
              </svg>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="create">
                  <div class="dropdown-item-content">
                    <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiFolderPlusOutline" /></svg>
                    新建分组
                  </div>
                </el-dropdown-item>
                <el-dropdown-item v-if="activeGroup" command="rename" divided>
                  <div class="dropdown-item-content">
                    <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiPencil" /></svg>
                    重命名「{{ activeGroup.name }}」
                  </div>
                </el-dropdown-item>
                <el-dropdown-item v-if="activeGroup" command="delete" class="delete-menu-item">
                  <div class="dropdown-item-content text-danger">
                    <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiDelete" /></svg>
                    删除「{{ activeGroup.name }}」
                  </div>
                </el-dropdown-item>
                <el-dropdown-item v-if="!activeGroup" disabled>选择自定义分组后可管理</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-dropdown trigger="click" @command="handleMoreCommand">
            <el-button class="compact more-button" size="small" title="更多操作">
              <svg viewBox="0 0 24 24" width="16" height="16" class="icon-btn-only">
                <path :d="mdiDotsVertical" />
              </svg>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="refresh">
                  <div class="dropdown-item-content">
                    <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiRefresh" /></svg>
                    刷新
                  </div>
                </el-dropdown-item>
                <el-dropdown-item command="json-export" divided>
                  <div class="dropdown-item-content">
                    <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiExportVariant" /></svg>
                    导出本地 JSON
                  </div>
                </el-dropdown-item>
                <el-dropdown-item command="json-import">
                  <div class="dropdown-item-content">
                    <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiImport" /></svg>
                    导入本地 JSON
                  </div>
                </el-dropdown-item>
                <el-dropdown-item command="bitwarden-import">
                  <div class="dropdown-item-content">
                    <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiShieldKeyOutline" /></svg>
                    导入 Bitwarden JSON
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <div class="pt-tabs">
        <div
          ref="tabsScrollRef"
          class="pt-tabs-scroll"
          @pointerdown="onTabsPointerDown"
          @pointermove="onTabsPointerMove"
          @pointerup="onTabsPointerUp"
          @pointercancel="onTabsPointerUp"
          @wheel="onTabsWheel"
        >
          <div
            class="pt-tab-item"
            :class="{ active: currentTab === 'pt' && !activeGroupId }"
            @click="selectCredentialTab('pt')"
          >
            PT站点
          </div>
          <div
            class="pt-tab-item"
            :class="{ active: currentTab === 'intranet' && !activeGroupId }"
            @click="selectCredentialTab('intranet')"
          >
            内网
          </div>
          <div
            class="pt-tab-item"
            :class="{ active: currentTab === 'custom' && !activeGroupId }"
            @click="selectCredentialTab('custom')"
          >
            自定义
          </div>
          <div
            class="pt-tab-item"
            :class="{ active: currentTab === 'blacklist' }"
            @click="selectCredentialTab('blacklist')"
          >
            黑名单
          </div>
          <div
            class="pt-tab-item"
            :class="{ active: currentTab === 'all' && !activeGroupId }"
            @click="selectCredentialTab('all')"
          >
            全部
          </div>
          <div
            v-for="group in credentialGroups"
            :key="group.id"
            class="pt-tab-item credential-group-tab"
            :class="{ active: activeGroupId === group.id }"
            @click="selectCredentialGroup(group.id)"
          >
            {{ group.name }}
          </div>
        </div>
      </div>

      <!-- 凭据列表 -->
      <div
        v-if="currentTab !== 'blacklist'"
        class="pt-grid"
        @scroll.passive="onCredentialScroll"
      >
        <div v-if="loading && creds.length === 0" class="pt-loading-cards">
          <div v-for="n in 3" :key="n" class="pt-loading-card">
            <div class="pt-loading-main">
              <div class="pt-loading-avatar pt-loading-shimmer"></div>
              <div class="pt-loading-info">
                <div class="pt-loading-line name pt-loading-shimmer"></div>
                <div class="pt-loading-line domain pt-loading-shimmer"></div>
                <div class="pt-loading-line username pt-loading-shimmer"></div>
              </div>
              <div class="pt-loading-actions">
                <div class="pt-loading-action pt-loading-shimmer"></div>
                <div class="pt-loading-action pt-loading-shimmer"></div>
                <div class="pt-loading-action pt-loading-shimmer"></div>
              </div>
            </div>
            <div class="pt-loading-password-row">
              <div class="pt-loading-password pt-loading-shimmer"></div>
              <div class="pt-loading-time pt-loading-shimmer"></div>
            </div>
          </div>
        </div>

        <div v-else-if="filteredCreds.length === 0" class="empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" class="empty-icon">
            <path :d="mdiKeyOutline" />
          </svg>
          <p class="empty-text">
            {{
              searchKeyword
                ? '无匹配凭据'
                : currentTab === 'pt'
                  ? '暂无 PT 站点凭据'
                  : currentTab === 'intranet'
                    ? '暂无内网凭据'
                    : '暂无自定义凭据'
            }}
          </p>
          <el-button type="primary" size="small" @click="openCredDialog()">添加站点</el-button>
        </div>

        <div v-else class="pt-cards">
          <div v-for="item in visibleCreds" :key="item.id || item.domain + item.username" class="pt-card">
            <div class="card-main">
              <div
                class="site-avatar"
                :class="{
                  'has-icon':
                    !isPrivateCredential(item) && !!credIconMap[displayDomain(item.domain)],
                  'is-private': isPrivateCredential(item),
                }"
                :style="
                  credIconMap[displayDomain(item.domain)] || isPrivateCredential(item)
                    ? undefined
                    : { background: avatarBg(item.domain) }
                "
              >
                <svg
                  v-if="isPrivateCredential(item)"
                  viewBox="0 0 24 24"
                  width="21"
                  height="21"
                  class="private-site-icon"
                  aria-label="内网站点"
                >
                  <path :d="mdiServerNetwork" />
                </svg>
                <img
                  v-else-if="credIconMap[displayDomain(item.domain)]"
                  :src="credIconMap[displayDomain(item.domain)]"
                  class="site-icon-img"
                  alt=""
                  :data-domain="displayDomain(item.domain)"
                  @error="onCredIconError"
                />
                <span v-else>{{ avatarChar(item) }}</span>
              </div>
              <div class="site-details">
                <div class="site-name" :title="displayName(item)">{{ displayName(item) }}</div>
                <div
                  class="site-domain link-style"
                  :title="item.domain"
                  @click="openSite(item.domain)"
                >
                  <svg viewBox="0 0 24 24" width="11" height="11" class="domain-icon">
                    <path :d="mdiOpenInNew" />
                  </svg>
                  <span class="domain-text">{{ displayDomain(item.domain) }}</span>
                </div>
                <div
                  class="site-username"
                  title="点击复制用户名"
                  @click="copyText(item.username, '用户名')"
                >
                  {{ item.username }}
                </div>
              </div>
              <div class="card-actions">
                <el-button
                  size="small"
                  text
                  class="action-btn"
                  :title="visiblePasswords[itemKey(item)] ? '隐藏密码' : '显示密码'"
                  @click="togglePasswordVisibility(item)"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15">
                    <path :d="visiblePasswords[itemKey(item)] ? mdiEyeOff : mdiEye" />
                  </svg>
                </el-button>
                <el-button
                  size="small"
                  text
                  class="action-btn"
                  title="复制密码"
                  @click="copyPassword(item)"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15">
                    <path :d="mdiContentCopy" />
                  </svg>
                </el-button>
                <el-dropdown
                  trigger="click"
                  popper-class="pt-cred-dropdown"
                  @command="(c: string) => handleCardCommand(c, item)"
                >
                  <el-button size="small" text class="action-btn">
                    <svg viewBox="0 0 24 24" width="15" height="15">
                      <path :d="mdiDotsVertical" />
                    </svg>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="edit">
                        <div class="dropdown-item-content">
                          <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiPencil" /></svg>
                          编辑凭据
                        </div>
                      </el-dropdown-item>
                      <el-dropdown-item command="toggle-category">
                        <div class="dropdown-item-content">
                          <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiSwapHorizontal" /></svg>
                          {{ getCategory(item) === 'pt' ? '移动到自定义' : '移动到PT站点' }}
                        </div>
                      </el-dropdown-item>
                      <el-dropdown-item command="add-to-blacklist">
                        <div class="dropdown-item-content">
                          <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiShieldOffOutline" /></svg>
                          加入黑名单
                        </div>
                      </el-dropdown-item>
                      <el-dropdown-item command="delete" class="delete-menu-item">
                        <div class="dropdown-item-content text-danger">
                          <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1"><path :d="mdiDelete" /></svg>
                          删除凭据
                        </div>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
            <div class="card-password-row">
              <div class="pw-wrap">
                <span class="password-label">密码:</span>
                <span class="password-value font-mono">
                  <span v-if="visiblePasswords[itemKey(item)]" class="visible-pw">{{ item.password }}</span>
                  <span v-else class="dots">••••••••</span>
                </span>
              </div>
              <div class="time-wrap">{{ formatDate(item.updatedAt) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 黑名单列表 -->
      <div v-else class="pt-grid">
        <div v-if="blacklistLoading && blacklist.length === 0" class="pt-loading-cards">
          <div v-for="n in 3" :key="n" class="pt-loading-card">
            <div class="pt-loading-main">
              <div class="pt-loading-avatar pt-loading-shimmer"></div>
              <div class="pt-loading-info">
                <div class="pt-loading-line name pt-loading-shimmer"></div>
                <div class="pt-loading-line domain pt-loading-shimmer"></div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="filteredBlacklist.length === 0" class="empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" class="empty-icon">
            <path :d="mdiShieldOffOutline" />
          </svg>
          <p class="empty-text">{{ searchKeyword ? '无匹配站点' : '暂无黑名单站点' }}</p>
          <el-button type="primary" size="small" @click="openBlacklistDialog()">添加站点</el-button>
        </div>

        <div v-else class="pt-cards">
          <div v-for="item in filteredBlacklist" :key="item.id" class="bl-card">
            <div class="card-main">
              <div class="site-avatar" :style="{ background: avatarBg(item.domain) }">
                <span>{{ (item.name || item.domain || '?').charAt(0).toUpperCase() }}</span>
              </div>
              <div class="site-details">
                <div class="site-name" :title="item.name || displayDomain(item.domain)">
                  {{ item.name || displayDomain(item.domain) }}
                </div>
                <div
                  class="site-domain link-style"
                  :title="item.domain"
                  @click="openSite(item.domain)"
                >
                  <svg viewBox="0 0 24 24" width="11" height="11" class="domain-icon">
                    <path :d="mdiOpenInNew" />
                  </svg>
                  <span class="domain-text">{{ displayDomain(item.domain) }}</span>
                </div>
              </div>
              <div class="card-actions">
                <el-dropdown
                  trigger="click"
                  popper-class="pt-cred-dropdown"
                  @command="(c: string) => handleBlacklistCommand(c, item)"
                >
                  <el-button size="small" text class="action-btn">
                    <svg viewBox="0 0 24 24" width="15" height="15">
                      <path :d="mdiDotsVertical" />
                    </svg>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="edit">
                        <div class="dropdown-item-content">
                          <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1">
                            <path :d="mdiPencil" />
                          </svg>
                          编辑规则
                        </div>
                      </el-dropdown-item>
                      <el-dropdown-item command="delete" class="delete-menu-item">
                        <div class="dropdown-item-content text-danger">
                          <svg viewBox="0 0 24 24" width="14" height="14" class="mr-1">
                            <path :d="mdiDelete" />
                          </svg>
                          移除黑名单
                        </div>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
            <div class="bl-info-row">
              <div class="bl-tags">
                <el-tag
                  v-if="item.blockLoginFill !== false"
                  size="small"
                  type="warning"
                  effect="plain"
                  class="bl-tag"
                  title="禁止登录填充"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" class="bl-tag-icon">
                    <path :d="mdiLoginVariant" />
                  </svg>
                  登录
                </el-tag>
                <el-tag
                  v-if="item.blockCaptchaFill"
                  size="small"
                  type="danger"
                  effect="plain"
                  class="bl-tag"
                  title="禁止验证码填充"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" class="bl-tag-icon">
                    <path :d="mdiRobotOutline" />
                  </svg>
                  验证码
                </el-tag>
                <el-tag
                  v-if="item.blockCredentialSavePrompt !== false"
                  size="small"
                  type="info"
                  effect="plain"
                  class="bl-tag"
                  title="禁止保存凭据提示"
                >
                  <svg viewBox="0 0 24 24" width="12" height="12" class="bl-tag-icon">
                    <path :d="mdiKeyOutline" />
                  </svg>
                  保存提示
                </el-tag>
              </div>
              <div class="time-wrap">{{ formatDate(item.updatedAt) || '-' }}</div>
            </div>
          </div>
        </div>
      </div>

    <!-- 凭据对话框 -->
    <el-dialog
      v-model="credDialogVisible"
      :title="editingCredId ? '编辑凭据' : '新增凭据'"
      width="92%"
      class="mp-sub-dialog"
      append-to-body
      :align-center="false"
      :close-on-click-modal="false"
      @closed="resetCredForm"
    >
      <div class="mp-sub-form">
        <el-form :model="credForm" label-position="top">
          <el-form-item label="名称">
            <el-input
              v-model="credForm.name"
              size="small"
              placeholder="可选，不填则使用域名"
              class="mp-sub-control"
            />
          </el-form-item>
          <el-form-item label="域名" required>
            <el-input
              v-model="credForm.domain"
              size="small"
              placeholder="必填，需含 http:// 或 https:// 前缀"
              class="mp-sub-control"
              @blur="onDomainBlur"
            />
            <div class="fetch-site-row">
              <el-button
                type="primary"
                plain
                size="small"
                :loading="fetchingCurrentSite"
                @click="fetchCurrentSite"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" class="fetch-site-icon">
                  <path :d="mdiWeb" />
                </svg>
                获取当前站点
              </el-button>
              <span class="fetch-site-hint">
                PT 站自动匹配官方名称；内网站点归入内网；其它站归入自定义并用标签页标题命名
              </span>
            </div>
          </el-form-item>
          <el-form-item label="用户名">
            <el-input
              v-model="credForm.username"
              size="small"
              placeholder="可选，允许仅保存密码"
              class="mp-sub-control"
            />
          </el-form-item>
          <el-form-item label="密码" required>
            <el-input
              v-model="credForm.password"
              type="password"
              show-password
              size="small"
              placeholder="站点密码"
              class="mp-sub-control"
            />
          </el-form-item>
          <el-form-item label="内置分组">
            <el-radio-group v-model="credForm.category" class="mp-sub-radio">
              <el-radio value="pt">PT站点</el-radio>
              <el-radio value="custom">自定义</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="自定义分组">
            <el-select
              v-model="credForm.groupId"
              clearable
              size="small"
              placeholder="未分组"
              class="mp-sub-control"
            >
              <el-option
                v-for="group in credentialGroups"
                :key="group.id"
                :label="group.name"
                :value="group.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="选项">
            <div class="mp-sub-checks">
              <el-checkbox v-model="credForm.autoSaveEnabled">账密变化时提示更新</el-checkbox>
              <el-checkbox v-model="credForm.autoFillEnabled">打开站点自动填充</el-checkbox>
            </div>
            <div class="option-hint">
              已保存且账号密码一致时不会再提示；仅当登录账密与已存不一致时才会提示更新。
            </div>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <div class="mp-sub-footer">
          <el-button @click="credDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveCred">保存</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="bitwardenDialogVisible"
      width="92%"
      class="bitwarden-import-dialog"
      append-to-body
      align-center
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      @closed="finishBitwardenImport(false)"
    >
      <template #header>
        <div class="bw-dialog-header">
          <div class="bw-dialog-icon">
            <svg viewBox="0 0 24 24" width="18" height="18"><path :d="mdiShieldKeyOutline" /></svg>
          </div>
          <div>
            <div class="bw-dialog-title">确认导入 Bitwarden 数据</div>
            <div class="bw-dialog-subtitle">检查合并结果后再写入加密凭据库与两步验证库</div>
          </div>
        </div>
      </template>

      <div v-if="bitwardenPreview" class="bw-import-body">
        <div class="bw-summary-list">
          <div class="bw-summary-row">
            <strong class="bw-summary-kind">凭据</strong>
            <span class="bw-summary-metric">
              <small>处理</small><b>{{ bitwardenPreview.stats.eligible }}</b>
            </span>
            <span class="bw-summary-metric bw-summary-metric--add">
              <small>新增</small><b>{{ bitwardenPreview.stats.added }}</b>
            </span>
            <span class="bw-summary-metric bw-summary-metric--update">
              <small>更新</small><b>{{ bitwardenPreview.stats.updated }}</b>
            </span>
            <span class="bw-summary-metric bw-summary-metric--keep">
              <small>保留</small><b>{{ bitwardenPreview.stats.keptExisting }}</b>
            </span>
          </div>
          <div class="bw-summary-row">
            <strong class="bw-summary-kind">TOTP</strong>
            <span class="bw-summary-metric">
              <small>处理</small><b>{{ bitwardenPreview.totpStats.eligible }}</b>
            </span>
            <span class="bw-summary-metric bw-summary-metric--add">
              <small>新增</small><b>{{ bitwardenPreview.totpStats.added }}</b>
            </span>
            <span class="bw-summary-metric bw-summary-metric--update">
              <small>更新</small><b>{{ bitwardenPreview.totpStats.updated }}</b>
            </span>
            <span class="bw-summary-metric bw-summary-metric--keep">
              <small>保留</small><b>{{ bitwardenPreview.totpStats.keptExisting }}</b>
            </span>
          </div>
        </div>

        <div class="bw-import-note">
          相同站点的数据仅在 Bitwarden 修改日期严格更新时替换；TOTP 密钥不会显示在预览明细中。
        </div>

        <el-collapse class="bw-detail-collapse">
          <el-collapse-item v-if="bitwardenPreview.details.duplicates.length" name="duplicates">
            <template #title>
              <div class="bw-collapse-title">
                <span>重复与保留</span>
                <span class="bw-count bw-count--warning">{{ bitwardenPreview.details.duplicates.length }}</span>
              </div>
            </template>
            <div class="bw-detail-list">
              <div
                v-for="(detail, index) in bitwardenPreview.details.duplicates"
                :key="`duplicate-${index}-${detail.domain}`"
                class="bw-detail-row"
              >
                <div class="bw-detail-main">
                  <span class="bw-detail-name">{{ detail.name }}</span>
                  <span class="bw-detail-meta">{{ detail.domain || '无有效域名' }}</span>
                  <span v-if="detail.maskedUsername" class="bw-detail-user">{{ detail.maskedUsername }}</span>
                </div>
                <span class="bw-detail-reason">{{ detail.reason }}</span>
              </div>
            </div>
          </el-collapse-item>

          <el-collapse-item v-if="bitwardenPreview.details.skipped.length" name="skipped">
            <template #title>
              <div class="bw-collapse-title">
                <span>跳过的凭据</span>
                <span class="bw-count bw-count--muted">{{ bitwardenPreview.details.skipped.length }}</span>
              </div>
            </template>
            <div class="bw-detail-list">
              <div
                v-for="(detail, index) in bitwardenPreview.details.skipped"
                :key="`skipped-${index}-${detail.name}`"
                class="bw-detail-row"
              >
                <div class="bw-detail-main">
                  <span class="bw-detail-name">{{ detail.name }}</span>
                  <span v-if="detail.domain" class="bw-detail-meta">{{ detail.domain }}</span>
                  <span v-if="detail.maskedUsername" class="bw-detail-user">{{ detail.maskedUsername }}</span>
                </div>
                <span class="bw-detail-reason">{{ detail.reason }}</span>
              </div>
            </div>
          </el-collapse-item>
          <el-collapse-item
            v-if="bitwardenPreview.details.totpDuplicates.length"
            name="totp-duplicates"
          >
            <template #title>
              <div class="bw-collapse-title">
                <span>TOTP 重复与保留</span>
                <span class="bw-count bw-count--warning">{{ bitwardenPreview.details.totpDuplicates.length }}</span>
              </div>
            </template>
            <div class="bw-detail-list">
              <div
                v-for="(detail, index) in bitwardenPreview.details.totpDuplicates"
                :key="`totp-duplicate-${index}-${detail.domain}`"
                class="bw-detail-row"
              >
                <div class="bw-detail-main">
                  <span class="bw-detail-name">{{ detail.name }}</span>
                  <span class="bw-detail-meta">{{ detail.domain || '无有效域名' }}</span>
                </div>
                <span class="bw-detail-reason">{{ detail.reason }}</span>
              </div>
            </div>
          </el-collapse-item>

          <el-collapse-item v-if="bitwardenPreview.details.totpSkipped.length" name="totp-skipped">
            <template #title>
              <div class="bw-collapse-title">
                <span>跳过的 TOTP</span>
                <span class="bw-count bw-count--muted">{{ bitwardenPreview.details.totpSkipped.length }}</span>
              </div>
            </template>
            <div class="bw-detail-list">
              <div
                v-for="(detail, index) in bitwardenPreview.details.totpSkipped"
                :key="`totp-skipped-${index}-${detail.name}`"
                class="bw-detail-row"
              >
                <div class="bw-detail-main">
                  <span class="bw-detail-name">{{ detail.name }}</span>
                  <span v-if="detail.domain" class="bw-detail-meta">{{ detail.domain }}</span>
                </div>
                <span class="bw-detail-reason">{{ detail.reason }}</span>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>

      <template #footer>
        <div class="bw-dialog-footer">
          <el-button @click="finishBitwardenImport(false)">取消</el-button>
          <el-button type="primary" @click="finishBitwardenImport(true)">确认导入</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 黑名单对话框 -->
    <el-dialog
      v-model="blDialogVisible"
      :title="editingBlId ? '编辑黑名单' : '添加黑名单'"
      width="92%"
      class="mp-sub-dialog"
      append-to-body
      :align-center="false"
      :close-on-click-modal="false"
      @closed="resetBlForm"
    >
      <div class="mp-sub-form">
        <el-form :model="blForm" label-position="top">
          <el-form-item label="名称">
            <el-input
              v-model="blForm.name"
              size="small"
              placeholder="可选，不填则使用域名"
              class="mp-sub-control"
            />
          </el-form-item>
          <el-form-item label="域名" required>
            <el-input
              v-model="blForm.domain"
              size="small"
              placeholder="必填，需含 http:// 或 https:// 前缀"
              class="mp-sub-control"
            />
          </el-form-item>
          <el-form-item label="规则">
            <div class="mp-sub-checks mp-sub-checks-col">
              <el-checkbox v-model="blForm.blockLoginFill">拦截登录填充</el-checkbox>
              <el-checkbox v-model="blForm.blockCaptchaFill">拦截验证码填充</el-checkbox>
              <el-checkbox v-model="blForm.blockCredentialSavePrompt">拦截保存提示</el-checkbox>
            </div>
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <div class="mp-sub-footer">
          <el-button @click="blDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="saveBlacklistEntry">保存</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// 凭据管理使用绿色主色、三类标签页和卡片列表。
import { ref, computed, reactive, onMounted, watch } from 'vue'
import {
  mdiMagnify,
  mdiPlus,
  mdiDotsVertical,
  mdiRefresh,
  mdiExportVariant,
  mdiImport,
  mdiKeyOutline,
  mdiEye,
  mdiEyeOff,
  mdiContentCopy,
  mdiPencil,
  mdiDelete,
  mdiSwapHorizontal,
  mdiShieldOffOutline,
  mdiShieldKeyOutline,
  mdiLoginVariant,
  mdiRobotOutline,
  mdiOpenInNew,
  mdiWeb,
  mdiServerNetwork,
  mdiFolderPlusOutline,
} from '@mdi/js'
import {
  loadCredentialGroups,
  loadPtCredentials,
  saveCredentialGroups,
  savePtCredentials,
  loadBlacklist,
  saveBlacklist as persistBlacklist,
} from '../services/credential'
import { loadSites as loadTotpSites, saveSites as saveTotpSites } from '../services/totp'
import type {
  CredentialCategory,
  CredentialGroup,
  PtCredential,
  SiteBlacklistEntry,
} from '../core/types'
import { ElMessage, confirmAction, confirmDelete, promptPassword, promptText } from '../utils/ui'
import { downloadText } from '../utils/file'
import {
  consumePickedPageFiles,
  requestFilesFromActivePage,
  type PickedPageFile,
} from '../core/page-file-picker'
import { resolveSiteIconsBatch } from '../services/site-icon'
import {
  createCredentialSiteBatchResolver,
  resolveCredentialSiteFill,
} from '../services/credential-site'
import {
  importBitwardenCredentials,
  type BitwardenImportResult,
} from '../services/bitwarden-import'
import { faviconFallbackChain } from '../services/favicon-discover'
import { formatDateTime, stablePaletteValue } from '../utils/format'
import { isPrivateHost } from '../utils/url'
import { encryptLocalJsonWithSavedKey } from '../services/local-json-envelope'
import {
  importCompatibleLocalJson,
  inspectLocalJsonImport,
} from '../services/local-json-import-compat'


type TabKey = CredentialCategory | 'blacklist' | 'all'

const loading = ref(true)
const blacklistLoading = ref(true)
const searchKeyword = ref('')
const currentTab = ref<TabKey>('pt')
const activeGroupId = ref('')
const tabsScrollRef = ref<HTMLElement | null>(null)
const tabsDragging = ref(false)
const suppressTabClick = ref(false)
let tabsPointerId: number | null = null
let tabsPointerStartX = 0
let tabsScrollStartLeft = 0
let tabsDidDrag = false
const creds = ref<PtCredential[]>([])
const credentialGroups = ref<CredentialGroup[]>([])
const blacklist = ref<SiteBlacklistEntry[]>([])
const credIconMap = ref<Record<string, string>>({})
const visiblePasswords = reactive<Record<string, boolean>>({})
const fetchingCurrentSite = ref(false)
const saving = ref(false)

const credDialogVisible = ref(false)
const bitwardenDialogVisible = ref(false)
const bitwardenPreview = ref<BitwardenImportResult | null>(null)
let resolveBitwardenConfirm: ((confirmed: boolean) => void) | null = null
const editingCredId = ref<string | null>(null)
const credForm = ref({
  name: '',
  domain: '',
  username: '',
  password: '',
  category: 'pt' as CredentialCategory,
  groupId: '',
  autoSaveEnabled: true,
  autoFillEnabled: true,
})

const blDialogVisible = ref(false)
const editingBlId = ref<string | null>(null)
const blForm = ref({
  domain: '',
  name: '',
  blockLoginFill: true,
  blockCaptchaFill: false,
  blockCredentialSavePrompt: true,
})

function itemKey(item: PtCredential): string {
  return item.id || `${item.domain}::${item.username}`
}

function getCategory(item: PtCredential): CredentialCategory {
  if (item.category === 'pt' || item.category === 'intranet' || item.category === 'custom') {
    return item.category
  }
  if (isPrivateHost(item.domain)) return 'intranet'
  return item.domain ? 'pt' : 'custom'
}

/** 列表展示主机与非默认端口，不带 http(s):// 前缀。 */
function displayDomain(raw?: string): string {
  const input = (raw || '').trim()
  if (!input) return ''
  try {
    const withProto = /^https?:\/\//i.test(input) ? input : `https://${input}`
    return new URL(withProto).host.replace(/^\./, '') || input
  } catch {
    return input.replace(/^https?:\/\//i, '').split('/')[0]
  }
}

function displayName(item: PtCredential): string {
  const name = (item.name || '').trim()
  if (name && !/^https?:\/\//i.test(name)) return name
  return displayDomain(item.domain) || name || item.domain
}

function avatarChar(item: PtCredential): string {
  return (displayName(item) || '?').charAt(0).toUpperCase()
}

function isPrivateCredential(item: PtCredential): boolean {
  return isPrivateHost(item.domain)
}

const CREDENTIAL_AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
  'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
  'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
  'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
] as const

function avatarBg(domain: string): string {
  return stablePaletteValue(domain, CREDENTIAL_AVATAR_GRADIENTS)
}

function formatDate(iso?: string): string {
  return formatDateTime(iso)
}

const activeGroup = computed(() =>
  credentialGroups.value.find((group) => group.id === activeGroupId.value),
)

function onTabsPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || !tabsScrollRef.value) return
  tabsPointerId = event.pointerId
  tabsPointerStartX = event.clientX
  tabsScrollStartLeft = tabsScrollRef.value.scrollLeft
  tabsDidDrag = false
  tabsDragging.value = true
}

function onTabsPointerMove(event: PointerEvent): void {
  if (!tabsDragging.value || tabsPointerId !== event.pointerId || !tabsScrollRef.value) return
  const distance = event.clientX - tabsPointerStartX
  if (!tabsDidDrag && Math.abs(distance) < 4) return
  tabsDidDrag = true
  tabsScrollRef.value.scrollLeft = tabsScrollStartLeft - distance
  event.preventDefault()
}

function onTabsPointerUp(event: PointerEvent): void {
  if (tabsPointerId !== event.pointerId) return
  if (tabsScrollRef.value?.hasPointerCapture(event.pointerId)) {
    tabsScrollRef.value.releasePointerCapture(event.pointerId)
  }
  tabsPointerId = null
  tabsDragging.value = false
  if (tabsDidDrag) {
    suppressTabClick.value = true
    window.setTimeout(() => {
      suppressTabClick.value = false
    }, 0)
  }
  tabsDidDrag = false
}

function onTabsWheel(event: WheelEvent): void {
  if (!tabsScrollRef.value || tabsScrollRef.value.scrollWidth <= tabsScrollRef.value.clientWidth) return
  const distance = event.deltaX || event.deltaY
  if (!distance) return
  event.preventDefault()
  tabsScrollRef.value.scrollLeft += distance
}

function selectCredentialTab(tab: TabKey): void {
  if (suppressTabClick.value) {
    suppressTabClick.value = false
    return
  }
  currentTab.value = tab
  activeGroupId.value = ''
}

function selectCredentialGroup(groupId: string): void {
  if (suppressTabClick.value) {
    suppressTabClick.value = false
    return
  }
  currentTab.value = 'all'
  activeGroupId.value = groupId
}

const filteredCreds = computed(() => {
  let list = currentTab.value === 'all'
    ? creds.value
    : creds.value.filter((credential) => getCategory(credential) === currentTab.value)
  if (activeGroupId.value) list = list.filter((credential) => credential.groupId === activeGroupId.value)
  const kw = searchKeyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(kw) ||
        c.domain.toLowerCase().includes(kw) ||
        c.username.toLowerCase().includes(kw),
    )
  }
  return list
})

const CREDENTIAL_RENDER_BATCH = 40
const visibleCredentialCount = ref(CREDENTIAL_RENDER_BATCH)
const visibleCreds = computed(() => filteredCreds.value.slice(0, visibleCredentialCount.value))

watch([currentTab, activeGroupId, searchKeyword], () => {
  visibleCredentialCount.value = CREDENTIAL_RENDER_BATCH
})

watch(credentialGroups, (groups) => {
  if (activeGroupId.value && !groups.some((group) => group.id === activeGroupId.value)) {
    activeGroupId.value = ''
  }
})

function onCredentialScroll(event: Event): void {
  if (visibleCredentialCount.value >= filteredCreds.value.length) return
  const target = event.currentTarget as HTMLElement
  if (target.scrollTop + target.clientHeight < target.scrollHeight - 240) return
  visibleCredentialCount.value += CREDENTIAL_RENDER_BATCH
}

const filteredBlacklist = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return blacklist.value
  return blacklist.value.filter(
    (b) =>
      b.domain.toLowerCase().includes(kw) || (b.name || '').toLowerCase().includes(kw),
  )
})

async function loadCredIcons(): Promise<void> {
  const inputs = creds.value
    .filter((c) => !isPrivateCredential(c))
    .map((c) => ({
      domain: displayDomain(c.domain),
      name: c.name,
      url: c.domain,
    }))
    .filter((x) => x.domain && x.domain.includes('.'))
  if (!inputs.length) {
    credIconMap.value = {}
    return
  }
  // 本地优先渐进填充：图标包/缓存/默认 ico 先上屏，网络发现后台覆盖
  await resolveSiteIconsBatch(inputs, {
    allowApi: false,
    allowFavicon: true,
    deferNetworkDiscover: true,
    discoverConcurrency: 3,
    onUpdate: (map) => {
      credIconMap.value = map
    },
  })
}

/** favicon 加载失败：先试其它静态路径，再公共服，最后字母 logo */
function onCredIconError(e: Event): void {
  const img = e.target as HTMLImageElement
  const domain = img.dataset.domain || ''
  const src = img.currentSrc || img.src || ''
  if (!domain && !src) {
    img.style.display = 'none'
    return
  }
  if (domain) {
    const tried = Number(img.dataset.favTry || '0')
    const chain = faviconFallbackChain(domain, src)
    const nextUrl = chain[tried]
    if (nextUrl && nextUrl !== src) {
      img.dataset.favTry = String(tried + 1)
      const next = { ...credIconMap.value }
      next[domain] = nextUrl
      for (const [k, v] of Object.entries(next)) {
        if (v === src) next[k] = nextUrl
      }
      credIconMap.value = next
      return
    }
  }
  const next = { ...credIconMap.value }
  if (domain && next[domain]) delete next[domain]
  for (const [k, v] of Object.entries(next)) {
    if (v === src) delete next[k]
  }
  credIconMap.value = next
}

async function loadAll() {
  loading.value = true
  blacklistLoading.value = true
  try {
    const [c, groups, b] = await Promise.all([
      loadPtCredentials(),
      loadCredentialGroups(),
      loadBlacklist(),
    ])
    creds.value = c.map((x) => ({
      ...x,
      id: x.id || crypto.randomUUID(),
      category: x.category || 'pt',
    }))
    credentialGroups.value = groups
    blacklist.value = b
    // 列表先渲染；图标本地优先后台渐进填充，避免凭据多时整页空等
    loading.value = false
    blacklistLoading.value = false
    void loadCredIcons()
  } catch (e) {
    console.error(e)
    ElMessage.error('加载凭据失败')
    loading.value = false
    blacklistLoading.value = false
  }
}

function onAddClick() {
  if (currentTab.value === 'blacklist') openBlacklistDialog()
  else openCredDialog()
}

function openCredDialog(item?: PtCredential) {
  if (item) {
    editingCredId.value = item.id || itemKey(item)
    credForm.value = {
      name: item.name || '',
      domain: ensureHttpPrefix(item.domain),
      username: item.username,
      password: item.password,
      category: getCategory(item),
      groupId: item.groupId || '',
      autoSaveEnabled: item.autoSaveEnabled !== false,
      autoFillEnabled: item.autoFillEnabled !== false,
    }
  } else {
    editingCredId.value = null
    credForm.value = {
      name: '',
      domain: '',
      username: '',
      password: '',
      category: currentTab.value === 'custom' ? 'custom' : 'pt',
      groupId: activeGroupId.value,
      autoSaveEnabled: true,
      autoFillEnabled: true,
    }
  }
  credDialogVisible.value = true
}

/**
 * 获取当前活动标签页：
 * - PT 站（supporting / 已配置站）：名称用官方站名，分组 PT 站点
 * - 非 PT：分组自定义，名称用选项卡标签标题
 * 账号密码仍手动填写
 */
async function fetchCurrentSite(): Promise<void> {
  if (fetchingCurrentSite.value) return
  fetchingCurrentSite.value = true
  try {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    // 侧栏场景下若当前窗口拿不到有效页，回退到最近焦点窗口
    if (!tab?.url || !/^https?:\/\//i.test(tab.url)) {
      ;[tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    }
    if (!tab?.url) {
      ElMessage.warning('未找到活动标签页')
      return
    }
    if (!/^https?:\/\//i.test(tab.url)) {
      ElMessage.warning('当前页面不是 http/https 站点，无法获取')
      return
    }

    let domain = ''
    try {
      const u = new URL(tab.url)
      domain = `${u.protocol}//${u.host}`
    } catch {
      domain = ensureHttpPrefix(tab.url)
    }
    credForm.value.domain = domain

    const fill = await resolveCredentialSiteFill(domain, tab.title)
    credForm.value.name = fill.name
    credForm.value.category = fill.category

    ElMessage.success(
      fill.isPt
        ? `已识别 PT 站点「${fill.name}」，已归入 PT 站点分组`
        : fill.category === 'intranet'
          ? `已识别内网站点「${fill.name}」，已归入内网分组`
          : `非 PT 站点，已归入自定义并用标签页标题命名`,
    )
  } catch (e) {
    console.error('获取当前站点失败:', e)
    ElMessage.error(`获取当前站点失败：${String(e)}`)
  } finally {
    fetchingCurrentSite.value = false
  }
}

/** 域名失焦时按域名自动推断名称与分组（不覆盖已手动填写且明显非域名的名称） */
async function onDomainBlur(): Promise<void> {
  const raw = (credForm.value.domain || '').trim()
  if (!raw) return
  try {
    const fill = await resolveCredentialSiteFill(raw, credForm.value.name)
    credForm.value.category = fill.category
    const currentName = (credForm.value.name || '').trim()
    const host = displayDomain(raw)
    // 名称为空 / 仅主机名 / 仍是完整 URL 时，用推断名覆盖
    if (!currentName || currentName === host || /^https?:\/\//i.test(currentName)) {
      credForm.value.name = fill.name
    } else if (fill.isPt) {
      // 已是 PT 且名称像标签页长标题时，优先换成官方名
      const looksLikeTabTitle = currentName.length > 24 || /[\s|·\-—]/.test(currentName)
      if (looksLikeTabTitle && fill.name && fill.name !== currentName) {
        credForm.value.name = fill.name
      }
    }
  } catch {
    /* 域名推断失败时保留用户已填写的名称与分组。 */
  }
}

function resetCredForm() {
  editingCredId.value = null
  credForm.value.groupId = ''
}

async function handleGroupCommand(command: string): Promise<void> {
  if (command === 'create') {
    const name = await promptText('新建自定义分组', '为凭据创建一个可筛选的自定义分组。', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPlaceholder: '例如：局域网',
      inputValidator: (value) => {
        if (!value || !String(value).trim()) return '分组名称不能为空'
        return true
      },
    })
    if (!name) return
    if (credentialGroups.value.some((group) => group.name === name)) {
      ElMessage.warning('已存在同名分组')
      return
    }
    const now = new Date().toISOString()
    const group = { id: crypto.randomUUID(), name, createdAt: now, updatedAt: now }
    const groups = [...credentialGroups.value, group]
    await saveCredentialGroups(groups)
    credentialGroups.value = groups
    currentTab.value = 'all'
    activeGroupId.value = group.id
    ElMessage.success('已创建分组')
    return
  }

  const group = activeGroup.value
  if (!group) return
  if (command === 'rename') {
    const name = await promptText('重命名自定义分组', '修改后，分组标签会立即更新。', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: group.name,
      inputPlaceholder: '输入新的分组名称',
      inputValidator: (value) => {
        if (!value || !String(value).trim()) return '分组名称不能为空'
        return true
      },
    })
    if (!name || name === group.name) return
    if (credentialGroups.value.some((item) => item.id !== group.id && item.name === name)) {
      ElMessage.warning('已存在同名分组')
      return
    }
    const groups = credentialGroups.value.map((item) =>
      item.id === group.id ? { ...item, name, updatedAt: new Date().toISOString() } : item,
    )
    await saveCredentialGroups(groups)
    credentialGroups.value = groups
    ElMessage.success('已重命名分组')
    return
  }

  if (command === 'delete') {
    try {
      await confirmDelete(`删除分组「${group.name}」？其内凭据将保留为未分组。`)
    } catch {
      return
    }
    const groups = credentialGroups.value.filter((item) => item.id !== group.id)
    const now = new Date().toISOString()
    const list = creds.value.map((item) =>
      item.groupId === group.id ? { ...item, groupId: undefined, updatedAt: now } : item,
    )
    await Promise.all([saveCredentialGroups(groups), savePtCredentials(list)])
    credentialGroups.value = groups
    creds.value = list
    activeGroupId.value = ''
    ElMessage.success('已删除分组，凭据已保留')
  }
}

async function saveCred() {
  const f = credForm.value
  const parsed = parseDomainInput(f.domain)
  if (!parsed.ok || !parsed.domain) {
    ElMessage.warning('请填写合法域名，且必须以 http:// 或 https:// 开头')
    return
  }
  if (!f.password) {
    ElMessage.warning('密码不能为空')
    return
  }
  saving.value = true
  try {
    const now = new Date().toISOString()
    const list = [...creds.value]
    const host = parsed.host || hostnameOf(parsed.domain)
    const displayName = f.name.trim() || host || parsed.domain
    if (editingCredId.value) {
      const i = list.findIndex((c) => itemKey(c) === editingCredId.value || c.id === editingCredId.value)
      if (i >= 0) {
        list[i] = {
          ...list[i],
          name: displayName,
          domain: parsed.domain,
          username: f.username.trim(),
          password: f.password,
          category: f.category,
          groupId: f.groupId || undefined,
          autoSaveEnabled: f.autoSaveEnabled,
          autoFillEnabled: f.autoFillEnabled,
          updatedAt: now,
        }
      }
    } else {
      list.push({
        id: crypto.randomUUID(),
        name: displayName,
        domain: parsed.domain,
        username: f.username.trim(),
        password: f.password,
        category: f.category,
        groupId: f.groupId || undefined,
        autoSaveEnabled: f.autoSaveEnabled,
        autoFillEnabled: f.autoFillEnabled,
        createdAt: now,
        updatedAt: now,
      })
    }
    await savePtCredentials(list)
    creds.value = list
    ElMessage.success('已保存')
    credDialogVisible.value = false
  } catch (e) {
    ElMessage.error(String(e))
  } finally {
    saving.value = false
  }
}

function togglePasswordVisibility(item: PtCredential) {
  const k = itemKey(item)
  visiblePasswords[k] = !visiblePasswords[k]
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(`已复制${label}`)
  } catch {
    ElMessage.info(text)
  }
}

async function copyPassword(item: PtCredential) {
  await copyText(item.password, '密码')
}

function hasHttpPrefix(raw: string): boolean {
  return /^https?:\/\//i.test((raw || '').trim())
}

/** 展示/录入用：保证带 http(s) 前缀 */
function ensureHttpPrefix(raw: string): string {
  const input = (raw || '').trim()
  if (!input) return ''
  if (hasHttpPrefix(input)) return input.replace(/\/$/, '')
  return `https://${input.replace(/^\/+/, '')}`
}

/** 匹配用：从带协议 URL 或裸域名中提取 hostname */
function hostnameOf(raw: string): string {
  const input = (raw || '').trim()
  if (!input) return ''
  try {
    const withProto = hasHttpPrefix(input) ? input : `https://${input}`
    return new URL(withProto).hostname.replace(/^\./, '').toLowerCase()
  } catch {
    return input
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .replace(/^\./, '')
      .toLowerCase()
  }
}

/** 校验黑名单域名：必须带协议且可解析 */
function parseDomainInput(raw: string): { ok: boolean; domain?: string; host?: string } {
  const input = (raw || '').trim()
  if (!input) return { ok: false }
  if (!hasHttpPrefix(input)) return { ok: false }
  try {
    const u = new URL(input)
    const host = u.hostname.replace(/^\./, '').toLowerCase()
    if (!host) return { ok: false }
    return { ok: true, domain: input.replace(/\/$/, ''), host }
  } catch {
    return { ok: false }
  }
}

function openSite(domain: string) {
  if (!domain) return
  const url = hasHttpPrefix(domain) ? domain : `https://${domain}`
  try {
    chrome.tabs.create({ url })
  } catch {
    window.open(url, '_blank')
  }
}

async function handleCardCommand(cmd: string, item: PtCredential) {
  if (cmd === 'edit') openCredDialog(item)
  else if (cmd === 'toggle-category') await toggleCategory(item)
  else if (cmd === 'add-to-blacklist') await addCredToBlacklist(item)
  else if (cmd === 'delete') await deleteCred(item)
}

function categoryLabel(category: CredentialCategory): string {
  if (category === 'pt') return 'PT站点'
  if (category === 'intranet') return '内网'
  return '自定义'
}

function nextCredentialCategory(item: PtCredential): CredentialCategory {
  const category = getCategory(item)
  if (category === 'pt') return 'intranet'
  if (category === 'intranet') return 'custom'
  return 'pt'
}

async function toggleCategory(item: PtCredential) {
  const next = nextCredentialCategory(item)
  const list = creds.value.map((c) =>
    itemKey(c) === itemKey(item)
      ? { ...c, category: next, updatedAt: new Date().toISOString() }
      : c,
  )
  await savePtCredentials(list)
  creds.value = list
  ElMessage.success(`已移到${categoryLabel(next)}`)
}

async function addCredToBlacklist(item: PtCredential) {
  const host = hostnameOf(item.domain)
  const exists = blacklist.value.some((b) => hostnameOf(b.domain) === host)
  if (exists) {
    ElMessage.info('该域名已在黑名单中')
    currentTab.value = 'blacklist'
    return
  }
  const now = new Date().toISOString()
  const domainWithPrefix = ensureHttpPrefix(item.domain)
  const entry: SiteBlacklistEntry = {
    id: crypto.randomUUID(),
    domain: domainWithPrefix,
    name: item.name || host || domainWithPrefix,
    blockLoginFill: true,
    blockCaptchaFill: false,
    blockCredentialSavePrompt: true,
    createdAt: now,
    updatedAt: now,
  }
  const list = [...blacklist.value, entry]
  await persistBlacklist(list)
  blacklist.value = list
  ElMessage.success('已加入黑名单')
  currentTab.value = 'blacklist'
}

async function deleteCred(item: PtCredential) {
  try {
    await confirmDelete(`确认删除「${displayName(item)}」的凭据？`)
  } catch {
    return
  }
  const list = creds.value.filter((c) => itemKey(c) !== itemKey(item))
  await savePtCredentials(list)
  creds.value = list
  ElMessage.success('已删除')
}

function openBlacklistDialog(item?: SiteBlacklistEntry) {
  if (item) {
    editingBlId.value = item.id
    blForm.value = {
      domain: ensureHttpPrefix(item.domain),
      name: item.name || '',
      blockLoginFill: item.blockLoginFill !== false,
      blockCaptchaFill: !!item.blockCaptchaFill,
      blockCredentialSavePrompt: item.blockCredentialSavePrompt !== false,
    }
  } else {
    editingBlId.value = null
    blForm.value = {
      domain: '',
      name: '',
      blockLoginFill: true,
      blockCaptchaFill: false,
      blockCredentialSavePrompt: true,
    }
  }
  blDialogVisible.value = true
}

function resetBlForm() {
  editingBlId.value = null
}

async function saveBlacklistEntry() {
  const f = blForm.value
  const parsed = parseDomainInput(f.domain)
  if (!parsed.ok || !parsed.domain) {
    ElMessage.warning('请填写合法域名，且必须以 http:// 或 https:// 开头')
    return
  }
  const host = parsed.host || hostnameOf(parsed.domain)
  const duplicate = blacklist.value.some(
    (b) => hostnameOf(b.domain) === host && b.id !== editingBlId.value,
  )
  if (duplicate) {
    ElMessage.warning('该域名已在黑名单中')
    return
  }
  saving.value = true
  try {
    const now = new Date().toISOString()
    const list = [...blacklist.value]
    const displayName = f.name.trim() || host || parsed.domain
    if (editingBlId.value) {
      const i = list.findIndex((b) => b.id === editingBlId.value)
      if (i >= 0) {
        list[i] = {
          ...list[i],
          domain: parsed.domain,
          name: displayName,
          blockLoginFill: f.blockLoginFill,
          blockCaptchaFill: f.blockCaptchaFill,
          blockCredentialSavePrompt: f.blockCredentialSavePrompt,
          updatedAt: now,
        }
      }
    } else {
      list.push({
        id: crypto.randomUUID(),
        domain: parsed.domain,
        name: displayName,
        blockLoginFill: f.blockLoginFill,
        blockCaptchaFill: f.blockCaptchaFill,
        blockCredentialSavePrompt: f.blockCredentialSavePrompt,
        createdAt: now,
        updatedAt: now,
      })
    }
    await persistBlacklist(list)
    blacklist.value = list
    ElMessage.success('已保存')
    blDialogVisible.value = false
  } finally {
    saving.value = false
  }
}

async function removeBlacklist(item: SiteBlacklistEntry) {
  try {
    await confirmAction(`确认从黑名单移除「${displayDomain(item.domain)}」？`, {
      title: '移除确认',
      kind: 'danger',
      confirmButtonText: '移除',
    })
  } catch {
    return
  }
  const list = blacklist.value.filter((b) => b.id !== item.id)
  await persistBlacklist(list)
  blacklist.value = list
  ElMessage.success('已移除')
}

function handleBlacklistCommand(cmd: string, item: SiteBlacklistEntry) {
  if (cmd === 'edit') openBlacklistDialog(item)
  else if (cmd === 'delete') void removeBlacklist(item)
}

function handleMoreCommand(cmd: string) {
  if (cmd === 'refresh') void loadAll().then(() => ElMessage.success('已刷新'))
  else if (cmd === 'json-export') void onExport()
  else if (cmd === 'json-import') void onImport()
  else if (cmd === 'bitwarden-import') void onBitwardenImport()
}

async function onExport() {
  try {
    const exportedAt = new Date().toISOString()
    const text = await encryptLocalJsonWithSavedKey('credentials', {
      version: 1,
      exportedAt,
      credentials: creds.value.map((credential) => ({ ...credential })),
      credentialGroups: credentialGroups.value.map((group) => ({ ...group })),
      blacklist: blacklist.value.map((entry) => ({ ...entry })),
    })
    downloadText(`pt-credentials-${exportedAt.slice(0, 10)}.json`, text)
    ElMessage.success('已导出加密本地 JSON')
  } catch (error) {
    ElMessage.error(`导出失败：${String(error)}`)
  }
}

async function onImport() {
  const files = await requestFilesFromActivePage({
    action: 'credentials:json',
    view: 'credentials',
    accept: 'application/json,.json',
    title: '选择凭据备份文件',
  })
  if (files[0]) await importCredentialsFile(files[0])
}

async function onBitwardenImport() {
  const files = await requestFilesFromActivePage({
    action: 'credentials:bitwarden-json',
    view: 'credentials',
    accept: 'application/json,.json',
    title: '选择 Bitwarden JSON 导出文件',
  })
  if (files[0]) await importBitwardenFile(files[0])
}

function finishBitwardenImport(confirmed: boolean): void {
  if (!resolveBitwardenConfirm) {
    bitwardenDialogVisible.value = false
    bitwardenPreview.value = null
    return
  }
  const resolve = resolveBitwardenConfirm
  resolveBitwardenConfirm = null
  bitwardenDialogVisible.value = false
  bitwardenPreview.value = null
  resolve(confirmed)
}

function confirmBitwardenImport(result: BitwardenImportResult): Promise<boolean> {
  bitwardenPreview.value = result
  bitwardenDialogVisible.value = true
  return new Promise((resolve) => {
    resolveBitwardenConfirm = resolve
  })
}

async function importBitwardenFile(item: PickedPageFile): Promise<void> {
  try {
    const text = new TextDecoder().decode(item.bytes)
    const result = await importBitwardenCredentials(
      text,
      creds.value,
      createCredentialSiteBatchResolver(),
      await loadTotpSites(),
    )
    const credentialChanges = result.stats.added + result.stats.updated
    const totpChanges = result.totpStats.added + result.totpStats.updated
    if (!credentialChanges && !totpChanges) {
      ElMessage.info('没有可新增或更新的 Bitwarden 凭据或 TOTP')
      return
    }
    if (!(await confirmBitwardenImport(result))) return
    if (credentialChanges) {
      await savePtCredentials(result.credentials)
      creds.value = result.credentials
      await loadCredIcons()
    }
    if (totpChanges) await saveTotpSites(result.totpSites)
    ElMessage.success(
      `凭据新增 ${result.stats.added} 条、更新 ${result.stats.updated} 条；TOTP 新增 ${result.totpStats.added} 条、更新 ${result.totpStats.updated} 条`,
    )
  } catch (error) {
    ElMessage.error(`Bitwarden 导入失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

async function importCredentialsFile(item: PickedPageFile): Promise<void> {
  try {
    const text = new TextDecoder().decode(item.bytes)
    const inspection = inspectLocalJsonImport(text)
    let legacyPassword: string | undefined
    if (inspection.needsLegacyPassword) {
      try {
        legacyPassword = await promptPassword(
          '此文件由旧项目加密导出，请输入正确的旧版备份密钥。',
          '导入旧版凭据',
        )
      } catch {
        return
      }
    }
    const result = await importCompatibleLocalJson(text, 'credentials', legacyPassword)
    if (result.type !== 'credentials') throw new Error('请选择凭据备份文件')
    const data = result.payload
    const incoming = data.credentials
    if (!Array.isArray(incoming)) throw new Error('格式不正确')
    const map = new Map(creds.value.map((c) => [itemKey(c), c]))
    const now = new Date().toISOString()
    for (const c of incoming) {
      if (!c?.domain || typeof c?.username !== 'string') continue
      const id = c.id || crypto.randomUUID()
      const key = c.id || `${c.domain}::${c.username}`
      map.set(key, {
        ...c,
        id,
        category: c.category || 'pt',
        updatedAt: now,
        createdAt: c.createdAt || now,
      })
    }
    const importedGroups = (data.credentialGroups || []).filter(
      (group): group is CredentialGroup => !!group?.id && !!group?.name,
    )
    const groupMap = new Map(credentialGroups.value.map((group) => [group.id, group]))
    for (const group of importedGroups) groupMap.set(group.id, group)
    const groups = [...groupMap.values()]
    const validGroupIds = new Set(groups.map((group) => group.id))
    const list = [...map.values()].map((credential) => ({
      ...credential,
      groupId: credential.groupId && validGroupIds.has(credential.groupId)
        ? credential.groupId
        : undefined,
    }))
    await Promise.all([savePtCredentials(list), saveCredentialGroups(groups)])
    creds.value = list
    credentialGroups.value = groups
    if (Array.isArray(data.blacklist)) {
      await persistBlacklist(data.blacklist)
      blacklist.value = data.blacklist
    }
    ElMessage.success(
      result.source === 'legacy-credentials-v2'
        ? `已导入旧版加密备份中的 ${incoming.length} 条凭据`
        : `已导入 ${incoming.length} 条凭据`,
    )
  } catch (e) {
    ElMessage.error(`导入失败：${String(e)}`)
  }
}

onMounted(async () => {
  await loadAll()
  const picked = await consumePickedPageFiles('credentials:json')
  if (picked[0]) await importCredentialsFile(picked[0])
  const bitwardenPicked = await consumePickedPageFiles('credentials:bitwarden-json')
  if (bitwardenPicked[0]) await importBitwardenFile(bitwardenPicked[0])
})
</script>

<style scoped>
.pt-manager-root {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}


.toolbar {
  padding: 10px 10px 8px;
  background: var(--mp-color-surface, #ffffff);
  border-bottom: 1px solid #e2e8f0;
  box-sizing: border-box;
  flex: 0 0 auto;
}

.toolbar-row {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  --tb-control-h: 28px;
}

.search-input {
  flex: 1;
  min-width: 0;
}

.search-input :deep(.el-input__wrapper) {
  height: var(--tb-control-h) !important;
  min-height: var(--tb-control-h) !important;
  max-height: var(--tb-control-h) !important;
  padding: 0 11px !important;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e2e8f0 inset;
  background: #f8fafc;
  box-sizing: border-box;
}

.search-input :deep(.el-input__inner) {
  height: 100% !important;
  line-height: 1.2 !important;
}

.search-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #16a34a inset !important;
  background: #ffffff;
}

.compact {
  width: var(--tb-control-h, 28px);
  height: var(--tb-control-h, 28px);
  padding: 0 !important;
  border-radius: 8px;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid #e2e8f0 !important;
  background: #ffffff !important;
  color: #475569 !important;
  margin: 0 !important;
  box-sizing: border-box;
}

.add-button {
  background: #16a34a !important;
  border-color: #16a34a !important;
  color: #ffffff !important;
}

.add-button:hover {
  background: #15803d !important;
  border-color: #15803d !important;
  color: #ffffff !important;
}

.more-button:hover {
  background: #f1f5f9 !important;
  border-color: #cbd5e1 !important;
  color: #0f172a !important;
}

.icon-prefix {
  color: #64748b;
  fill: currentColor;
}

.icon-btn-only {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

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

.text-danger {
  color: #ef4444;
}

.pt-tabs {
  display: flex;
  align-items: stretch;
  min-width: 0;
  width: 100%;
  /* 不在此层裁切，避免激活色条被 overflow 吃掉 */
  background: var(--mp-color-surface, #ffffff);
  border-bottom: 1px solid #e2e8f0;
  padding: 0;
  flex: 0 0 auto;
  box-sizing: border-box;
}

.pt-tabs-scroll {
  display: flex;
  align-items: stretch;
  flex: 1 1 auto;
  min-width: 0;
  width: 0;
  overflow-x: auto;
  cursor: grab;
  user-select: none;
  overflow-y: hidden;
  /* 给 bottom:-1px 的激活色条留出绘制空间，避免被滚动容器裁成 1px 高 */
  padding-bottom: 1px;
  margin-bottom: -1px;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.pt-tabs-scroll::-webkit-scrollbar {
  width: 0;
  height: 0;
  background: transparent;
  display: none;
}

.pt-tabs-scroll:active {
  cursor: grabbing;
}

.pt-tab-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  touch-action: pan-x;
  white-space: nowrap;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  position: relative;
  user-select: none;
  transition: color 0.15s ease;
}

.pt-tab-item:hover {
  color: #0f172a;
}

.pt-tab-item.active {
  color: #16a34a;
  font-weight: 600;
}

.pt-tab-item.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 16px;
  right: 16px;
  height: 2px;
  background: #16a34a;
  border-radius: 2px 2px 0 0;
  z-index: 1;
}

.group-button {
  color: #16a34a;
}

.pt-grid {
  min-width: 0;
  padding: 10px;
  box-sizing: border-box;
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  text-align: center;
}

.empty-icon {
  color: #94a3b8;
  margin-bottom: 12px;
  opacity: 0.6;
  fill: currentColor;
}

.empty-state :deep(.el-button--small) {
  height: 30px;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
}

.empty-text {
  font-size: 13px;
  color: #64748b;
  margin: 0 0 16px;
}

.pt-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pt-loading-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pt-loading-card {
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  padding: 12px;
  pointer-events: none;
}

.pt-loading-main {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pt-loading-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  flex-shrink: 0;
}

.pt-loading-info {
  flex: 1;
  min-width: 0;
}

.pt-loading-line {
  height: 9px;
  border-radius: 999px;
}

.pt-loading-line.name {
  width: 58%;
  height: 12px;
  margin-bottom: 7px;
}

.pt-loading-line.domain {
  width: 76%;
  margin-bottom: 7px;
}

.pt-loading-line.username {
  width: 46%;
}

.pt-loading-actions {
  display: flex;
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.pt-loading-action {
  width: 31px;
  height: 28px;
}

.pt-loading-password-row {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
}

.pt-loading-password {
  width: 124px;
  height: 18px;
  border-radius: 999px;
}

.pt-loading-time {
  width: 108px;
  height: 10px;
  border-radius: 999px;
}

.pt-loading-shimmer {
  background: linear-gradient(90deg, #edf2f7 25%, #f8fafc 37%, #edf2f7 63%);
  background-size: 400% 100%;
  animation: pt-loading-shimmer 1.25s ease-in-out infinite;
}

@keyframes pt-loading-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}

.pt-card,
.bl-card {
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  padding: 12px;
  display: flex;
  flex-direction: column;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.pt-card:hover {
  border-color: rgba(22, 163, 74, 0.3);
  box-shadow:
    0 4px 12px rgba(22, 163, 74, 0.06),
    0 1px 3px rgba(0, 0, 0, 0.02);
  transform: translateY(-1px);
}

.bl-card:hover {
  border-color: rgba(239, 68, 68, 0.3);
  box-shadow:
    0 4px 12px rgba(239, 68, 68, 0.06),
    0 1px 3px rgba(0, 0, 0, 0.02);
  transform: translateY(-1px);
}

.card-main {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.site-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
  overflow: hidden;
}

.site-avatar.has-icon {
  background: transparent !important;
  box-shadow: none;
  color: inherit;
}

.site-avatar.is-private {
  background: rgba(71, 85, 105, 0.12);
  color: #475569;
  box-shadow: inset 0 0 0 1px rgba(71, 85, 105, 0.14);
}

.private-site-icon {
  display: block;
  fill: currentColor;
}

.site-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  background: transparent;
}

.site-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.site-name {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.site-domain {
  font-size: 11px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.domain-icon {
  flex-shrink: 0;
  fill: currentColor;
  opacity: 0.9;
}

.domain-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.site-domain.link-style {
  color: #16a34a;
  cursor: pointer;
}

.site-domain.link-style:hover {
  color: #15803d;
}

.site-domain.link-style:hover .domain-text {
  text-decoration: underline;
}

.site-username {
  font-size: 11px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  cursor: pointer;
}

.site-username:hover {
  color: #16a34a;
}

.fetch-site-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin-top: 8px;
  width: 100%;
}

.fetch-site-row :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.fetch-site-icon {
  fill: currentColor;
  flex-shrink: 0;
}

.fetch-site-hint {
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.35;
}

.bl-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
  min-width: 0;
}

.bl-tags {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.bl-tag {
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border-radius: 6px;
  padding: 0 6px;
  height: 20px;
  line-height: 1;
  vertical-align: middle;
  flex-shrink: 0;
  margin: 0 !important;
}

.bl-tag :deep(.el-tag__content) {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  line-height: 1;
  white-space: nowrap;
}

.bl-tag-icon {
  fill: currentColor;
  flex-shrink: 0;
}

.card-actions {
  display: flex;
  gap: 0;
  border-radius: 6px;
  overflow: hidden;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  flex-shrink: 0;
}



.action-btn {
  padding: 6px 8px !important;
  height: 28px !important;
  min-width: 30px !important;
  border: none !important;
  background: transparent !important;
  color: #475569 !important;
  border-radius: 0 !important;
  margin: 0 !important;
}

.action-btn:hover {
  background: #f1f5f9 !important;
  color: #16a34a !important;
}

.action-btn svg {
  fill: currentColor;
}

.delete-btn:hover {
  background: #fef2f2 !important;
  color: #ef4444 !important;
}

.card-password-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e2e8f0;
  font-size: 11px;
  gap: 8px;
}

.pw-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.password-label {
  color: #94a3b8;
  flex-shrink: 0;
}

.password-value {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  font-family: 'Courier New', Courier, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dots {
  letter-spacing: 0.08em;
  color: #64748b;
}

.time-wrap {
  color: #94a3b8;
  flex-shrink: 0;
  font-size: 11px;
}

/* 暗色 */
:global(html[data-theme='dark']) .toolbar,
:global(html[data-theme='dark']) .pt-tabs {
  border-bottom-color: #334155;
  background: var(--mp-color-surface, #1e293b);
}

:global(html[data-theme='dark']) .search-input :deep(.el-input__wrapper) {
  background: rgba(255, 255, 255, 0.04);
  box-shadow: 0 0 0 1px #334155 inset;
}

:global(html[data-theme='dark']) .compact {
  background: var(--mp-color-surface, #1e293b) !important;
  border-color: #334155 !important;
  color: #cbd5e1 !important;
}

:global(html[data-theme='dark']) .add-button {
  background: #16a34a !important;
  border-color: #16a34a !important;
  color: #fff !important;
}

:global(html[data-theme='dark']) .more-button:hover {
  background: rgba(255, 255, 255, 0.08) !important;
  border-color: #475569 !important;
  color: #e2e8f0 !important;
}

:global(html[data-theme='dark']) .action-btn {
  color: #94a3b8 !important;
}

:global(html[data-theme='dark']) .action-btn:hover {
  background: rgba(255, 255, 255, 0.06) !important;
  color: #4ade80 !important;
}

:global(html[data-theme='dark']) .delete-btn:hover {
  background: rgba(239, 68, 68, 0.12) !important;
  color: #f87171 !important;
}

:global(html[data-theme='dark']) .pt-loading-shimmer {
  background: linear-gradient(90deg, #334155 25%, #475569 37%, #334155 63%);
  background-size: 400% 100%;
}

:global(html[data-theme='dark']) .password-value {
  color: #e2e8f0;
}

:global(html[data-theme='dark']) .card-password-row {
  border-top-color: #334155;
}

:global(html[data-theme='dark']) .pt-tab-item {
  color: #94a3b8;
}

:global(html[data-theme='dark']) .pt-tab-item:hover {
  color: #e2e8f0;
}

:global(html[data-theme='dark']) .pt-tab-item.active {
  color: #4ade80;
}

:global(html[data-theme='dark']) .pt-tab-item.active::after {
  background: #4ade80;
}

:global(html[data-theme='dark']) .pt-card,
:global(html[data-theme='dark']) .bl-card,
:global(html[data-theme='dark']) .pt-loading-card {
  background: var(--mp-color-card, #1e293b);
  border-color: #334155;
}

:global(html[data-theme='dark']) .pt-card:hover {
  border-color: rgba(74, 222, 128, 0.35);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
}

:global(html[data-theme='dark']) .site-name {
  color: #e2e8f0;
}

:global(html[data-theme='dark']) .site-domain,
:global(html[data-theme='dark']) .site-username {
  color: #94a3b8;
}

:global(html[data-theme='dark']) .site-domain.link-style {
  color: #4ade80;
}

:global(html[data-theme='dark']) .card-actions {
  background: rgba(255, 255, 255, 0.04);
  border-color: #334155;
}

:global(html[data-theme='dark']) .action-btn {
  color: #94a3b8 !important;
}

:global(html[data-theme='dark']) .card-password-row,
:global(html[data-theme='dark']) .bl-info-row {
  border-top-color: #334155;
}

:global(html[data-theme='dark']) .password-value {
  color: #e2e8f0;
}

:global(html[data-theme='dark']) .bl-card:hover {
  border-color: rgba(248, 113, 113, 0.4);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
}

:global(html[data-theme='dark']) .time-wrap {
  color: #64748b;
}

:global(html[data-theme='dark']) .empty-text {
  color: #94a3b8;
}

:global(html[data-theme='dark']) .bl-tag {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

/* 二级弹窗 */
:global(.el-overlay:has(.mp-sub-dialog)) {
  overflow: auto !important;
}

:global(.el-overlay:has(.mp-sub-dialog) .el-overlay-dialog) {
  display: flex !important;
  align-items: flex-start !important;
  justify-content: center !important;
  overflow: visible !important;
  padding: 24px 0 !important;
  box-sizing: border-box !important;
}

:global(.mp-sub-dialog.el-dialog) {
  width: 92% !important;
  max-width: 348px;
  height: auto !important;
  max-height: calc(100vh - 48px) !important;
  margin: 0 auto !important;
  border-radius: 12px;
  overflow: hidden;
  display: flex !important;
  flex-direction: column;
  position: relative !important;
  top: auto !important;
}

:global(.mp-sub-dialog .el-dialog__header) {
  flex: 0 0 auto;
  margin-right: 0;
  padding: 12px 14px 10px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

:global(.mp-sub-dialog .el-dialog__title) {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.35;
}

:global(.mp-sub-dialog .el-dialog__headerbtn) {
  top: 10px;
  right: 12px;
  width: 28px;
  height: 28px;
}

:global(.mp-sub-dialog .el-dialog__body) {
  flex: 1 1 auto;
  min-height: 0;
  padding: 12px 14px 6px;
  overflow-x: hidden;
  overflow-y: auto;
  max-height: none !important;
  height: auto !important;
}

:global(.mp-sub-dialog .el-dialog__footer) {
  flex: 0 0 auto;
  padding: 10px 14px 12px;
  border-top: 1px solid rgba(15, 23, 42, 0.06);
  background: inherit;
}

.mp-sub-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.mp-sub-form :deep(.el-form-item:last-child) {
  margin-bottom: 4px;
}

.mp-sub-form :deep(.el-form-item__label) {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 6px !important;
  line-height: 1.25;
  padding: 0;
  height: auto;
}

.mp-sub-control {
  width: 100%;
}

.mp-sub-form :deep(.el-input--small .el-input__wrapper),
.mp-sub-form :deep(.el-select--small .el-select__wrapper) {
  height: 30px !important;
  min-height: 30px !important;
  max-height: 30px !important;
  box-sizing: border-box !important;
  border-radius: 8px;
}

.mp-sub-form :deep(.el-input__wrapper),
.mp-sub-form :deep(.el-textarea__inner) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e2e8f0 inset;
}

.mp-sub-form :deep(.el-input__wrapper.is-focus),
.mp-sub-form :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px #16a34a inset !important;
}

.mp-sub-radio :deep(.el-radio) {
  margin-right: 16px;
  height: 30px;
}

.option-hint {
  margin-top: 6px;
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.4;
}

.mp-sub-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  min-height: 30px;
}

.mp-sub-checks-col {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.mp-sub-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.mp-sub-footer :deep(.el-button) {
  min-width: 72px;
  height: 30px;
  border-radius: 8px;
  font-size: 12px;
  padding: 0 14px;
}

:global(html[data-theme='dark'] .mp-sub-dialog.el-dialog) {
  background: #1e293b;
  border: 1px solid #334155;
}

:global(html[data-theme='dark'] .mp-sub-dialog .el-dialog__header),
:global(html[data-theme='dark'] .mp-sub-dialog .el-dialog__footer) {
  border-color: rgba(148, 163, 184, 0.14);
}

:global(html[data-theme='dark'] .mp-sub-dialog .el-dialog__title) {
  color: #f1f5f9;
}

:global(html[data-theme='dark']) .mp-sub-form :deep(.el-form-item__label) {
  color: #cbd5e1;
}

:global(html[data-theme='dark']) .mp-sub-form :deep(.el-input__wrapper),
:global(html[data-theme='dark']) .mp-sub-form :deep(.el-textarea__inner) {
  background: #0f172a;
  box-shadow: 0 0 0 1px #334155 inset !important;
  color: #e2e8f0;
}

:global(html[data-theme='dark']) .mp-sub-form :deep(.el-input__wrapper.is-focus),
:global(html[data-theme='dark']) .mp-sub-form :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px #4ade80 inset !important;
}

/* Bitwarden 导入弹窗：摘要紧凑展示，展开明细由弹窗主体统一滚动 */
:global(.el-overlay:has(.bitwarden-import-dialog)) {
  overflow: hidden !important;
}

:global(.el-overlay:has(.bitwarden-import-dialog) .el-overlay-dialog) {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  overflow: hidden !important;
  padding: 16px 12px !important;
  box-sizing: border-box !important;
}

:global(.bitwarden-import-dialog.el-dialog) {
  width: 92% !important;
  max-width: 520px;
  height: auto !important;
  max-height: min(640px, calc(100vh - 32px), calc(100dvh - 32px)) !important;
  margin: 0 auto !important;
  overflow: hidden;
  display: flex !important;
  flex-direction: column;
  position: relative !important;
  top: auto !important;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 20px 56px rgba(15, 23, 42, 0.16);
}

:global(.bitwarden-import-dialog .el-dialog__header) {
  flex: 0 0 auto;
  margin: 0;
  padding: 12px 14px 10px;
  border-bottom: 1px solid #eef2f7;
}

:global(.bitwarden-import-dialog .el-dialog__headerbtn) {
  top: 10px;
  right: 10px;
  width: 26px;
  height: 26px;
}

:global(.bitwarden-import-dialog .el-dialog__body) {
  flex: 1 1 auto;
  min-height: 0;
  max-height: none !important;
  height: auto !important;
  padding: 10px 14px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

:global(.bitwarden-import-dialog .el-dialog__footer) {
  flex: 0 0 auto;
  padding: 10px 14px 12px;
  border-top: 1px solid #eef2f7;
  background: inherit;
}

.bw-dialog-header {
  display: flex;
  align-items: center;
  gap: 9px;
  padding-right: 22px;
}

.bw-dialog-icon {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 30px;
  place-items: center;
  border-radius: 8px;
  background: #eff6ff;
  color: #2563eb;
  fill: currentColor;
}

.bw-dialog-icon svg {
  width: 15px;
  height: 15px;
}

.bw-dialog-title {
  color: #0f172a;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
}

.bw-dialog-subtitle {
  margin-top: 1px;
  color: #64748b;
  font-size: 10.5px;
  line-height: 1.3;
}

.bw-import-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bw-summary-list {
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  background: #f8fafc;
}

.bw-summary-row {
  display: grid;
  min-height: 34px;
  padding: 0 10px;
  grid-template-columns: minmax(58px, 1fr) repeat(4, minmax(54px, auto));
  align-items: center;
  column-gap: 12px;
}

.bw-summary-row + .bw-summary-row {
  border-top: 1px solid #e2e8f0;
}

.bw-summary-kind {
  color: #334155;
  font-size: 11px;
  font-weight: 700;
  text-align: left;
}

.bw-summary-metric {
  display: inline-flex;
  min-width: 0;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  color: #334155;
  white-space: nowrap;
}

.bw-summary-metric small {
  color: inherit;
  font-size: 9.5px;
  line-height: 1;
}

.bw-summary-metric b {
  color: inherit;
  font-size: 12px;
  line-height: 1;
}

.bw-summary-metric--add b {
  color: #15803d;
}

.bw-summary-metric--update b {
  color: #1d4ed8;
}

.bw-summary-metric--keep b {
  color: #c2410c;
}

.bw-import-note {
  padding: 6px 10px;
  border-left: 3px solid #60a5fa;
  border-radius: 0 6px 6px 0;
  background: #f8fafc;
  color: #475569;
  font-size: 10.5px;
  line-height: 1.4;
}

.bw-detail-collapse {
  border-top: 0;
  border-bottom: 0;
}

.bw-detail-collapse :deep(.el-collapse-item__header) {
  min-height: 34px;
  height: 34px;
  line-height: 34px;
  padding: 0 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #334155;
  font-size: 12px;
  font-weight: 600;
}

.bw-detail-collapse :deep(.el-collapse-item + .el-collapse-item) {
  margin-top: 6px;
}

.bw-detail-collapse :deep(.el-collapse-item__wrap) {
  border-bottom: 0;
}

.bw-detail-collapse :deep(.el-collapse-item__content) {
  padding: 6px 0 0;
}

.bw-collapse-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bw-count {
  display: inline-flex;
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 10px;
  line-height: 1;
}

.bw-count--warning {
  background: #fef3c7;
  color: #b45309;
}

.bw-count--muted {
  background: #e2e8f0;
  color: #475569;
}

.bw-detail-list {
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.bw-detail-row {
  display: flex;
  padding: 7px 9px;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  background: #ffffff;
}

.bw-detail-row + .bw-detail-row {
  border-top: 1px solid #f1f5f9;
}

.bw-detail-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 1px;
}

.bw-detail-name {
  overflow: hidden;
  color: #1e293b;
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-detail-meta,
.bw-detail-user {
  overflow: hidden;
  color: #64748b;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-detail-reason {
  max-width: 42%;
  flex: 0 0 auto;
  color: #94a3b8;
  font-size: 10px;
  line-height: 1.35;
  text-align: right;
}

.bw-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.bw-dialog-footer :deep(.el-button) {
  min-width: 76px;
  height: 30px;
  border-radius: 8px;
  font-size: 12px;
}

:global(html[data-theme='dark'] .bitwarden-import-dialog.el-dialog) {
  border-color: #334155;
  background: #1e293b;
}

:global(html[data-theme='dark'] .bitwarden-import-dialog .el-dialog__header),
:global(html[data-theme='dark'] .bitwarden-import-dialog .el-dialog__footer) {
  border-color: rgba(148, 163, 184, 0.16);
}

:global(html[data-theme='dark'] .bitwarden-import-dialog .el-dialog__body) {
  color: #cbd5e1;
}

:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-dialog-icon),
:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-import-note),
:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-summary-list) {
  border-color: #334155;
  background: #0f172a;
}

:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-summary-kind),
:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-summary-metric),
:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-detail-name) {
  color: #cbd5e1;
}

:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-summary-metric--add b) {
  color: #4ade80;
}

:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-summary-metric--update b) {
  color: #60a5fa;
}

:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-summary-metric--keep b) {
  color: #fb923c;
}

:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-dialog-title) {
  color: #f1f5f9;
}

:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-dialog-subtitle),
:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-import-note),
:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-detail-meta),
:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-detail-user),
:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-detail-reason) {
  color: #94a3b8;
}

:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-summary-row + .bw-summary-row) {
  border-color: #334155;
}

:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-detail-collapse) {
  --el-collapse-border-color: #334155;
  --el-collapse-header-bg-color: #111827;
  --el-collapse-header-text-color: #cbd5e1;
  --el-collapse-content-bg-color: #0f172a;
  --el-collapse-content-text-color: #cbd5e1;
  border-color: #334155;
  background: #0f172a;
}

:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-detail-collapse .el-collapse-item__header),
:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-detail-collapse .el-collapse-item__wrap),
:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-detail-collapse .el-collapse-item__content) {
  border-color: #334155;
  background: #0f172a;
  color: #cbd5e1;
}

:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-detail-list) {
  border-color: #334155;
  background: #0f172a;
}

:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-detail-row) {
  border-color: rgba(148, 163, 184, 0.14);
  background: #0f172a;
}

:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-dialog-footer .el-button:not(.el-button--primary)) {
  border-color: #475569;
  background: #1e293b;
  color: #e2e8f0;
}

:global(html[data-theme='dark'] .bitwarden-import-dialog .bw-dialog-footer .el-button:not(.el-button--primary):hover) {
  border-color: #64748b;
  background: #334155;
  color: #f8fafc;
}

@media (max-width: 480px) {
  .bw-summary-row {
    min-height: 32px;
    padding: 0 8px;
    grid-template-columns: minmax(44px, 1fr) repeat(4, minmax(40px, auto));
    column-gap: 6px;
  }

  .bw-summary-metric {
    flex-direction: column;
    align-items: center;
    gap: 1px;
  }

  .bw-summary-metric small {
    font-size: 8.5px;
  }

  .bw-summary-metric b {
    font-size: 11px;
  }

  .bw-detail-row {
    flex-direction: column;
    gap: 6px;
  }

  .bw-detail-reason {
    max-width: none;
    text-align: left;
  }
}
</style>

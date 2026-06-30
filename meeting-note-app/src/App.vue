<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { NConfigProvider, NMessageProvider, NDialogProvider, darkTheme, zhCN, dateZhCN } from 'naive-ui'
import { CalendarOutline, SettingsOutline } from '@vicons/ionicons5'

const router = useRouter()
const route = useRoute()

const showInstallBanner = ref(false)
let deferredPrompt: any = null

onMounted(() => {
  // 监听 PWA 安装事件
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    // 如果还未安装，延迟显示安装横幅
    setTimeout(() => {
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        showInstallBanner.value = true
      }
    }, 3000)
  })
})

async function handleInstall() {
  if (!deferredPrompt) return
  deferredPrompt.prompt()
  const result = await deferredPrompt.userChoice
  if (result.outcome === 'accepted') {
    showInstallBanner.value = false
  }
  deferredPrompt = null
}

function isActive(path: string): boolean {
  return route.path === path
}
</script>

<template>
  <NConfigProvider :locale="zhCN" :date-locale="dateZhCN" :theme="null">
    <NMessageProvider>
      <NDialogProvider>
        <div class="app-shell">
          <!-- 顶部导航栏 -->
          <header class="app-header">
            <h1 class="app-title" @click="router.push('/')">会议记录</h1>
            <button class="header-btn" @click="router.push('/settings')">
              <NIcon size="20"><SettingsOutline /></NIcon>
            </button>
          </header>

          <!-- 主内容区 -->
          <main class="app-main">
            <router-view v-slot="{ Component }">
              <transition name="fade" mode="out-in">
                <component :is="Component" />
              </transition>
            </router-view>
          </main>

          <!-- PWA 安装横幅 -->
          <transition name="fade">
            <div v-if="showInstallBanner" class="install-banner">
              <span>安装到桌面，使用更方便</span>
              <button class="install-btn" @click="handleInstall">安装</button>
              <button class="dismiss-btn" @click="showInstallBanner = false">✕</button>
            </div>
          </transition>
        </div>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 900px;
  margin: 0 auto;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(10px);
}

.app-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--primary);
  cursor: pointer;
  user-select: none;
}

.header-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.header-btn:active {
  background: var(--bg);
}

.app-main {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

/* PWA 安装横幅 */
.install-banner {
  position: fixed;
  bottom: 16px;
  left: 16px;
  right: 16px;
  max-width: 400px;
  margin: 0 auto;
  background: var(--primary);
  color: white;
  padding: 12px 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  box-shadow: 0 4px 20px rgba(79, 70, 229, 0.3);
  z-index: 1000;
}
.install-btn {
  background: white;
  color: var(--primary);
  border: none;
  padding: 6px 16px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  white-space: nowrap;
}
.dismiss-btn {
  background: none;
  border: none;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  font-size: 1rem;
  padding: 4px;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .app-header {
    padding: 10px 12px;
  }
  .app-title {
    font-size: 1rem;
  }
  .app-main {
    padding: 8px;
  }
}
</style>

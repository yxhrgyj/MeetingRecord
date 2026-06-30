<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NIcon, NInput, NSpace, NDivider, NText, useMessage } from 'naive-ui'
import { ArrowBack, SaveOutline, CloudDoneOutline, InformationCircleOutline } from '@vicons/ionicons5'

const router = useRouter()
const message = useMessage()

const supabaseUrl = ref(localStorage.getItem('supabase_url') || import.meta.env.VITE_SUPABASE_URL || '')
const supabaseKey = ref(localStorage.getItem('supabase_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '')
const openaiKey = ref(localStorage.getItem('openai_key') || import.meta.env.VITE_OPENAI_API_KEY || '')

function saveSettings() {
  localStorage.setItem('supabase_url', supabaseUrl.value)
  localStorage.setItem('supabase_key', supabaseKey.value)
  localStorage.setItem('openai_key', openaiKey.value)
  message.success('设置已保存（下次启动生效）')
}

// 检查 PWA 状态
const isStandalone = ref(
  typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
)
</script>

<template>
  <div class="settings-page">
    <div class="settings-header">
      <NButton text @click="router.push('/')">
        <template #icon><NIcon><ArrowBack /></NIcon></template>
      </NButton>
      <h2>设置</h2>
    </div>

    <div class="settings-content">
      <!-- 连接状态 -->
      <div class="status-card">
        <div class="status-item">
          <NIcon size="18" :color="supabaseUrl ? '#10b981' : '#94a3b8'"><CloudDoneOutline /></NIcon>
          <NText>{{ supabaseUrl ? 'Supabase 已配置' : 'Supabase 未配置' }}</NText>
        </div>
        <div class="status-item">
          <NIcon size="18" :color="isStandalone ? '#10b981' : '#94a3b8'"><InformationCircleOutline /></NIcon>
          <NText>{{ isStandalone ? '已安装为应用' : '浏览器模式运行' }}</NText>
        </div>
      </div>

      <NDivider>数据同步配置</NDivider>

      <div class="form-group">
        <label>Supabase URL</label>
        <NInput v-model:value="supabaseUrl" placeholder="https://your-project.supabase.co" />
      </div>

      <div class="form-group">
        <label>Supabase Anon Key</label>
        <NInput v-model:value="supabaseKey" placeholder="eyJhbGciOi..." type="password" show-password-on="click" />
      </div>

      <NDivider>AI 配置（语音转写功能）</NDivider>

      <div class="form-group">
        <label>OpenAI API Key</label>
        <NInput v-model:value="openaiKey" placeholder="sk-..." type="password" show-password-on="click" />
        <NText depth="3" style="font-size: 0.75rem; margin-top: 4px;">
          用于后续的语音转文字和AI摘要功能，可稍后配置
        </NText>
      </div>

      <div class="save-section">
        <NButton type="primary" @click="saveSettings">
          <template #icon><NIcon><SaveOutline /></NIcon></template>
          保存设置
        </NButton>
      </div>

      <!-- 使用说明 -->
      <NDivider>使用说明</NDivider>
      <div class="guide">
        <h4>第一步：注册 Supabase</h4>
        <p>访问 supabase.com 注册账号，创建新项目。在项目 SQL Editor 中运行 schema.sql 创建表结构。从项目设置中获取 URL 和 Anon Key。</p>

        <h4>第二步：安装到桌面/手机</h4>
        <p>浏览器打开应用后，点击地址栏的安装图标（或应用内的安装横幅），即可安装为独立应用。</p>

        <h4>第三步：开始记录</h4>
        <p>在日历上点击任意日期创建会议记录。选择记录模板快速录入。会议标题会显示在日历格子上。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 600px;
  margin: 0 auto;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.settings-header h2 {
  font-size: 1.1rem;
  font-weight: 600;
}

.settings-content {
  background: var(--card-bg);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.status-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--bg);
  border-radius: 8px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
}

.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--text-secondary);
}

.save-section {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.guide {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.7;
}
.guide h4 {
  font-size: 0.85rem;
  margin-top: 12px;
  color: var(--text);
}
.guide p {
  margin-top: 2px;
}
</style>

import fs from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const seedMeeting = {
  id: 'meeting-seed',
  title: '季度目标讨论',
  date: '2026-07-14',
  startTime: '09:30',
  endTime: '10:30',
  attendees: ['李明', '王瑜'],
  content: '## 会议决定\n\n确认第三季度优先事项。',
  createdAt: '2026-07-14T01:20:00.000Z',
  updatedAt: '2026-07-14T02:30:00.000Z'
}

async function mockApi(page) {
  const meetings = [{ ...seedMeeting }]

  await page.route('**/api/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname

    if (pathname === '/api/meetings' && request.method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(meetings) })
    }

    if (pathname === '/api/meetings' && request.method() === 'POST') {
      const created = {
        ...request.postDataJSON(),
        id: 'meeting-created',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      meetings.push(created)
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(created) })
    }

    if (pathname.startsWith('/api/meetings/') && pathname.endsWith('/export')) {
      return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: 'exported minutes' })
    }

    if (pathname.startsWith('/api/meetings/') && request.method() === 'PUT') {
      const id = pathname.split('/').at(-1)
      const index = meetings.findIndex(meeting => meeting.id === id)
      const updated = { ...meetings[index], ...request.postDataJSON(), updatedAt: new Date().toISOString() }
      meetings[index] = updated
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(updated) })
    }

    if (pathname.startsWith('/api/meetings/') && request.method() === 'DELETE') {
      const id = pathname.split('/').at(-1)
      const index = meetings.findIndex(meeting => meeting.id === id)
      if (index >= 0) meetings.splice(index, 1)
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    }

    if (pathname === '/api/settings/model-gateway') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ modelGatewayUrl: 'https://model.example.com' })
      })
    }

    if (pathname === '/api/model/health') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    }

    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not mocked' }) })
  })
}

function captureRuntimeErrors(page) {
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  return errors
}

async function saveQaScreenshot(page, name) {
  const directory = process.env.UI_QA_DIR
  if (!directory) return
  await fs.mkdir(directory, { recursive: true })
  await page.screenshot({ path: path.join(directory, name), fullPage: false })
}

test('desktop calendar creates, reads, and edits a meeting', async ({ page }) => {
  const runtimeErrors = captureRuntimeErrors(page)
  await mockApi(page)
  await page.goto('/')

  await expect(page).toHaveTitle('会议记录助手')
  await expect(page.getByText('会议助理').first()).toBeVisible()
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  await saveQaScreenshot(page, 'desktop-calendar-1440x900.png')

  await page.getByRole('button', { name: '周', exact: true }).click()
  await expect(page.getByRole('button', { name: '周', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '月', exact: true }).click()

  await page.getByRole('button', { name: '新建会议' }).click()
  const assistant = page.locator('[data-region="assistant"]')
  await expect(assistant).toBeVisible()
  await expect.poll(async () => (await assistant.boundingBox())?.x ?? Number.POSITIVE_INFINITY).toBeLessThan(1440)
  await page.getByLabel('会议标题').fill('第三季度产品规划会')
  await page.getByRole('button', { name: '插入会议模板' }).click()
  await expect(page.getByLabel('会议正文')).toHaveValue(/会议议题/)
  await saveQaScreenshot(page, 'desktop-editor-1440x900.png')

  await page.setViewportSize({ width: 1280, height: 800 })
  await expect.poll(async () => (await assistant.boundingBox())?.x ?? Number.POSITIVE_INFINITY).toBeLessThan(1280)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  await saveQaScreenshot(page, 'desktop-editor-1280x800.png')
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.getByRole('button', { name: '完成' }).click()
  await expect(page.getByText('第三季度产品规划会')).toBeVisible()

  await page.getByText('季度目标讨论').click()
  await expect(page.getByText('确认第三季度优先事项。')).toBeVisible()
  await expect(page.getByText('已整理')).toBeVisible()
  await page.waitForTimeout(250)
  await saveQaScreenshot(page, 'desktop-detail-1440x900.png')

  await page.getByRole('button', { name: '编辑' }).click()
  await expect(page.getByLabel('会议标题')).toHaveValue('季度目标讨论')
  await expect(page.getByText('会议助手')).toBeVisible()

  expect(runtimeErrors).toEqual([])
})

test('mobile starts in day view and opens the assistant sheet without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const runtimeErrors = captureRuntimeErrors(page)
  await mockApi(page)
  await page.goto('/')

  await expect(page.getByRole('button', { name: '日', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await saveQaScreenshot(page, 'mobile-calendar-390x844.png')
  await page.getByRole('button', { name: '新建会议' }).click()
  await page.getByRole('button', { name: '打开会议助手' }).click()
  const assistant = page.locator('[data-region="assistant"]')
  await expect(assistant).toContainText('实时记录')
  await expect.poll(async () => (await assistant.boundingBox())?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(500)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await saveQaScreenshot(page, 'mobile-assistant-390x844.png')

  expect(runtimeErrors).toEqual([])
})

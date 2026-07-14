import test from 'node:test'
import assert from 'node:assert/strict'

import { meetingToDocxBlob, monthToDocxBlob } from '../functions/_shared/docxExport.js'

const meeting = {
  title: '组织绩效需求确认沟通会',
  date: '2026-07-09',
  startTime: '09:00',
  endTime: '10:00',
  attendees: ['张三', '李四'],
  content: [
    '## 会议纪要草稿',
    '',
    '### 关键结论',
    '- 预算五百一十万',
    '',
    '### 待办事项',
    '- [ ] 张三提交方案 - 负责人：张三 - 截止：下周'
  ].join('\n')
}

test('meetingToDocxBlob creates a docx package for one meeting', async () => {
  const blob = await meetingToDocxBlob(meeting)
  const bytes = new Uint8Array(await blob.arrayBuffer())

  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'PK')
  assert.ok(bytes.length > 1000)
})

test('monthToDocxBlob creates a docx package for multiple meetings', async () => {
  const blob = await monthToDocxBlob({
    year: 2026,
    month: 7,
    meetings: [meeting, { ...meeting, title: '项目复盘会' }]
  })
  const bytes = new Uint8Array(await blob.arrayBuffer())

  assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'PK')
  assert.ok(bytes.length > 1000)
})

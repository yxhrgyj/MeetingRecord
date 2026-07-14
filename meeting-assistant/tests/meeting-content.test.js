import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeMeetingSummary,
  parseMeetingContent,
  serializeMeetingContent
} from '../src/domain/meetingContent.js'

test('canonical meeting content round-trips without loss', () => {
  const content = serializeMeetingContent({
    summary: '### 会议决定\n\n继续推进 8B 模型。',
    transcript: '[00:00-00:30]\n讨论模型选择。'
  })

  assert.equal(content, [
    '## 会议纪要',
    '',
    '### 会议决定',
    '',
    '继续推进 8B 模型。',
    '',
    '---',
    '',
    '## 完整转写',
    '',
    '[00:00-00:30]',
    '讨论模型选择。'
  ].join('\n'))
  assert.deepEqual(parseMeetingContent(content), {
    summary: '### 会议决定\n\n继续推进 8B 模型。',
    transcript: '[00:00-00:30]\n讨论模型选择。'
  })
})

test('legacy transcript followed by minutes draft is split conservatively', () => {
  assert.deepEqual(parseMeetingContent([
    '## 语音转写原文',
    '',
    '[00:00-00:30] 讨论预算。',
    '',
    '## 会议纪要草稿',
    '',
    '### 会议决定',
    '- 批准预算'
  ].join('\n')), {
    summary: '### 会议决定\n- 批准预算',
    transcript: '## 语音转写原文\n\n[00:00-00:30] 讨论预算。'
  })
})

test('legacy minutes draft without transcript is normalized as minutes', () => {
  assert.deepEqual(parseMeetingContent('## 会议纪要草稿\n\n### 结论\n继续推进'), {
    summary: '### 结论\n继续推进',
    transcript: ''
  })
})

test('unmarked legacy content remains primary meeting minutes', () => {
  assert.deepEqual(parseMeetingContent('## 手写纪要\n\n保留原始内容。'), {
    summary: '## 手写纪要\n\n保留原始内容。',
    transcript: ''
  })
})

test('transcript-only canonical content survives reload', () => {
  const content = serializeMeetingContent({ summary: '', transcript: '完整转写内容' })
  assert.equal(content, '## 完整转写\n\n完整转写内容')
  assert.deepEqual(parseMeetingContent(content), { summary: '', transcript: '完整转写内容' })
})

test('normalizes one leading minutes wrapper heading', () => {
  assert.equal(
    normalizeMeetingSummary('## 会议纪要草稿\n\n### 结论\n继续推进'),
    '### 结论\n继续推进'
  )
  assert.equal(
    normalizeMeetingSummary('## 会议纪要\n\n### 结论\n继续推进'),
    '### 结论\n继续推进'
  )
})

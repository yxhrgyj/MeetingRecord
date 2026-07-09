import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx'

import { downloadContentDisposition } from './meetings.js'

export const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const FONT = 'Microsoft YaHei'
const ACCENT = '2563EB'
const TEXT = '111827'
const MUTED = '64748B'
const LIGHT_FILL = 'EFF6FF'
const BORDER = 'CBD5E1'

function cleanText(value) {
  return String(value || '').trim()
}

function spacing(after = 160, before = 0) {
  return { before, after }
}

function run(text, options = {}) {
  return new TextRun({
    text: String(text || ''),
    font: FONT,
    color: options.color || TEXT,
    bold: options.bold || false,
    size: options.size || 22,
    italics: options.italics || false
  })
}

function paragraph(text, options = {}) {
  return new Paragraph({
    heading: options.heading,
    bullet: options.bullet,
    alignment: options.alignment,
    spacing: options.spacing || spacing(),
    children: [run(text, options)]
  })
}

function titleParagraph(title) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: spacing(180),
    children: [
      run(title || '会议纪要', {
        bold: true,
        size: 36,
        color: ACCENT
      })
    ]
  })
}

function dividerParagraph() {
  return new Paragraph({
    border: {
      bottom: {
        color: BORDER,
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6
      }
    },
    spacing: spacing(220)
  })
}

function metaCell(label, value, shaded = false) {
  return new TableCell({
    shading: shaded ? { fill: LIGHT_FILL } : undefined,
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
    children: [
      new Paragraph({
        spacing: spacing(0),
        children: [
          run(label, { bold: true, color: shaded ? ACCENT : MUTED, size: 20 }),
          run(value ? ` ${value}` : ' 未填写', { size: 20 })
        ]
      })
    ]
  })
}

function metaTable(meeting) {
  const time = [meeting.startTime, meeting.endTime].filter(Boolean).join(' - ')
  const attendees = Array.isArray(meeting.attendees) ? meeting.attendees.join('、') : ''
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
      left: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
      right: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: BORDER }
    },
    rows: [
      new TableRow({
        children: [
          metaCell('日期', meeting.date, true),
          metaCell('时间', time, true)
        ]
      }),
      new TableRow({
        children: [
          metaCell('参会人', attendees, false),
          metaCell('导出时间', new Date().toLocaleString('zh-CN'), false)
        ]
      })
    ]
  })
}

function parseMarkdownContent(content) {
  const lines = String(content || '').split(/\r?\n/)
  const paragraphs = []

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      paragraphs.push(new Paragraph({ spacing: spacing(80) }))
      continue
    }
    if (line.startsWith('### ')) {
      paragraphs.push(paragraph(line.slice(4), {
        heading: HeadingLevel.HEADING_2,
        bold: true,
        color: ACCENT,
        size: 26,
        spacing: spacing(120, 220)
      }))
      continue
    }
    if (line.startsWith('## ')) {
      paragraphs.push(paragraph(line.slice(3), {
        heading: HeadingLevel.HEADING_1,
        bold: true,
        color: ACCENT,
        size: 30,
        spacing: spacing(140, 260)
      }))
      continue
    }
    if (/^-\s+\[[ x]\]\s+/i.test(line)) {
      paragraphs.push(paragraph(`☐ ${line.replace(/^-\s+\[[ x]\]\s+/i, '')}`, {
        size: 21,
        spacing: spacing(90)
      }))
      continue
    }
    if (line.startsWith('- ')) {
      paragraphs.push(paragraph(line.slice(2), {
        bullet: { level: 0 },
        size: 21,
        spacing: spacing(80)
      }))
      continue
    }
    paragraphs.push(paragraph(line, { size: 21, spacing: spacing(100) }))
  }

  return paragraphs
}

function meetingChildren(meeting, options = {}) {
  const children = [
    titleParagraph(cleanText(meeting.title) || '会议纪要'),
    dividerParagraph(),
    metaTable(meeting),
    new Paragraph({ spacing: spacing(180) }),
    ...parseMarkdownContent(meeting.content)
  ]

  if (options.pageBreakAfter) {
    children.push(new Paragraph({ pageBreakBefore: true }))
  }

  return children
}

async function documentToBlob(document) {
  const blob = await Packer.toBlob(document)
  return new Blob([blob], { type: DOCX_MIME_TYPE })
}

export async function meetingToDocxBlob(meeting) {
  const document = new Document({
    creator: 'MeetingRecord',
    title: cleanText(meeting.title) || '会议纪要',
    description: 'Meeting minutes exported from MeetingRecord.',
    sections: [
      {
        properties: {
          page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } }
        },
        children: meetingChildren(meeting)
      }
    ]
  })

  return documentToBlob(document)
}

export async function monthToDocxBlob({ year, month, meetings }) {
  const children = [
    titleParagraph(`会议纪要月报 - ${year}年${month}月`),
    paragraph(`共 ${meetings.length} 场会议`, {
      color: MUTED,
      size: 22,
      spacing: spacing(240)
    }),
    dividerParagraph()
  ]

  meetings.forEach((meeting, index) => {
    children.push(...meetingChildren(meeting, { pageBreakAfter: index < meetings.length - 1 }))
  })

  const document = new Document({
    creator: 'MeetingRecord',
    title: `会议纪要月报 - ${year}年${month}月`,
    description: 'Monthly meeting minutes exported from MeetingRecord.',
    sections: [
      {
        properties: {
          page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } }
        },
        children
      }
    ]
  })

  return documentToBlob(document)
}

export function docxResponse(blob, filename) {
  return new Response(blob, {
    headers: {
      'Content-Type': DOCX_MIME_TYPE,
      'Content-Disposition': downloadContentDisposition(filename)
    }
  })
}

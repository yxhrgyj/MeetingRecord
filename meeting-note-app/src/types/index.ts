/** 会议记录类型 */
export interface Meeting {
  id: string
  user_id: string
  title: string
  meeting_date: string // YYYY-MM-DD
  start_time: string | null // HH:mm
  end_time: string | null // HH:mm
  participants: string[]
  location: string
  agenda: string
  notes: string // Markdown 格式的笔记
  conclusion: string
  action_items: ActionItem[]
  meeting_type: MeetingType
  template_id: string | null
  created_at: string
  updated_at: string
}

/** 待办事项 */
export interface ActionItem {
  id: string
  content: string
  assignee: string
  due_date: string | null
  completed: boolean
}

/** 会议类型 */
export type MeetingType = 'general' | 'project' | 'client' | 'internal' | 'brainstorm'

/** 会议类型选项 */
export const MeetingTypeLabels: Record<MeetingType, string> = {
  general: '通用会议',
  project: '项目会议',
  client: '客户会议',
  internal: '内部讨论',
  brainstorm: '头脑风暴'
}

/** 记录模板 */
export interface MeetingTemplate {
  id: string
  user_id: string
  name: string
  meeting_type: MeetingType
  fields: TemplateField[]
  created_at: string
}

/** 模板字段 */
export interface TemplateField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'date' | 'time' | 'multi-select'
  required: boolean
  options?: string[] // 用于 select 和 multi-select
  placeholder?: string
}

/** 日历视图模式 */
export type CalendarViewMode = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'

/** Supabase 数据同步状态 */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

/** 新建会议的初始数据 */
export function createEmptyMeeting(date?: string): Partial<Meeting> {
  return {
    title: '',
    meeting_date: date || new Date().toISOString().slice(0, 10),
    start_time: null,
    end_time: null,
    participants: [],
    location: '',
    agenda: '',
    notes: '',
    conclusion: '',
    action_items: [],
    meeting_type: 'general',
    template_id: null
  }
}

/** 预设的默认模板 */
export const defaultTemplates: Omit<MeetingTemplate, 'id' | 'user_id' | 'created_at'>[] = [
  {
    name: '通用会议',
    meeting_type: 'general',
    fields: [
      { key: 'agenda', label: '会议议题', type: 'textarea', required: true, placeholder: '本次会议讨论的议题' },
      { key: 'participants', label: '参会人员', type: 'multi-select', required: false, options: [] },
      { key: 'notes', label: '会议记录', type: 'textarea', required: false, placeholder: '会议讨论要点' },
      { key: 'conclusion', label: '会议结论', type: 'textarea', required: false, placeholder: '达成的共识和结论' },
      { key: 'action_items', label: '待办事项', type: 'textarea', required: false, placeholder: '后续行动项' }
    ]
  },
  {
    name: '项目会议',
    meeting_type: 'project',
    fields: [
      { key: 'agenda', label: '项目议题', type: 'textarea', required: true, placeholder: '本次项目讨论的议题' },
      { key: 'notes', label: '进度同步', type: 'textarea', required: false, placeholder: '各模块进度情况' },
      { key: 'conclusion', label: '决策记录', type: 'textarea', required: false, placeholder: '技术选型或方案决策' },
      { key: 'action_items', label: '任务分配', type: 'textarea', required: false, placeholder: '分配的任务和负责人' }
    ]
  },
  {
    name: '客户会议',
    meeting_type: 'client',
    fields: [
      { key: 'agenda', label: '客户需求', type: 'textarea', required: true, placeholder: '客户提出的需求' },
      { key: 'participants', label: '客户方参会人', type: 'multi-select', required: false, options: [] },
      { key: 'notes', label: '沟通要点', type: 'textarea', required: false, placeholder: '与客户的沟通内容' },
      { key: 'conclusion', label: '后续跟进', type: 'textarea', required: false, placeholder: '需要后续跟进的事项' }
    ]
  }
]

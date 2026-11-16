import { api } from "./client"

// Activity metrics of a server (members with `manage_server`, the owner or an
// administrator). Two services answer: servidores counts new members and the
// members of each day (Métricas HU-3), and mensajes counts messages and active
// members. Both check the permission again.

export interface DailyMessages {
  date: string // YYYY-MM-DD, in the viewer's time zone
  messagesSent: number
}

// One day of the member growth chart (Métricas HU-3).
export interface DailyMembers {
  date: string // YYYY-MM-DD, in the viewer's time zone
  members: number // at the end of the day
  joined: number
  left: number
}

export interface MemberGrowth {
  membersAtStart: number
  membersAtEnd: number
  daily: DailyMembers[]
}

export interface ServerMetrics {
  newMembers: number
  totalMembers: number
  messagesSent: number
  activeMembers: number
  messagesDeleted: number
  messagesDeletedByModerators: number
  daily: DailyMessages[]
  growth: MemberGrowth
}

interface BackendMemberMetrics {
  new_members: number
  total_members: number
}

interface BackendMessageMetrics {
  messages_sent: number
  active_members: number
  messages_deleted: number
  messages_deleted_by_moderators: number
  daily: { date: string; messages_sent: number }[]
}

interface BackendMemberGrowth {
  members_at_start: number
  members_at_end: number
  daily: DailyMembers[]
}

export const METRICS_PERIODS = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
  { days: 365, label: "1 año" },
] as const

// The last `days` days, today included: from local midnight `days - 1` days ago
// to the next local midnight, so every bar of the chart is a whole day.
export function lastDaysPeriod(days: number, now: Date = new Date()): { from: Date; to: Date } {
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))
  return { from, to }
}

export function membersLeftIn(growth: MemberGrowth): number {
  return growth.daily.reduce((sum, d) => sum + d.left, 0)
}

// CA2: nothing happened in the period, so the UI says so instead of drawing an
// empty chart. A member leaving also counts as activity.
export function hasNoActivity(m: ServerMetrics): boolean {
  return m.messagesSent === 0 && m.newMembers === 0 && m.messagesDeleted === 0 && membersLeftIn(m.growth) === 0
}

export async function getServerMetrics(serverId: string, from: Date, to: Date): Promise<ServerMetrics> {
  const period = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
  const dailyQuery = new URLSearchParams(period)
  // Minutes to add to UTC (-180 in Buenos Aires): only decides the day of each bar.
  dailyQuery.set("tz_offset", String(-from.getTimezoneOffset()))
  const [members, messages, growth] = await Promise.all([
    api<BackendMemberMetrics>(`/servers/${serverId}/metrics/members?${period.toString()}`),
    api<BackendMessageMetrics>(`/servers/${serverId}/metrics/messages?${dailyQuery.toString()}`),
    api<BackendMemberGrowth>(`/servers/${serverId}/metrics/members/daily?${dailyQuery.toString()}`),
  ])
  return {
    newMembers: members.new_members,
    totalMembers: members.total_members,
    messagesSent: messages.messages_sent,
    activeMembers: messages.active_members,
    messagesDeleted: messages.messages_deleted,
    messagesDeletedByModerators: messages.messages_deleted_by_moderators,
    daily: messages.daily.map((d) => ({ date: d.date, messagesSent: d.messages_sent })),
    growth: {
      membersAtStart: growth.members_at_start,
      membersAtEnd: growth.members_at_end,
      daily: growth.daily,
    },
  }
}

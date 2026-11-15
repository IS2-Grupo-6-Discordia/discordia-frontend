import { api } from "./client"

// Activity metrics of a server (members with `manage_server`, the owner or an
// administrator). Two services answer: servidores counts new members and
// mensajes counts messages and active members. Both check the permission again.

export interface DailyMessages {
  date: string // YYYY-MM-DD, in the viewer's time zone
  messagesSent: number
}

export interface ServerMetrics {
  newMembers: number
  totalMembers: number
  messagesSent: number
  activeMembers: number
  messagesDeleted: number
  messagesDeletedByModerators: number
  daily: DailyMessages[]
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

// CA2: nothing happened in the period, so the UI says so instead of drawing an
// empty chart.
export function hasNoActivity(m: ServerMetrics): boolean {
  return m.messagesSent === 0 && m.newMembers === 0 && m.messagesDeleted === 0
}

export async function getServerMetrics(serverId: string, from: Date, to: Date): Promise<ServerMetrics> {
  const period = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
  const messagesQuery = new URLSearchParams(period)
  // Minutes to add to UTC (-180 in Buenos Aires): only decides the day of each bar.
  messagesQuery.set("tz_offset", String(-from.getTimezoneOffset()))
  const [members, messages] = await Promise.all([
    api<BackendMemberMetrics>(`/servers/${serverId}/metrics/members?${period.toString()}`),
    api<BackendMessageMetrics>(`/servers/${serverId}/metrics/messages?${messagesQuery.toString()}`),
  ])
  return {
    newMembers: members.new_members,
    totalMembers: members.total_members,
    messagesSent: messages.messages_sent,
    activeMembers: messages.active_members,
    messagesDeleted: messages.messages_deleted,
    messagesDeletedByModerators: messages.messages_deleted_by_moderators,
    daily: messages.daily.map((d) => ({ date: d.date, messagesSent: d.messages_sent })),
  }
}

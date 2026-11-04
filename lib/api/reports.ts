import { api } from "./client"

export type ReportReason = "spam" | "harassment" | "inappropriate_content" | "impersonation" | "other"

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Acoso" },
  { value: "inappropriate_content", label: "Contenido inapropiado" },
  { value: "impersonation", label: "Suplantación de identidad" },
  { value: "other", label: "Otro motivo" },
]

export type ReportTarget =
  | { type: "user"; serverId: string; userId: string; name: string }
  | { type: "server"; serverId: string; name: string }
  | { type: "message"; serverId: string; channelId: string; messageId: string; userId: string; name: string; content: string }

export async function createReport(target: ReportTarget, reason: ReportReason, detail: string): Promise<void> {
  await api("/reports", {
    method: "POST",
    body: JSON.stringify({
      target_type: target.type,
      server_id: target.serverId,
      user_id: target.type === "server" ? null : target.userId,
      ...(target.type === "message" ? { message_id: target.messageId, channel_id: target.channelId, message_content: target.content } : {}),
      reason,
      detail: detail.trim() || null,
    }),
  })
}

export type ReportStatus = "pending" | "reviewed" | "dismissed"

export interface ServerReport {
  id: string
  targetType: "user" | "message"
  reporterId: string
  targetUserId: string
  messageId: string | null
  channelId: string | null
  messageContent: string | null
  reason: ReportReason
  detail: string | null
  status: ReportStatus
  createdAt: string
  resolvedAt: string | null
  resolvedBy: string | null
}

interface BackendReport {
  id: string
  target_type: "user" | "message"
  reporter_id: string
  target_user_id: string
  message_id: string | null
  channel_id: string | null
  message_content: string | null
  reason: ReportReason
  detail: string | null
  status: ReportStatus
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
}

function toServerReport(r: BackendReport): ServerReport {
  return {
    id: r.id,
    targetType: r.target_type,
    reporterId: r.reporter_id,
    targetUserId: r.target_user_id,
    messageId: r.message_id,
    channelId: r.channel_id,
    messageContent: r.message_content,
    reason: r.reason,
    detail: r.detail,
    status: r.status,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    resolvedBy: r.resolved_by,
  }
}

export async function listServerReports(serverId: string, status: ReportStatus): Promise<ServerReport[]> {
  const list = await api<BackendReport[]>(`/servers/${serverId}/reports?status=${status}`)
  return list.map(toServerReport)
}

export async function getPendingReportCount(serverId: string): Promise<number> {
  const res = await api<{ pending: number }>(`/servers/${serverId}/reports/pending-count`)
  return res.pending
}

export async function resolveServerReport(serverId: string, reportId: string, status: "reviewed" | "dismissed"): Promise<ServerReport> {
  const res = await api<BackendReport>(`/servers/${serverId}/reports/${reportId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ status }),
  })
  return toServerReport(res)
}

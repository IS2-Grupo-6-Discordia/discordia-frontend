import { api } from "./client"

export type AuditAction = "member_banned" | "member_unbanned" | "report_reviewed" | "report_dismissed" | "server_suspended" | "server_reactivated"

export type AuditGroup = "bans" | "reports" | "staff"

export interface AuditEntry {
  id: string
  action: AuditAction
  actorId: string
  actorIsStaff: boolean
  targetUserId: string | null
  reportId: string | null
  detail: string | null
  createdAt: string
}

interface BackendAuditEntry {
  id: string
  action: AuditAction
  actor_id: string
  actor_is_staff: boolean
  target_user_id: string | null
  report_id: string | null
  detail: string | null
  created_at: string
}

export const AUDIT_PAGE_SIZE = 30

export async function listAuditLog(serverId: string, options: { before?: string; group?: AuditGroup } = {}): Promise<AuditEntry[]> {
  const params = new URLSearchParams({ limit: String(AUDIT_PAGE_SIZE) })
  if (options.before) params.set("before", options.before)
  if (options.group) params.set("type", options.group)
  const list = await api<BackendAuditEntry[]>(`/servers/${serverId}/audit-log?${params.toString()}`)
  return list.map((e) => ({
    id: e.id,
    action: e.action,
    actorId: e.actor_id,
    actorIsStaff: e.actor_is_staff,
    targetUserId: e.target_user_id,
    reportId: e.report_id,
    detail: e.detail,
    createdAt: e.created_at,
  }))
}

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

export async function createReport(target: ReportTarget, reason: ReportReason, detail: string): Promise<void> {
  await api("/reports", {
    method: "POST",
    body: JSON.stringify({
      target_type: target.type,
      server_id: target.serverId,
      user_id: target.type === "user" ? target.userId : null,
      reason,
      detail: detail.trim() || null,
    }),
  })
}

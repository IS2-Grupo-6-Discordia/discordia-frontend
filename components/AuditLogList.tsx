import { useCallback, useEffect, useRef, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native"
import type { ComponentProps } from "react"
import { Ionicons } from "@expo/vector-icons"
import { friendlyError } from "@/api/client"
import { getUsersBatch } from "@/api/auth"
import { AUDIT_PAGE_SIZE, listAuditLog, type AuditAction, type AuditEntry, type AuditGroup } from "@/api/audit"
import { REPORT_REASONS } from "@/api/reports"

interface AuditLogListProps {
  serverId: string
  memberName: (userId: string) => string | null
}

const FILTERS: { value: AuditGroup | null; label: string }[] = [
  { value: null, label: "Todo" },
  { value: "bans", label: "Baneos" },
  { value: "reports", label: "Reportes" },
  { value: "staff", label: "Staff" },
]

const ACTIONS: Record<AuditAction, { icon: ComponentProps<typeof Ionicons>["name"]; color: string; verb: string }> = {
  member_banned: { icon: "ban-outline", color: "#FF7F72", verb: "baneó a" },
  member_unbanned: { icon: "lock-open-outline", color: "#4FD69C", verb: "levantó el baneo de" },
  report_reviewed: { icon: "checkmark-done-outline", color: "#37D6C0", verb: "revisó un reporte sobre" },
  report_dismissed: { icon: "close-circle-outline", color: "#8DA8AC", verb: "descartó un reporte sobre" },
  server_suspended: { icon: "pause-circle-outline", color: "#F0C24B", verb: "suspendió el servidor" },
  server_reactivated: { icon: "play-circle-outline", color: "#4FD69C", verb: "reactivó el servidor" },
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
}

function detailText(entry: AuditEntry): string | null {
  if (!entry.detail) return null
  if (entry.action === "report_reviewed" || entry.action === "report_dismissed")
    return `Motivo del reporte: ${REPORT_REASONS.find((r) => r.value === entry.detail)?.label ?? entry.detail}`
  return `Motivo: ${entry.detail}`
}

export default function AuditLogList({ serverId, memberName }: AuditLogListProps) {
  const [group, setGroup] = useState<AuditGroup | null>(null)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState("")
  const [names, setNames] = useState<Record<string, string>>({})
  const requested = useRef(new Set<string>())
  const memberNameRef = useRef(memberName)
  memberNameRef.current = memberName

  const resolveNames = useCallback(
    (list: AuditEntry[]) => {
      const ids = new Set<string>()
      for (const e of list) {
        if (!e.actorIsStaff) ids.add(e.actorId)
        if (e.targetUserId) ids.add(e.targetUserId)
      }
      const missing = [...ids].filter((id) => !memberNameRef.current(id) && !requested.current.has(id))
      if (missing.length === 0) return
      for (const id of missing) requested.current.add(id)
      getUsersBatch(missing)
        .then((users) => setNames((prev) => ({ ...prev, ...Object.fromEntries(users.map((u) => [u.id, u.name])) })))
        .catch(() => undefined)
    },
    [],
  )

  const load = useCallback(
    async (before?: string) => {
      if (before) setLoadingMore(true)
      else setLoading(true)
      setError("")
      try {
        const page = await listAuditLog(serverId, { before, group: group ?? undefined })
        setEntries((prev) => (before ? [...prev, ...page] : page))
        setHasMore(page.length === AUDIT_PAGE_SIZE)
        resolveNames(page)
      } catch (err) {
        setError(friendlyError(err))
        if (!before) setEntries([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [serverId, group, resolveNames],
  )

  useEffect(() => {
    load()
  }, [load])

  const nameOf = (id: string | null) => (id ? (memberName(id) ?? names[id] ?? "Usuario") : "")

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 12 }}>
        {FILTERS.map((f) => {
          const selected = group === f.value
          return (
            <Pressable
              key={f.label}
              onPress={() => setGroup(f.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 8,
                backgroundColor: selected ? "rgba(255,255,255,0.10)" : "transparent",
                borderWidth: 1,
                borderColor: selected ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)",
              }}
            >
              <Text style={{ color: selected ? "#E6F3F3" : "#8DA8AC", fontSize: 11.5, fontWeight: "700" }}>{f.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {error ? (
        <View
          style={{
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 10,
            marginBottom: 12,
            backgroundColor: "rgba(255,127,114,0.12)",
            borderWidth: 1,
            borderColor: "rgba(255,127,114,0.30)",
          }}
        >
          <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={{ paddingVertical: 30, alignItems: "center" }}>
          <ActivityIndicator color="#FF7F72" />
        </View>
      ) : entries.length === 0 && !error ? (
        <View style={{ alignItems: "center", gap: 8, paddingVertical: 26 }}>
          <Ionicons name="document-text-outline" size={28} color="#5E7E82" />
          <Text style={{ color: "#E6F3F3", fontSize: 13.5, fontWeight: "700" }}>Todavía no hay acciones registradas</Text>
          <Text style={{ color: "#8DA8AC", fontSize: 12, textAlign: "center", lineHeight: 17 }}>
            Acá quedan los baneos, los reportes resueltos y las medidas del staff, con quién las tomó y cuándo.
          </Text>
        </View>
      ) : (
        <ScrollView style={{ maxHeight: 460 }}>
          {entries.map((e, i) => {
            const meta = ACTIONS[e.action] ?? { icon: "ellipse-outline" as const, color: "#8DA8AC", verb: e.action }
            const detail = detailText(e)
            return (
              <View
                key={e.id}
                style={{
                  flexDirection: "row",
                  gap: 10,
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: "rgba(255,255,255,0.06)",
                }}
              >
                <View
                  style={{ width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: `${meta.color}22` }}
                >
                  <Ionicons name={meta.icon} size={15} color={meta.color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: "#C9DADB", fontSize: 13, lineHeight: 18 }}>
                    <Text style={{ color: "#E6F3F3", fontWeight: "700" }}>{e.actorIsStaff ? "El staff de Discordia" : nameOf(e.actorId)}</Text> {meta.verb}
                    {e.targetUserId ? (
                      <Text style={{ color: "#E6F3F3", fontWeight: "700" }}> {nameOf(e.targetUserId)}</Text>
                    ) : null}
                  </Text>
                  {detail ? (
                    <Text style={{ color: "#8DA8AC", fontSize: 12, marginTop: 2 }} numberOfLines={3}>
                      {detail}
                    </Text>
                  ) : null}
                  <Text style={{ color: "#5E7E82", fontSize: 11, marginTop: 2 }}>{formatDate(e.createdAt)}</Text>
                </View>
              </View>
            )
          })}
          {hasMore ? (
            <Pressable
              onPress={() => load(entries[entries.length - 1]?.createdAt)}
              disabled={loadingMore}
              style={{ alignItems: "center", paddingVertical: 10, marginTop: 4, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)" }}
            >
              {loadingMore ? <ActivityIndicator size="small" color="#8DA8AC" /> : <Text style={{ color: "#8DA8AC", fontSize: 12.5, fontWeight: "700" }}>Ver más</Text>}
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}

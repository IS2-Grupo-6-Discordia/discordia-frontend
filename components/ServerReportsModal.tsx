import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native"
import type { TextStyle, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { friendlyError } from "@/api/client"
import { REPORT_REASONS, listServerReports, resolveServerReport, type ReportStatus, type ServerReport } from "@/api/reports"
import AuditLogList from "./AuditLogList"
import ModalShell from "./ModalShell"
import PressableScale from "./PressableScale"

interface ServerReportsModalProps {
  visible: boolean
  serverId: string
  serverName: string
  nameOf: (userId: string) => string | null
  channelNameOf: (channelId: string) => string | null
  onClose: () => void
  onChanged: () => void
}

type Tab = ReportStatus | "resolved" | "log"

const TABS: { value: Tab; label: string }[] = [
  { value: "pending", label: "Pendientes" },
  { value: "resolved", label: "Resueltos" },
  { value: "log", label: "Registro" },
]

function reasonLabel(reason: string): string {
  return REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
}

export default function ServerReportsModal({ visible, serverId, serverName, nameOf: memberName, channelNameOf, onClose, onChanged }: ServerReportsModalProps) {
  const nameOf = (userId: string) => memberName(userId) ?? "Usuario fuera del servidor"
  const [tab, setTab] = useState<Tab>("pending")
  const [reports, setReports] = useState<ServerReport[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (tab === "log") return
    setLoading(true)
    setError("")
    try {
      if (tab === "pending") setReports(await listServerReports(serverId, "pending"))
      else {
        const [reviewed, dismissed] = await Promise.all([listServerReports(serverId, "reviewed"), listServerReports(serverId, "dismissed")])
        setReports([...reviewed, ...dismissed].sort((a, b) => (b.resolvedAt ?? b.createdAt).localeCompare(a.resolvedAt ?? a.createdAt)))
      }
    } catch (err) {
      setError(friendlyError(err))
      setReports([])
    } finally {
      setLoading(false)
    }
  }, [serverId, tab])

  useEffect(() => {
    if (visible && serverId) load()
  }, [visible, serverId, load])

  useEffect(() => {
    if (!visible) setTab("pending")
  }, [visible])

  const resolve = async (report: ServerReport, status: "reviewed" | "dismissed") => {
    setBusyId(report.id)
    setError("")
    try {
      await resolveServerReport(serverId, report.id, status)
      setReports((prev) => prev.filter((r) => r.id !== report.id))
      onChanged()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ModalShell visible={visible} onClose={onClose} title="Moderación" subtitle={serverName} maxWidth={520}>
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
        {TABS.map((t) => {
          const selected = tab === t.value
          return (
            <Pressable
              key={t.value}
              onPress={() => setTab(t.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 9999,
                backgroundColor: selected ? "rgba(255,127,114,0.16)" : "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: selected ? "rgba(255,127,114,0.55)" : "transparent",
              }}
            >
              <Text style={{ color: selected ? "#FF9E94" : "#8DA8AC", fontSize: 12, fontWeight: "700" }}>{t.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {tab === "log" ? <AuditLogList serverId={serverId} memberName={memberName} /> : null}

      {tab !== "log" && error ? (
        <View style={NOTICE_ERROR}>
          <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{error}</Text>
        </View>
      ) : null}

      {tab === "log" ? null : loading ? (
        <View style={{ paddingVertical: 30, alignItems: "center" }}>
          <ActivityIndicator color="#FF7F72" />
        </View>
      ) : reports.length === 0 ? (
        <View style={{ alignItems: "center", gap: 8, paddingVertical: 26 }}>
          <Ionicons name={tab === "pending" ? "shield-checkmark-outline" : "archive-outline"} size={28} color="#5E7E82" />
          <Text style={{ color: "#E6F3F3", fontSize: 13.5, fontWeight: "700" }}>{tab === "pending" ? "No hay reportes pendientes" : "Todavía no resolviste reportes"}</Text>
          <Text style={{ color: "#8DA8AC", fontSize: 12, textAlign: "center", lineHeight: 17 }}>
            {tab === "pending" ? "Cuando un miembro reporte un mensaje o a alguien del servidor, lo vas a ver acá." : "Los reportes que revises o descartes quedan guardados acá."}
          </Text>
        </View>
      ) : (
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 10 }}>
          {reports.map((r) => {
            const channelName = r.channelId ? channelNameOf(r.channelId) : null
            return (
              <View key={r.id} style={CARD}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <View style={CHIP}>
                    <Ionicons name={r.targetType === "message" ? "chatbox-ellipses-outline" : "person-outline"} size={11} color="#FF9E94" />
                    <Text style={{ color: "#FF9E94", fontSize: 10.5, fontWeight: "800" }}>{r.targetType === "message" ? "Mensaje" : "Usuario"}</Text>
                  </View>
                  <Text style={{ color: "#E6F3F3", fontSize: 12.5, fontWeight: "700" }}>{reasonLabel(r.reason)}</Text>
                  <Text style={{ color: "#5E7E82", fontSize: 11, marginLeft: "auto" }}>{formatDate(r.createdAt)}</Text>
                </View>

                <Text style={META}>
                  Reportado: <Text style={{ color: "#E6F3F3", fontWeight: "700" }}>{nameOf(r.targetUserId)}</Text>
                  {channelName ? ` · en #${channelName}` : ""}
                </Text>

                {r.messageContent ? (
                  <View style={QUOTE}>
                    <Text numberOfLines={6} style={{ color: "#E6F3F3", fontSize: 13, lineHeight: 18 }}>
                      {r.messageContent}
                    </Text>
                    <Text style={{ color: "#5E7E82", fontSize: 10.5, marginTop: 4 }}>Copia del mensaje al momento del reporte</Text>
                  </View>
                ) : null}

                {r.detail ? <Text style={{ color: "#B9CCCF", fontSize: 12.5, lineHeight: 18 }}>“{r.detail}”</Text> : null}

                <Text style={META}>Lo reportó {nameOf(r.reporterId)}</Text>

                {r.status === "pending" ? (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                    <Pressable onPress={() => resolve(r, "dismissed")} disabled={busyId === r.id} style={[SECONDARY, { flex: 1 }]}>
                      <Text style={{ color: "#8DA8AC", fontWeight: "700", fontSize: 13 }}>Descartar</Text>
                    </Pressable>
                    <PressableScale onPress={() => resolve(r, "reviewed")} disabled={busyId === r.id} style={[PRIMARY, { flex: 1, opacity: busyId === r.id ? 0.6 : 1 }]}>
                      {busyId === r.id ? <ActivityIndicator size="small" color="#04211D" /> : null}
                      <Text style={{ color: "#04211D", fontWeight: "800", fontSize: 13 }}>Marcar revisado</Text>
                    </PressableScale>
                  </View>
                ) : (
                  <Text style={[META, { color: r.status === "reviewed" ? "#4FD69C" : "#8DA8AC" }]}>
                    {r.status === "reviewed" ? "Revisado" : "Descartado"}
                    {r.resolvedBy ? ` por ${nameOf(r.resolvedBy)}` : ""}
                    {r.resolvedAt ? ` · ${formatDate(r.resolvedAt)}` : ""}
                  </Text>
                )}
              </View>
            )
          })}
        </ScrollView>
      )}
    </ModalShell>
  )
}

const CARD: ViewStyle = {
  gap: 6,
  padding: 12,
  borderRadius: 12,
  backgroundColor: "rgba(255,255,255,0.04)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
}

const CHIP: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
  paddingHorizontal: 7,
  paddingVertical: 2,
  borderRadius: 9999,
  backgroundColor: "rgba(255,127,114,0.14)",
}

const META: TextStyle = { color: "#8DA8AC", fontSize: 12 }

const QUOTE: ViewStyle = {
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 8,
  borderLeftWidth: 3,
  borderLeftColor: "#FF7F72",
  backgroundColor: "rgba(0,0,0,0.18)",
}

const NOTICE_ERROR: ViewStyle = {
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 10,
  marginBottom: 12,
  backgroundColor: "rgba(255,127,114,0.12)",
  borderWidth: 1,
  borderColor: "rgba(255,127,114,0.30)",
}

const PRIMARY: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  borderRadius: 10,
  paddingVertical: 10,
  backgroundColor: "#FF7F72",
}

const SECONDARY: ViewStyle = {
  paddingVertical: 10,
  borderRadius: 10,
  backgroundColor: "rgba(255,255,255,0.06)",
  alignItems: "center",
  justifyContent: "center",
}

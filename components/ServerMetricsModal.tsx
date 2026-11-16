import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { friendlyError } from "@/lib/api/client"
import {
  METRICS_PERIODS,
  getServerMetrics,
  hasNoActivity,
  lastDaysPeriod,
  membersLeftIn,
  type DailyMembers,
  type DailyMessages,
  type MemberGrowth,
  type ServerMetrics,
} from "@/lib/api/metrics"
import MetricsBarChart, { type ChartBar } from "./MetricsBarChart"
import ModalShell from "./ModalShell"

interface ServerMetricsModalProps {
  visible: boolean
  serverId: string
  serverName: string
  onClose: () => void
}

// Beyond this many days a bar per day gets too thin: group the bars by week.
const MAX_DAILY_BARS = 92

function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
}

function count(n: number, singular: string, plural: string): string {
  return `${n.toLocaleString("es-AR")} ${n === 1 ? singular : plural}`
}

// Daily entries, or one entry per week (7 days starting at the first one) for long periods.
function groupDays<T extends { date: string }>(days: T[]): { label: string; days: T[] }[] {
  if (days.length <= MAX_DAILY_BARS) return days.map((d) => ({ label: formatDay(d.date), days: [d] }))
  const weeks: { label: string; days: T[] }[] = []
  for (let i = 0; i < days.length; i += 7) {
    const week = days.slice(i, i + 7)
    weeks.push({ label: `Semana del ${formatDay(week[0].date)}`, days: week })
  }
  return weeks
}

function messageBars(daily: DailyMessages[]): ChartBar[] {
  return groupDays(daily).map(({ label, days }) => {
    const sent = days.reduce((sum, d) => sum + d.messagesSent, 0)
    return { label, value: sent, detail: count(sent, "mensaje", "mensajes") }
  })
}

// A week bar shows the members at the end of the week, and the joins and leaves during it.
function memberBars(daily: DailyMembers[]): ChartBar[] {
  return groupDays(daily).map(({ label, days }) => {
    const members = days[days.length - 1].members
    const joined = days.reduce((sum, d) => sum + d.joined, 0)
    const left = days.reduce((sum, d) => sum + d.left, 0)
    const changes = joined === 0 && left === 0 ? "sin altas ni bajas" : `${count(joined, "alta", "altas")} · ${count(left, "baja", "bajas")}`
    return { label, value: members, detail: `${count(members, "miembro", "miembros")} · ${changes}` }
  })
}

function StatTile({ icon, label, value, hint }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number; hint?: string }) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: "45%",
        padding: 12,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        gap: 4,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={icon} size={13} color="#8DA8AC" />
        <Text style={{ color: "#8DA8AC", fontSize: 11.5, fontWeight: "700" }}>{label}</Text>
      </View>
      <Text style={{ color: "#F2FAFA", fontSize: 24, fontWeight: "800", letterSpacing: -0.5 }}>{value.toLocaleString("es-AR")}</Text>
      {hint ? <Text style={{ color: "#5E7E82", fontSize: 11 }}>{hint}</Text> : null}
    </View>
  )
}

function MessagesChart({ daily }: { daily: DailyMessages[] }) {
  const weekly = daily.length > MAX_DAILY_BARS
  return (
    <MetricsBarChart
      title={weekly ? "Mensajes por semana" : "Mensajes por día"}
      bars={messageBars(daily)}
      startLabel={formatDay(daily[0].date)}
      endLabel={formatDay(daily[daily.length - 1].date)}
      accessibilityLabel={`Gráfico de mensajes ${weekly ? "por semana" : "por día"}`}
    />
  )
}

// Métricas HU-3: shown even when nothing happened, since the member count still means something.
function MemberGrowthChart({ growth }: { growth: MemberGrowth }) {
  const { daily, membersAtStart, membersAtEnd } = growth
  const weekly = daily.length > MAX_DAILY_BARS
  const joined = daily.reduce((sum, d) => sum + d.joined, 0)
  const left = membersLeftIn(growth)
  const change = membersAtEnd - membersAtStart
  const changeColor = change > 0 ? "#7FE6A0" : change < 0 ? "#FF9E94" : "#8DA8AC"
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Text style={{ color: "#F2FAFA", fontSize: 13, fontWeight: "700" }}>
          {membersAtStart.toLocaleString("es-AR")} → {membersAtEnd.toLocaleString("es-AR")} miembros
        </Text>
        <Text style={{ color: changeColor, fontSize: 12, fontWeight: "700" }}>
          {change > 0 ? `+${change}` : change < 0 ? `−${-change}` : "sin cambios"}
        </Text>
        <Text style={{ color: "#5E7E82", fontSize: 11.5 }}>
          {count(joined, "alta", "altas")} · {count(left, "baja", "bajas")}
        </Text>
      </View>
      <MetricsBarChart
        title={weekly ? "Miembros por semana" : "Miembros por día"}
        bars={memberBars(daily)}
        startLabel={formatDay(daily[0].date)}
        endLabel={formatDay(daily[daily.length - 1].date)}
        scale="range"
        color="#9B8CFF"
        activeColor="#CFC7FF"
        accessibilityLabel={`Gráfico de miembros ${weekly ? "por semana" : "por día"}`}
      />
    </View>
  )
}

export default function ServerMetricsModal({ visible, serverId, serverName, onClose }: ServerMetricsModalProps) {
  const [days, setDays] = useState<number>(METRICS_PERIODS[1].days)
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  // Only the answer to the latest request is shown, if the period changes fast.
  const requestRef = useRef(0)

  useEffect(() => {
    if (!visible || !serverId) return
    const request = ++requestRef.current
    const { from, to } = lastDaysPeriod(days)
    setLoading(true)
    setError("")
    getServerMetrics(serverId, from, to)
      .then((result) => {
        if (request === requestRef.current) setMetrics(result)
      })
      .catch((err) => {
        if (request !== requestRef.current) return
        setMetrics(null)
        setError(friendlyError(err))
      })
      .finally(() => {
        if (request === requestRef.current) setLoading(false)
      })
  }, [visible, serverId, days])

  useEffect(() => {
    if (!visible) {
      setMetrics(null)
      setError("")
      setDays(METRICS_PERIODS[1].days)
    }
  }, [visible])

  const periodLabel = METRICS_PERIODS.find((p) => p.days === days)?.label ?? `${days} días`

  return (
    <ModalShell visible={visible} onClose={onClose} title="Métricas del servidor" subtitle={serverName} maxWidth={520}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {METRICS_PERIODS.map((p) => {
          const selected = days === p.days
          return (
            <Pressable
              key={p.days}
              onPress={() => setDays(p.days)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`Últimos ${p.label}`}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 9999,
                backgroundColor: selected ? "rgba(63,208,201,0.16)" : "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: selected ? "rgba(63,208,201,0.55)" : "transparent",
              }}
            >
              <Text style={{ color: selected ? "#7FE6E0" : "#8DA8AC", fontSize: 12, fontWeight: "700" }}>{p.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {loading && !metrics ? (
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <ActivityIndicator color="#3FD0C9" />
        </View>
      ) : error ? (
        <View style={{ flexDirection: "row", gap: 8, padding: 12, borderRadius: 10, backgroundColor: "rgba(255,127,114,0.10)", borderWidth: 1, borderColor: "rgba(255,127,114,0.35)" }}>
          <Ionicons name="alert-circle-outline" size={16} color="#FF7F72" />
          <Text style={{ flex: 1, color: "#FF9E94", fontSize: 12.5, lineHeight: 17 }}>{error}</Text>
        </View>
      ) : metrics ? (
        <View style={{ gap: 14, opacity: loading ? 0.5 : 1 }}>
          {hasNoActivity(metrics) ? (
            <View style={{ alignItems: "center", gap: 6, paddingVertical: 28, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Ionicons name="moon-outline" size={26} color="#5E7E82" />
              <Text style={{ color: "#E6F3F3", fontSize: 14, fontWeight: "700" }}>No hubo actividad en este período</Text>
              <Text style={{ color: "#8DA8AC", fontSize: 12, lineHeight: 17, textAlign: "center" }}>
                En los últimos {periodLabel} nadie envió mensajes, se unió ni se fue del servidor. Hoy tiene{" "}
                {count(metrics.totalMembers, "miembro", "miembros")}.
              </Text>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <StatTile icon="people-outline" label="Miembros activos" value={metrics.activeMembers} hint={`de ${metrics.totalMembers.toLocaleString("es-AR")} miembros`} />
                <StatTile icon="chatbubbles-outline" label="Mensajes enviados" value={metrics.messagesSent} />
                <StatTile icon="person-add-outline" label="Nuevos miembros" value={metrics.newMembers} />
                <StatTile
                  icon="trash-outline"
                  label="Mensajes borrados"
                  value={metrics.messagesDeleted}
                  hint={metrics.messagesDeletedByModerators > 0 ? `${metrics.messagesDeletedByModerators} por moderadores` : undefined}
                />
              </View>
              <MessagesChart daily={metrics.daily} />
            </>
          )}
          <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
          <MemberGrowthChart growth={metrics.growth} />
          <Text style={{ color: "#5E7E82", fontSize: 11, lineHeight: 15 }}>
            Miembros activos: quienes enviaron al menos un mensaje en el período. Los mensajes borrados también cuentan como enviados. La
            evolución de miembros se registra desde que se activó esta función: quienes se fueron antes no aparecen.
          </Text>
        </View>
      ) : null}
    </ModalShell>
  )
}

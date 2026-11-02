import { useEffect, useState } from "react"
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from "react-native"
import type { TextStyle, ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { ApiError, friendlyError } from "@/api/client"
import { REPORT_REASONS, createReport, type ReportReason, type ReportTarget } from "@/api/reports"
import ModalShell from "./ModalShell"
import PressableScale from "./PressableScale"

interface ReportModalProps {
  target: ReportTarget | null
  onClose: () => void
}

export default function ReportModal({ target, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [detail, setDetail] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (target) {
      setReason(null)
      setDetail("")
      setError("")
      setSent(false)
    }
  }, [target])

  const send = async () => {
    if (!target || !reason) return
    setBusy(true)
    setError("")
    try {
      await createReport(target, reason, detail)
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? "Ya lo reportaste y el equipo de moderación todavía lo está revisando." : friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const title = target?.type === "server" ? "Reportar servidor" : "Reportar usuario"

  return (
    <ModalShell visible={!!target} onClose={busy ? () => undefined : onClose} title={title} subtitle={target?.name}>
      {sent ? (
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 8 }}>
          <View style={{ width: 52, height: 52, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(79,214,156,0.14)" }}>
            <Ionicons name="checkmark" size={26} color="#4FD69C" />
          </View>
          <Text style={{ color: "#E6F3F3", fontSize: 15, fontWeight: "800", textAlign: "center" }}>Gracias por avisar</Text>
          <Text style={{ color: "#8DA8AC", fontSize: 13, lineHeight: 19, textAlign: "center", marginBottom: 6 }}>
            El equipo de moderación va a revisar el reporte. Nadie más ve que lo hiciste.
          </Text>
          <PressableScale onPress={onClose} style={[PRIMARY, { alignSelf: "stretch" }]}>
            <Text style={PRIMARY_TEXT}>Listo</Text>
          </PressableScale>
        </View>
      ) : (
        <>
          {error ? (
            <View style={NOTICE_ERROR}>
              <Text style={{ color: "#FF9E94", fontSize: 12.5 }}>{error}</Text>
            </View>
          ) : null}

          <Text style={LABEL}>¿Qué está pasando?</Text>
          <View style={{ gap: 6, marginBottom: 14 }}>
            {REPORT_REASONS.map((r) => {
              const selected = reason === r.value
              return (
                <Pressable
                  key={r.value}
                  onPress={() => setReason(r.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: selected ? "#FF7F72" : "rgba(255,255,255,0.10)",
                    backgroundColor: selected ? "rgba(255,127,114,0.10)" : "rgba(255,255,255,0.04)",
                  }}
                >
                  <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={16} color={selected ? "#FF7F72" : "#5E7E82"} />
                  <Text style={{ color: "#E6F3F3", fontSize: 13.5 }}>{r.label}</Text>
                </Pressable>
              )
            })}
          </View>

          <Text style={LABEL}>Contanos más (opcional)</Text>
          <TextInput
            value={detail}
            onChangeText={setDetail}
            placeholder="Qué pasó, en qué canal, cuándo…"
            placeholderTextColor="#5E7E82"
            multiline
            maxLength={1000}
            editable={!busy}
            style={[FIELD, { minHeight: 80, textAlignVertical: "top", marginBottom: 18 }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]}
          />

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={onClose} disabled={busy} style={SECONDARY}>
              <Text style={{ color: "#8DA8AC", fontWeight: "700", fontSize: 14 }}>Cancelar</Text>
            </Pressable>
            <PressableScale onPress={send} disabled={!reason || busy} style={[PRIMARY, { flex: 1, opacity: !reason || busy ? 0.5 : 1 }]}>
              {busy ? <ActivityIndicator size="small" color="#04211D" /> : null}
              <Text style={PRIMARY_TEXT}>Enviar reporte</Text>
            </PressableScale>
          </View>
        </>
      )}
    </ModalShell>
  )
}

const LABEL: TextStyle = {
  color: "#8DA8AC",
  fontSize: 10,
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: 1.1,
  marginBottom: 6,
}

const FIELD: TextStyle = {
  width: "100%",
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 11,
  color: "#E6F3F3",
  fontSize: 14,
  backgroundColor: "rgba(255,255,255,0.06)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.10)",
}

const NOTICE_ERROR: ViewStyle = {
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderRadius: 10,
  marginBottom: 14,
  backgroundColor: "rgba(255,127,114,0.12)",
  borderWidth: 1,
  borderColor: "rgba(255,127,114,0.30)",
}

const PRIMARY: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: 10,
  paddingVertical: 12,
  backgroundColor: "#FF7F72",
}

const PRIMARY_TEXT: TextStyle = { color: "#04211D", fontWeight: "800", fontSize: 14 }

const SECONDARY: ViewStyle = {
  paddingHorizontal: 16,
  paddingVertical: 12,
  borderRadius: 10,
  backgroundColor: "rgba(255,255,255,0.06)",
  alignItems: "center",
  justifyContent: "center",
}

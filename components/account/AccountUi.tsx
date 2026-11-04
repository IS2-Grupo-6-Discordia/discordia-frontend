import type { ComponentProps, ReactNode } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"

export const CARD_BG = "#0B1822"

export type Notice = { tone: "ok" | "error"; text: string } | null

type IconName = ComponentProps<typeof Ionicons>["name"]

export function AccountScreen({
  title,
  subtitle,
  onBack,
  step,
  totalSteps,
  children,
}: {
  title: string
  subtitle?: string
  onBack: () => void
  step?: number
  totalSteps?: number
  children: ReactNode
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#0A1620" }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: "100%", maxWidth: 460, alignSelf: "center" }}>
          <TouchableOpacity
            onPress={onBack}
            accessibilityLabel="Volver"
            style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 6, paddingRight: 10 }}
          >
            <Ionicons name="chevron-back" size={18} color="#8DA8AC" />
            <Text style={{ color: "#8DA8AC", fontSize: 13, fontWeight: "600" }}>Volver</Text>
          </TouchableOpacity>

          {step && totalSteps ? (
            <View style={{ flexDirection: "row", gap: 6, marginTop: 12 }} accessibilityLabel={`Paso ${step} de ${totalSteps}`}>
              {Array.from({ length: totalSteps }, (_, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: i < step ? "#37D6C0" : "rgba(255,255,255,0.12)",
                  }}
                />
              ))}
            </View>
          ) : null}

          <Text style={{ color: "#E6F3F3", fontSize: 22, fontWeight: "800", marginTop: 14 }}>{title}</Text>
          {subtitle ? (
            <Text style={{ color: "#8DA8AC", fontSize: 13, lineHeight: 19, marginTop: 4 }}>{subtitle}</Text>
          ) : null}

          <View style={{ marginTop: 18 }}>{children}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        borderRadius: 16,
        padding: 20,
        marginBottom: 14,
        backgroundColor: CARD_BG,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
      }}
    >
      {children}
    </View>
  )
}

export function AccountRow({
  icon,
  label,
  value,
  hint,
  badge,
  actionLabel,
  onPress,
  last,
}: {
  icon: IconName
  label: string
  value: string
  hint?: string
  badge?: ReactNode
  actionLabel: string
  onPress: () => void
  last?: boolean
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${actionLabel} ${label.toLowerCase()}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: "rgba(255,255,255,0.07)",
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(55,214,192,0.12)",
        }}
      >
        <Ionicons name={icon} size={17} color="#37D6C0" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: "#8DA8AC", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>
          {label}
        </Text>
        <Text style={{ color: "#E6F3F3", fontSize: 14, fontWeight: "600", marginTop: 2 }} numberOfLines={1}>
          {value}
        </Text>
        {badge ? <View style={{ flexDirection: "row", marginTop: 4 }}>{badge}</View> : null}
        {hint ? (
          <Text style={{ color: "#5E7E82", fontSize: 11.5, marginTop: 2 }} numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        <Text style={{ color: "#37D6C0", fontSize: 13, fontWeight: "700" }}>{actionLabel}</Text>
        <Ionicons name="chevron-forward" size={15} color="#37D6C0" />
      </View>
    </TouchableOpacity>
  )
}

export function UnverifiedBadge() {
  return (
    <View
      accessibilityLabel="Email no verificado"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 9999,
        backgroundColor: "rgba(240,194,75,0.14)",
      }}
    >
      <Ionicons name="alert-circle" size={12} color="#F0C24B" />
      <Text style={{ color: "#F0C24B", fontSize: 10.5, fontWeight: "800" }}>No verificado</Text>
    </View>
  )
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  busy?: boolean
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 10,
        paddingVertical: 13,
        marginTop: 4,
        backgroundColor: disabled ? "rgba(255,255,255,0.15)" : "#37D6C0",
        opacity: busy ? 0.7 : 1,
      }}
    >
      {busy ? <ActivityIndicator size="small" color="#04211D" /> : null}
      <Text style={{ color: disabled ? "#8DA8AC" : "#04211D", fontWeight: "700", fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  )
}

export function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null
  const ok = notice.tone === "ok"
  return (
    <View
      accessibilityRole={ok ? undefined : "alert"}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        marginBottom: 14,
        backgroundColor: ok ? "rgba(79,214,156,0.10)" : "rgba(255,127,114,0.12)",
        borderWidth: 1,
        borderColor: ok ? "rgba(79,214,156,0.35)" : "rgba(255,127,114,0.30)",
      }}
    >
      <Ionicons name={ok ? "checkmark-circle" : "alert-circle"} size={15} color={ok ? "#4FD69C" : "#FF9E94"} />
      <Text style={{ flex: 1, color: ok ? "#BFEBD6" : "#FF9E94", fontSize: 12.5, lineHeight: 18 }}>{notice.text}</Text>
    </View>
  )
}

export function DoneState({
  icon,
  title,
  text,
  buttonLabel,
  onPress,
}: {
  icon: IconName
  title: string
  text: string
  buttonLabel: string
  onPress: () => void
}) {
  return (
    <Card>
      <View style={{ alignItems: "center", gap: 10, paddingVertical: 8 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 9999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(79,214,156,0.14)",
          }}
        >
          <Ionicons name={icon} size={28} color="#4FD69C" />
        </View>
        <Text style={{ color: "#E6F3F3", fontSize: 16, fontWeight: "800", textAlign: "center" }}>{title}</Text>
        <Text style={{ color: "#8DA8AC", fontSize: 13, lineHeight: 19, textAlign: "center", marginBottom: 6 }}>{text}</Text>
      </View>
      <PrimaryButton label={buttonLabel} onPress={onPress} />
    </Card>
  )
}

export function PasswordChecks({ value }: { value: string }) {
  const checks = passwordChecks(value)
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4, marginBottom: 12 }}>
      <Req met={checks.length} text="8 caracteres" />
      <Req met={checks.upper} text="Una mayúscula" />
      <Req met={checks.lower} text="Una minúscula" />
      <Req met={checks.number} text="Un número" />
    </View>
  )
}

export function passwordChecks(value: string) {
  return {
    length: value.length >= 8,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    number: /[0-9]/.test(value),
  }
}

function Req({ met, text }: { met: boolean; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Ionicons name={met ? "checkmark-circle" : "ellipse-outline"} size={12} color={met ? "#4FD69C" : "#5E7E82"} />
      <Text style={{ fontSize: 11, color: met ? "#4FD69C" : "#8DA8AC" }}>{text}</Text>
    </View>
  )
}

export function lastPasswordChange(iso: string | null | undefined): string {
  if (!iso) return "nunca"
  const date = new Date(iso)
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days <= 0) return "hoy"
  if (days === 1) return "ayer"
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { changePassword, getMe, requestEmailChange, requestRecovery, updateProfile } from "@/api/auth"
import { friendlyError } from "@/api/client"
import AuthField from "@/components/AuthField"
import { useAuth } from "@/context/AuthContext"

const CARD_BG = "#0B1822"
const NAME_MAX_LENGTH = 80

type Notice = { tone: "ok" | "error"; text: string } | null

function NoticeBox({ notice }: { notice: Notice }) {
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
        marginTop: 12,
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

function Section({ icon, title, subtitle, children }: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; subtitle: string; children: ReactNode }) {
  return (
    <View
      style={{
        width: "100%",
        maxWidth: 460,
        alignSelf: "center",
        borderRadius: 16,
        padding: 20,
        marginBottom: 14,
        backgroundColor: CARD_BG,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name={icon} size={17} color="#37D6C0" />
        <Text style={{ color: "#E6F3F3", fontSize: 15, fontWeight: "800" }}>{title}</Text>
      </View>
      <Text style={{ color: "#8DA8AC", fontSize: 12.5, lineHeight: 18, marginTop: 4, marginBottom: 14 }}>{subtitle}</Text>
      {children}
    </View>
  )
}

function PrimaryButton({ label, onPress, disabled, busy }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
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
        paddingVertical: 12,
        marginTop: 4,
        backgroundColor: "#37D6C0",
        opacity: disabled || busy ? 0.5 : 1,
      }}
    >
      {busy ? <ActivityIndicator size="small" color="#04211D" /> : null}
      <Text style={{ color: "#04211D", fontWeight: "700", fontSize: 14 }}>{label}</Text>
    </TouchableOpacity>
  )
}

function Req({ met, text }: { met: boolean; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Ionicons name={met ? "checkmark-circle" : "ellipse-outline"} size={12} color={met ? "#4FD69C" : "#5E7E82"} />
      <Text style={{ fontSize: 11, color: met ? "#4FD69C" : "#8DA8AC" }}>{text}</Text>
    </View>
  )
}

export default function AccountScreen() {
  const { user, setUser } = useAuth()
  const router = useRouter()

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace("/(main)/chat")
  }

  const [hasPassword, setHasPassword] = useState<boolean | null>(user?.hasPassword ?? null)

  const [name, setName] = useState(user?.name ?? "")
  const [nameBusy, setNameBusy] = useState(false)
  const [nameNotice, setNameNotice] = useState<Notice>(null)

  const [newEmail, setNewEmail] = useState("")
  const [emailPassword, setEmailPassword] = useState("")
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailNotice, setEmailNotice] = useState<Notice>(null)

  const [currentPw, setCurrentPw] = useState("")
  const [newPw, setNewPw] = useState("")
  const [confirmPw, setConfirmPw] = useState("")
  const [pwBusy, setPwBusy] = useState(false)
  const [pwNotice, setPwNotice] = useState<Notice>(null)

  const [linkBusy, setLinkBusy] = useState(false)
  const [linkNotice, setLinkNotice] = useState<Notice>(null)

  useEffect(() => {
    getMe()
      .then((fresh) => {
        setUser(fresh)
        setHasPassword(fresh.hasPassword ?? true)
        setName((current) => current || fresh.name)
      })
      .catch(() => setHasPassword((current) => current ?? true))
  }, [setUser])

  const trimmedName = name.trim()
  const nameChanged = !!user && trimmedName !== user.name
  const nameValid = trimmedName.length > 0 && trimmedName.length <= NAME_MAX_LENGTH

  const saveName = async () => {
    if (!nameChanged || !nameValid) return
    setNameBusy(true)
    setNameNotice(null)
    try {
      const updated = await updateProfile({ name: trimmedName })
      setUser({ ...updated, hasPassword: user?.hasPassword })
      setName(updated.name)
      setNameNotice({ tone: "ok", text: "Tu nombre se actualizó." })
    } catch (err) {
      setNameNotice({ tone: "error", text: friendlyError(err) })
    } finally {
      setNameBusy(false)
    }
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())

  const sendEmailChange = async () => {
    if (!emailValid || !emailPassword) return
    setEmailBusy(true)
    setEmailNotice(null)
    try {
      const target = newEmail.trim().toLowerCase()
      await requestEmailChange(target, emailPassword)
      setEmailNotice({
        tone: "ok",
        text: `Te mandamos un enlace a ${target}. El cambio se aplica cuando lo abras; hasta entonces seguís entrando con tu email actual.`,
      })
      setNewEmail("")
      setEmailPassword("")
    } catch (err) {
      setEmailNotice({ tone: "error", text: friendlyError(err) })
    } finally {
      setEmailBusy(false)
    }
  }

  const checks = {
    length: newPw.length >= 8,
    upper: /[A-Z]/.test(newPw),
    lower: /[a-z]/.test(newPw),
    number: /[0-9]/.test(newPw),
  }
  const pwStrong = Object.values(checks).every(Boolean)
  const pwMismatch = confirmPw.length > 0 && newPw !== confirmPw
  const canChangePw = !!currentPw && pwStrong && newPw === confirmPw

  const savePassword = async () => {
    if (!canChangePw) return
    setPwBusy(true)
    setPwNotice(null)
    try {
      await changePassword(currentPw, newPw, confirmPw)
      setCurrentPw("")
      setNewPw("")
      setConfirmPw("")
      setPwNotice({
        tone: "ok",
        text: "Tu contraseña se cambió. Cerramos las sesiones abiertas en otros dispositivos.",
      })
    } catch (err) {
      setPwNotice({ tone: "error", text: friendlyError(err) })
    } finally {
      setPwBusy(false)
    }
  }

  const sendCreatePasswordLink = async () => {
    if (!user?.email) return
    setLinkBusy(true)
    setLinkNotice(null)
    try {
      await requestRecovery(user.email)
      setLinkNotice({
        tone: "ok",
        text: `Te mandamos un enlace a ${user.email} para crear tu contraseña.`,
      })
    } catch (err) {
      setLinkNotice({ tone: "error", text: friendlyError(err) })
    } finally {
      setLinkBusy(false)
    }
  }

  const googleOnly = hasPassword === false

  const createPasswordBlock = (
    <>
      <Text style={{ color: "#C9DADC", fontSize: 12.5, lineHeight: 18, marginBottom: 12 }}>
        Tu cuenta entra con Google y todavía no tiene contraseña. Creá una desde un enlace que te
        mandamos por email y después vas a poder cambiar tu email y tu contraseña desde acá.
      </Text>
      <PrimaryButton label="Enviarme el enlace" onPress={sendCreatePasswordLink} busy={linkBusy} />
      <NoticeBox notice={linkNotice} />
    </>
  )

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#0A1620" }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: "100%", maxWidth: 460, alignSelf: "center", marginBottom: 12 }}>
          <TouchableOpacity
            onPress={goBack}
            accessibilityLabel="Volver"
            style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 6, paddingRight: 10 }}
          >
            <Ionicons name="chevron-back" size={18} color="#8DA8AC" />
            <Text style={{ color: "#8DA8AC", fontSize: 13, fontWeight: "600" }}>Volver</Text>
          </TouchableOpacity>
          <Text style={{ color: "#E6F3F3", fontSize: 22, fontWeight: "800", marginTop: 8 }}>Mi cuenta</Text>
          <Text style={{ color: "#8DA8AC", fontSize: 13, marginTop: 2 }}>Tus datos de acceso a Discordia.</Text>
        </View>

        <Section icon="person-outline" title="Nombre" subtitle="Es como te ven los demás en los servidores y mensajes.">
          <AuthField
            label="Nombre"
            value={name}
            onChangeText={(value) => {
              setName(value)
              setNameNotice(null)
            }}
            maxLength={NAME_MAX_LENGTH}
            containerStyle={{ marginBottom: 12 }}
          />
          <PrimaryButton label="Guardar nombre" onPress={saveName} disabled={!nameChanged || !nameValid} busy={nameBusy} />
          <NoticeBox notice={nameNotice} />
        </Section>

        <Section
          icon="mail-outline"
          title="Email"
          subtitle="Lo usás para iniciar sesión y para recibir avisos de tu cuenta."
        >
          <Text style={{ color: "#8DA8AC", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 6 }}>
            Email actual
          </Text>
          <Text style={{ color: "#E6F3F3", fontSize: 14, fontWeight: "600", marginBottom: 14 }} selectable>
            {user?.email ?? ""}
          </Text>
          {googleOnly ? (
            createPasswordBlock
          ) : (
            <>
              <AuthField
                label="Nuevo email"
                value={newEmail}
                onChangeText={(value) => {
                  setNewEmail(value)
                  setEmailNotice(null)
                }}
                placeholder="vos@ejemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                containerStyle={{ marginBottom: 12 }}
              />
              <AuthField
                label="Contraseña actual"
                value={emailPassword}
                onChangeText={setEmailPassword}
                secureTextEntry
                containerStyle={{ marginBottom: 12 }}
              />
              <Text style={{ color: "#8DA8AC", fontSize: 11.5, lineHeight: 16, marginBottom: 12 }}>
                Te vamos a mandar un enlace al nuevo email para confirmar que es tuyo.
              </Text>
              <PrimaryButton
                label="Enviar enlace de confirmación"
                onPress={sendEmailChange}
                disabled={!emailValid || !emailPassword}
                busy={emailBusy}
              />
              <NoticeBox notice={emailNotice} />
            </>
          )}
        </Section>

        <Section
          icon="lock-closed-outline"
          title="Contraseña"
          subtitle="Al cambiarla cerramos las sesiones abiertas en otros dispositivos."
        >
          {googleOnly ? (
            <Text style={{ color: "#C9DADC", fontSize: 12.5, lineHeight: 18 }}>
              Tu cuenta todavía no tiene contraseña. Creala con el enlace de la sección Email.
            </Text>
          ) : (
            <>
              <AuthField
                label="Contraseña actual"
                value={currentPw}
                onChangeText={(value) => {
                  setCurrentPw(value)
                  setPwNotice(null)
                }}
                secureTextEntry
                containerStyle={{ marginBottom: 12 }}
              />
              <AuthField
                label="Nueva contraseña"
                value={newPw}
                onChangeText={(value) => {
                  setNewPw(value)
                  setPwNotice(null)
                }}
                placeholder="Mínimo 8 caracteres"
                secureTextEntry
                containerStyle={{ marginBottom: 8 }}
              />
              {newPw.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4, marginBottom: 12 }}>
                  <Req met={checks.length} text="8 caracteres" />
                  <Req met={checks.upper} text="Una mayúscula" />
                  <Req met={checks.lower} text="Una minúscula" />
                  <Req met={checks.number} text="Un número" />
                </View>
              ) : null}
              <AuthField
                label="Repetir nueva contraseña"
                value={confirmPw}
                onChangeText={setConfirmPw}
                secureTextEntry
                error={pwMismatch}
                containerStyle={{ marginBottom: pwMismatch ? 6 : 12 }}
              />
              {pwMismatch ? (
                <Text style={{ color: "#FF9E94", fontSize: 11.5, marginBottom: 10 }}>Las contraseñas no coinciden.</Text>
              ) : null}
              <PrimaryButton label="Cambiar contraseña" onPress={savePassword} disabled={!canChangePw} busy={pwBusy} />
              <NoticeBox notice={pwNotice} />
            </>
          )}
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

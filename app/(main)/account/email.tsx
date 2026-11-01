import { useState } from "react"
import { Text } from "react-native"
import { useRouter } from "expo-router"
import { requestEmailChange } from "@/api/auth"
import { ApiError, friendlyError } from "@/api/client"
import AuthField from "@/components/AuthField"
import { AccountScreen, Card, DoneState, NoticeBox, PrimaryButton } from "@/components/account/AccountUi"
import type { Notice } from "@/components/account/AccountUi"
import CreatePasswordStep from "@/components/account/CreatePasswordStep"
import { useAuth } from "@/context/AuthContext"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ChangeEmail() {
  const { user } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [newEmail, setNewEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const exit = () => (router.canGoBack() ? router.back() : router.replace("/(main)/account"))
  const back = () => {
    setNotice(null)
    if (step === 2) setStep(1)
    else exit()
  }

  if (user?.hasPassword === false) {
    return (
      <AccountScreen title="Cambiar email" onBack={exit}>
        <CreatePasswordStep reason="Para cambiar el email primero necesitás una contraseña." />
      </AccountScreen>
    )
  }

  const target = newEmail.trim().toLowerCase()
  const emailOk = EMAIL_RE.test(target) && target !== user?.email

  const toPassword = () => {
    if (!emailOk) return
    setNotice(null)
    setStep(2)
  }

  const send = async () => {
    if (!password) return
    setBusy(true)
    setNotice(null)
    try {
      await requestEmailChange(target, password)
      setPassword("")
      setStep(3)
    } catch (err) {
      const message = friendlyError(err)
      if (err instanceof ApiError && (err.status === 409 || (err.status === 400 && message.includes("email")))) {
        setStep(1)
      }
      setNotice({ tone: "error", text: message })
    } finally {
      setBusy(false)
    }
  }

  if (step === 3) {
    return (
      <AccountScreen title="Cambiar email" step={3} totalSteps={3} onBack={exit}>
        <DoneState
          icon="mail-unread-outline"
          title="Revisá tu nuevo email"
          text={`Te mandamos un enlace a ${target}. El cambio se aplica cuando lo abras; hasta entonces seguís entrando con ${user?.email ?? "tu email actual"}.`}
          buttonLabel="Volver a Mi cuenta"
          onPress={exit}
        />
      </AccountScreen>
    )
  }

  return (
    <AccountScreen
      title="Cambiar email"
      subtitle={step === 1 ? "¿Qué email querés usar a partir de ahora?" : "Confirmá que sos vos con tu contraseña."}
      step={step}
      totalSteps={3}
      onBack={back}
    >
      <Card>
        <NoticeBox notice={notice} />
        {step === 1 ? (
          <>
            <Text style={{ color: "#8DA8AC", fontSize: 12.5, marginBottom: 12 }}>Email actual: {user?.email}</Text>
            <AuthField
              label="Nuevo email"
              value={newEmail}
              onChangeText={(value) => {
                setNewEmail(value)
                setNotice(null)
              }}
              placeholder="vos@ejemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              onSubmitEditing={toPassword}
              containerStyle={{ marginBottom: 14 }}
            />
            <PrimaryButton label="Continuar" onPress={toPassword} disabled={!emailOk} />
          </>
        ) : (
          <>
            <Text style={{ color: "#8DA8AC", fontSize: 12.5, lineHeight: 18, marginBottom: 12 }}>
              Vamos a mandar un enlace a {target} para confirmar que es tuyo.
            </Text>
            <AuthField
              label="Contraseña actual"
              value={password}
              onChangeText={(value) => {
                setPassword(value)
                setNotice(null)
              }}
              secureTextEntry
              autoFocus
              onSubmitEditing={send}
              containerStyle={{ marginBottom: 14 }}
            />
            <PrimaryButton label="Enviar enlace" onPress={send} disabled={!password} busy={busy} />
          </>
        )}
      </Card>
    </AccountScreen>
  )
}

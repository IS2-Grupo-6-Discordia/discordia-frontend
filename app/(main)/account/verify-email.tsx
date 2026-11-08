import { useEffect, useState } from "react"
import { Text, TouchableOpacity, View } from "react-native"
import { useRouter } from "expo-router"
import { confirmEmailVerification, requestEmailVerification } from "@/lib/api/auth"
import { ApiError, friendlyError } from "@/lib/api/client"
import AuthField from "@/components/AuthField"
import { AccountScreen, Card, DoneState, NoticeBox, PrimaryButton } from "@/components/account/AccountUi"
import type { Notice } from "@/components/account/AccountUi"
import { useAuth } from "@/context/AuthContext"

const RESEND_SECONDS = 60

export default function VerifyEmail() {
  const { user, setUser } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(user?.emailVerified ? 3 : 1)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [resendIn, setResendIn] = useState(0)

  const exit = () => (router.canGoBack() ? router.back() : router.replace("/(main)/account"))

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  const send = async () => {
    setBusy(true)
    setNotice(null)
    try {
      await requestEmailVerification()
      setStep(2)
      setResendIn(RESEND_SECONDS)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        if (user) setUser({ ...user, emailVerified: true })
        setStep(3)
      } else if (err instanceof ApiError && err.status === 429 && step === 1) {
        setStep(2)
        setNotice({ tone: "ok", text: "Ya te mandamos un código hace instantes. Revisá tu email." })
      } else {
        setNotice({ tone: "error", text: friendlyError(err) })
      }
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    await send()
    setCode("")
  }

  const confirm = async () => {
    if (code.length !== 6 || busy) return
    setBusy(true)
    setNotice(null)
    try {
      setUser(await confirmEmailVerification(code))
      setStep(3)
    } catch (err) {
      setCode("")
      setNotice({ tone: "error", text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  if (step === 3) {
    return (
      <AccountScreen title="Verificar email" onBack={exit}>
        <DoneState
          icon="checkmark-circle-outline"
          title="Email verificado"
          text={`${user?.email ?? "Tu email"} quedó verificado.`}
          buttonLabel="Volver a Mi cuenta"
          onPress={exit}
        />
      </AccountScreen>
    )
  }

  if (step === 2) {
    return (
      <AccountScreen
        title="Verificar email"
        subtitle={`Te mandamos un código de 6 dígitos a ${user?.email ?? "tu email"}.`}
        step={2}
        totalSteps={2}
        onBack={() => {
          setNotice(null)
          setCode("")
          setStep(1)
        }}
      >
        <Card>
          <NoticeBox notice={notice} />
          <AuthField
            label="Código"
            value={code}
            onChangeText={(value) => {
              setCode(value.replace(/\D/g, "").slice(0, 6))
              setNotice(null)
            }}
            placeholder="000000"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            onSubmitEditing={confirm}
            style={{ fontSize: 22, letterSpacing: 8, textAlign: "center", fontWeight: "700" }}
            containerStyle={{ marginBottom: 14 }}
          />
          <PrimaryButton label="Verificar" onPress={confirm} disabled={code.length !== 6} busy={busy} />
          <View style={{ alignItems: "center", marginTop: 14 }}>
            <TouchableOpacity onPress={resend} disabled={resendIn > 0 || busy}>
              <Text style={{ color: resendIn > 0 ? "#5E7E82" : "#37D6C0", fontWeight: "600", fontSize: 12.5 }}>
                {resendIn > 0 ? `Reenviar en ${resendIn}s` : "Reenviar código"}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      </AccountScreen>
    )
  }

  return (
    <AccountScreen title="Verificar email" subtitle="Confirmá que este email es tuyo." step={1} totalSteps={2} onBack={exit}>
      <Card>
        <NoticeBox notice={notice} />
        <Text style={{ color: "#8DA8AC", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>Email</Text>
        <Text style={{ color: "#E6F3F3", fontSize: 15, fontWeight: "700", marginTop: 4, marginBottom: 6 }}>{user?.email}</Text>
        <Text style={{ color: "#8DA8AC", fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
          Te vamos a mandar un código de 6 dígitos. Si este no es tu email, cambialo desde Mi cuenta.
        </Text>
        <PrimaryButton label="Enviar código" onPress={send} busy={busy} />
      </Card>
    </AccountScreen>
  )
}

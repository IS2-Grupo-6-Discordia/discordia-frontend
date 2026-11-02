import { useState } from "react"
import { Text } from "react-native"
import { useRouter } from "expo-router"
import { changePassword, checkCurrentPassword } from "@/api/auth"
import { ApiError, friendlyError } from "@/api/client"
import AuthField from "@/components/AuthField"
import {
  AccountScreen,
  Card,
  DoneState,
  NoticeBox,
  PasswordChecks,
  PrimaryButton,
  lastPasswordChange,
  passwordChecks,
} from "@/components/account/AccountUi"
import type { Notice } from "@/components/account/AccountUi"
import CreatePasswordStep from "@/components/account/CreatePasswordStep"
import { useAuth } from "@/context/AuthContext"

export default function ChangePassword() {
  const { user, setUser } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
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
      <AccountScreen title="Crear contraseña" onBack={exit}>
        <CreatePasswordStep reason="Tu cuenta entra con Google y todavía no tiene contraseña." />
      </AccountScreen>
    )
  }

  const strong = Object.values(passwordChecks(next)).every(Boolean)
  const mismatch = confirm.length > 0 && next !== confirm
  const canSave = strong && next === confirm

  const toNew = async () => {
    if (!current || busy) return
    setBusy(true)
    setNotice(null)
    try {
      await checkCurrentPassword(current)
      setStep(2)
    } catch (err) {
      setCurrent("")
      setNotice({ tone: "error", text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!canSave) return
    setBusy(true)
    setNotice(null)
    try {
      await changePassword(current, next, confirm)
      if (user) setUser({ ...user, passwordChangedAt: new Date().toISOString() })
      setCurrent("")
      setNext("")
      setConfirm("")
      setStep(3)
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setCurrent("")
        setStep(1)
      }
      setNotice({ tone: "error", text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  if (step === 3) {
    return (
      <AccountScreen title="Cambiar contraseña" step={3} totalSteps={3} onBack={exit}>
        <DoneState
          icon="shield-checkmark-outline"
          title="Contraseña cambiada"
          text="Cerramos las sesiones abiertas en otros dispositivos. Te mandamos un mail de aviso."
          buttonLabel="Volver a Mi cuenta"
          onPress={exit}
        />
      </AccountScreen>
    )
  }

  return (
    <AccountScreen
      title="Cambiar contraseña"
      subtitle={
        step === 1
          ? `Último cambio: ${lastPasswordChange(user?.passwordChangedAt)}. Primero confirmá que sos vos.`
          : "Elegí tu nueva contraseña."
      }
      step={step}
      totalSteps={3}
      onBack={back}
    >
      <Card>
        <NoticeBox notice={notice} />
        {step === 1 ? (
          <>
            <AuthField
              label="Contraseña actual"
              value={current}
              onChangeText={(value) => {
                setCurrent(value)
                setNotice(null)
              }}
              secureTextEntry
              autoFocus
              onSubmitEditing={toNew}
              containerStyle={{ marginBottom: 14 }}
            />
            <PrimaryButton label="Continuar" onPress={toNew} disabled={!current} busy={busy} />
          </>
        ) : (
          <>
            <AuthField
              label="Nueva contraseña"
              value={next}
              onChangeText={(value) => {
                setNext(value)
                setNotice(null)
              }}
              placeholder="Mínimo 8 caracteres"
              secureTextEntry
              autoFocus
              containerStyle={{ marginBottom: 8 }}
            />
            {next.length > 0 ? <PasswordChecks value={next} /> : null}
            <AuthField
              label="Repetir nueva contraseña"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              error={mismatch}
              onSubmitEditing={save}
              containerStyle={{ marginBottom: mismatch ? 6 : 14 }}
            />
            {mismatch ? (
              <Text style={{ color: "#FF9E94", fontSize: 11.5, marginBottom: 10 }}>Las contraseñas no coinciden.</Text>
            ) : null}
            <PrimaryButton label="Cambiar contraseña" onPress={save} disabled={!canSave} busy={busy} />
          </>
        )}
      </Card>
    </AccountScreen>
  )
}

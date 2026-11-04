import { useState } from "react"
import { Text } from "react-native"
import { requestRecovery } from "@/lib/api/auth"
import { friendlyError } from "@/lib/api/client"
import { Card, DoneState, NoticeBox, PrimaryButton } from "@/components/account/AccountUi"
import type { Notice } from "@/components/account/AccountUi"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "expo-router"

export default function CreatePasswordStep({ reason }: { reason: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const exit = () => (router.canGoBack() ? router.back() : router.replace("/(main)/account"))

  const send = async () => {
    if (!user?.email) return
    setBusy(true)
    setNotice(null)
    try {
      await requestRecovery(user.email)
      setSent(true)
    } catch (err) {
      setNotice({ tone: "error", text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <DoneState
        icon="mail-unread-outline"
        title="Revisá tu email"
        text={`Te mandamos un enlace a ${user?.email ?? "tu email"} para crear tu contraseña.`}
        buttonLabel="Volver a Mi cuenta"
        onPress={exit}
      />
    )
  }

  return (
    <Card>
      <NoticeBox notice={notice} />
      <Text style={{ color: "#C9DADC", fontSize: 13, lineHeight: 19, marginBottom: 14 }}>
        {reason} Te mandamos un enlace a {user?.email} para crear una.
      </Text>
      <PrimaryButton label="Enviarme el enlace" onPress={send} busy={busy} />
    </Card>
  )
}

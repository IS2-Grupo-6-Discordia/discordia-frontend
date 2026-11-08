import { useState } from "react"
import { useRouter } from "expo-router"
import { updateProfile } from "@/lib/api/auth"
import { friendlyError } from "@/lib/api/client"
import AuthField from "@/components/AuthField"
import { AccountScreen, Card, NoticeBox, PrimaryButton } from "@/components/account/AccountUi"
import type { Notice } from "@/components/account/AccountUi"
import { useAuth } from "@/context/AuthContext"

const NAME_MAX_LENGTH = 80

export default function ChangeName() {
  const { user, setUser } = useAuth()
  const router = useRouter()
  const [name, setName] = useState(user?.name ?? "")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(main)/account"))
  const trimmed = name.trim()
  const canSave = !!user && trimmed.length > 0 && trimmed.length <= NAME_MAX_LENGTH && trimmed !== user.name

  const save = async () => {
    if (!canSave) return
    setBusy(true)
    setNotice(null)
    try {
      const updated = await updateProfile({ name: trimmed })
      setUser({ ...updated, hasPassword: user?.hasPassword })
      back()
    } catch (err) {
      setNotice({ tone: "error", text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AccountScreen title="Cambiar nombre" subtitle="Es como te ven los demás en los servidores y mensajes." onBack={back}>
      <Card>
        <NoticeBox notice={notice} />
        <AuthField
          label="Nombre"
          value={name}
          onChangeText={(value) => {
            setName(value)
            setNotice(null)
          }}
          maxLength={NAME_MAX_LENGTH}
          autoFocus
          onSubmitEditing={save}
          containerStyle={{ marginBottom: 14 }}
        />
        <PrimaryButton label="Guardar" onPress={save} disabled={!canSave} busy={busy} />
      </Card>
    </AccountScreen>
  )
}

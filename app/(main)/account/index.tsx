import { useCallback, useEffect, useState } from "react"
import { useFocusEffect, useRouter } from "expo-router"
import { getGoogleLink, getMe, type GoogleLink } from "@/lib/api/auth"
import { AccountRow, AccountScreen, Card, UnverifiedBadge, lastPasswordChange } from "@/components/account/AccountUi"
import { useAuth } from "@/context/AuthContext"

export default function AccountHome() {
  const { user, setUser } = useAuth()
  const router = useRouter()
  const [google, setGoogle] = useState<GoogleLink | null>(null)

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => undefined)
  }, [setUser])

  useFocusEffect(
    useCallback(() => {
      getGoogleLink()
        .then(setGoogle)
        .catch(() => undefined)
    }, []),
  )

  const googleOnly = user?.hasPassword === false

  return (
    <AccountScreen
      title="Mi cuenta"
      subtitle="Tus datos de acceso a Discordia. Tocá Cambiar en el dato que quieras modificar."
      onBack={() => (router.canGoBack() ? router.back() : router.replace("/(main)/chat"))}
    >
      <Card>
        <AccountRow
          icon="person-outline"
          label="Nombre"
          value={user?.name ?? ""}
          actionLabel="Cambiar"
          onPress={() => router.push("/(main)/account/name")}
        />
        <AccountRow
          icon="mail-outline"
          label="Email"
          value={user?.email ?? ""}
          footer={
            user?.emailVerified === false ? <UnverifiedBadge onVerify={() => router.push("/(main)/account/verify-email")} /> : undefined
          }
          actionLabel="Cambiar"
          onPress={() => router.push("/(main)/account/email")}
        />
        <AccountRow
          icon="lock-closed-outline"
          label="Contraseña"
          value={googleOnly ? "Sin contraseña (entrás con Google)" : "••••••••"}
          hint={googleOnly ? undefined : `Último cambio: ${lastPasswordChange(user?.passwordChangedAt)}`}
          actionLabel={googleOnly ? "Crear" : "Cambiar"}
          onPress={() => router.push("/(main)/account/password")}
        />
        <AccountRow
          icon="shield-checkmark-outline"
          label="Verificación en dos pasos"
          value={user?.twoFactorEnabled ? "Activada" : "Desactivada"}
          hint={user?.twoFactorEnabled ? undefined : "Protegé tu cuenta con un código de tu celular"}
          actionLabel={user?.twoFactorEnabled ? "Administrar" : "Activar"}
          onPress={() => router.push("/(main)/account/two-factor")}
        />
        <AccountRow
          icon="logo-google"
          label="Google"
          value={!google ? "…" : google.linked ? (google.email ?? "Vinculada") : "No vinculada"}
          hint={google && !google.linked ? "Entrá a Discordia con tu cuenta de Google" : undefined}
          actionLabel={google?.linked ? "Administrar" : "Vincular"}
          onPress={() => router.push("/(main)/account/google")}
          last
        />
      </Card>
    </AccountScreen>
  )
}

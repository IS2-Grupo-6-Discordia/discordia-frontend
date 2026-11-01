import { useEffect } from "react"
import { useRouter } from "expo-router"
import { getMe } from "@/api/auth"
import { AccountRow, AccountScreen, Card, lastPasswordChange } from "@/components/account/AccountUi"
import { useAuth } from "@/context/AuthContext"

export default function AccountHome() {
  const { user, setUser } = useAuth()
  const router = useRouter()

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => undefined)
  }, [setUser])

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
          last
        />
      </Card>
    </AccountScreen>
  )
}

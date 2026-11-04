import { api, apiUpload, ApiError, getRefreshToken, setRefreshToken, setToken } from "./client"
import { File as NativeFile } from "expo-file-system"
import type { AuthResponse, PresenceStatus, PublicUser, User, UserStatus } from "./types"

const USE_MOCK = !process.env.EXPO_PUBLIC_API_URL

function mockDelay(ms = 800) {
  return new Promise((r) => setTimeout(r, ms))
}

const MOCK_USER = {
  id: "4",
  name: "Facundo",
  email: "facundo@ejemplo.com",
  avatar: "FA",
}

interface BackendUser {
  id: string
  name: string
  email: string
  bio?: string | null
  avatar_url?: string | null
  status?: UserStatus
  created_at?: string
  has_password?: boolean
  email_verified?: boolean
  password_changed_at?: string | null
  two_factor_enabled?: boolean
}

export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
  return letters || "?"
}

function toUser(backendUser: BackendUser): User {
  return {
    id: backendUser.id,
    name: backendUser.name,
    email: backendUser.email,
    bio: backendUser.bio ?? null,
    avatar: initials(backendUser.name),
    avatarUrl: backendUser.avatar_url ?? null,
    status: backendUser.status ?? "online",
    createdAt: backendUser.created_at,
    hasPassword: backendUser.has_password,
    emailVerified: backendUser.email_verified,
    passwordChangedAt: backendUser.password_changed_at ?? null,
    twoFactorEnabled: backendUser.two_factor_enabled ?? false,
  }
}

// Only the public fields the backend exposes for other users. No email, no
// created_at: this shape is intentionally narrower than BackendUser.
interface BackendPublicUser {
  id: string
  name: string
  bio?: string | null
  avatar_url?: string | null
  status?: PresenceStatus
}

function toPublicUser(backendUser: BackendPublicUser): PublicUser {
  return {
    id: backendUser.id,
    name: backendUser.name,
    bio: backendUser.bio ?? null,
    avatarUrl: backendUser.avatar_url ?? null,
    status: backendUser.status ?? "offline",
  }
}

interface LoginApiResponse {
  user: BackendUser
  access_token: string
  refresh_token: string
  token_type: string
}

interface TwoFactorChallengeApiResponse {
  two_factor_required: true
  challenge_token: string
  method: "password" | "google"
}

export class TwoFactorRequired extends Error {
  challengeToken: string
  method: "password" | "google"

  constructor(challengeToken: string, method: "password" | "google") {
    super("two_factor_required")
    this.challengeToken = challengeToken
    this.method = method
  }
}

async function finishLogin(res: LoginApiResponse | TwoFactorChallengeApiResponse): Promise<AuthResponse> {
  if ("two_factor_required" in res) throw new TwoFactorRequired(res.challenge_token, res.method)
  await setToken(res.access_token)
  await setRefreshToken(res.refresh_token)
  return { token: res.access_token, user: toUser(res.user) }
}

export interface TwoFactorLoginResult extends AuthResponse {
  recoveryCodeUsed: boolean
  recoveryCodesRemaining: number
}

export async function completeTwoFactorLogin(
  challengeToken: string,
  secondFactor: { code: string } | { recoveryCode: string },
): Promise<TwoFactorLoginResult> {
  const res = await api<LoginApiResponse & { recovery_code_used: boolean; recovery_codes_remaining: number }>("/auth/login/2fa", {
    method: "POST",
    body: JSON.stringify({
      challenge_token: challengeToken,
      ...("code" in secondFactor ? { code: secondFactor.code } : { recovery_code: secondFactor.recoveryCode }),
    }),
  })
  await setToken(res.access_token)
  await setRefreshToken(res.refresh_token)
  return {
    token: res.access_token,
    user: toUser(res.user),
    recoveryCodeUsed: res.recovery_code_used,
    recoveryCodesRemaining: res.recovery_codes_remaining,
  }
}

export interface TwoFactorStatus {
  enabled: boolean
  enabledAt: string | null
  recoveryCodesRemaining: number
}

export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  const res = await api<{ enabled: boolean; enabled_at: string | null; recovery_codes_remaining: number }>("/auth/users/me/2fa")
  return { enabled: res.enabled, enabledAt: res.enabled_at, recoveryCodesRemaining: res.recovery_codes_remaining }
}

export async function startTwoFactorSetup(): Promise<{ secret: string; otpauthUri: string }> {
  const res = await api<{ secret: string; otpauth_uri: string }>("/auth/users/me/2fa/setup", { method: "POST" })
  return { secret: res.secret, otpauthUri: res.otpauth_uri }
}

export async function enableTwoFactor(code: string): Promise<string[]> {
  const res = await api<{ recovery_codes: string[] }>("/auth/users/me/2fa/enable", {
    method: "POST",
    body: JSON.stringify({ code }),
  })
  return res.recovery_codes
}

export async function disableTwoFactor(proof: { password?: string; code?: string }): Promise<void> {
  await api("/auth/users/me/2fa/disable", { method: "POST", body: JSON.stringify(proof) })
}

export async function regenerateRecoveryCodes(proof: { password?: string; code?: string }): Promise<string[]> {
  const res = await api<{ recovery_codes: string[] }>("/auth/users/me/2fa/recovery-codes", {
    method: "POST",
    body: JSON.stringify(proof),
  })
  return res.recovery_codes
}

interface RegisterApiResponse {
  user: BackendUser
  access_token: string
  refresh_token?: string
  token_type: string
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  if (USE_MOCK) {
    await mockDelay(1400)
    if (password === "error") {
      // Mirror the real backend's 401 shape so friendlyError surfaces the same message in mock mode.
      const detail = "El correo electrónico o la contraseña son incorrectos."
      throw new ApiError(401, detail, detail)
    }
    const token = "mock-jwt-token-" + Date.now()
    await setToken(token)
    return { token, user: MOCK_USER }
  }

  const res = await api<LoginApiResponse | TwoFactorChallengeApiResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  })
  return finishLogin(res)
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  const res = await api<LoginApiResponse | TwoFactorChallengeApiResponse>("/auth/oauth/google", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
  })
  return finishLogin(res)
}

export interface GoogleLink {
  linked: boolean
  email: string | null
  linkedAt: string | null
  canUnlink: boolean
}

interface GoogleLinkApiResponse {
  linked: boolean
  email: string | null
  linked_at: string | null
  can_unlink: boolean
}

function toGoogleLink(res: GoogleLinkApiResponse): GoogleLink {
  return { linked: res.linked, email: res.email, linkedAt: res.linked_at, canUnlink: res.can_unlink }
}

export async function getGoogleLink(): Promise<GoogleLink> {
  return toGoogleLink(await api<GoogleLinkApiResponse>("/auth/users/me/google"))
}

export async function linkGoogle(idToken: string, password: string | null): Promise<GoogleLink> {
  return toGoogleLink(
    await api<GoogleLinkApiResponse>("/auth/users/me/google", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken, password }),
    }),
  )
}

export async function unlinkGoogle(): Promise<GoogleLink> {
  return toGoogleLink(await api<GoogleLinkApiResponse>("/auth/users/me/google", { method: "DELETE" }))
}

export async function requestRegistrationCode(name: string, email: string, password: string): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(600)
    return
  }
  try {
    await api("/auth/users/verification-code", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      throw new Error("EMAIL_DUPLICADO")
    }
    throw err
  }
}

export async function register(
  name: string,
  email: string,
  password: string,
  code?: string,
): Promise<AuthResponse> {
  if (USE_MOCK) {
    await mockDelay(1200)
    if (email === "duplicado@ejemplo.com") {
      throw new Error("EMAIL_DUPLICADO")
    }
    const token = "mock-jwt-token-" + Date.now()
    await setToken(token)
    return { token, user: { ...MOCK_USER, name, email } }
  }

  try {
    const res = await api<RegisterApiResponse>("/auth/users", {
      method: "POST",
      body: JSON.stringify({ name, email, password, code }),
    })
    await setToken(res.access_token)
    await setRefreshToken(res.refresh_token ?? null)
    return { token: res.access_token, user: toUser(res.user) }
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      throw new Error("EMAIL_DUPLICADO")
    }
    throw err
  }
}

export async function requestRecovery(email: string): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(1000)
    return
  }

  await api("/auth/password-reset/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function confirmPasswordReset(
  token: string,
  newPassword: string,
  confirmPassword: string,
): Promise<void> {
  if (USE_MOCK) {
    await mockDelay(1000)
    if (newPassword !== confirmPassword) {
      throw new Error("Las contraseñas no coinciden.")
    }
    return
  }

  await api("/auth/password-reset/confirm", {
    method: "POST",
    body: JSON.stringify({
      token,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  })
}

export async function logout() {
  if (!USE_MOCK) {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      await api("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => undefined)
    }
  }
  await setToken(null)
  await setRefreshToken(null)
}


export async function updateProfile(updates: {
  name?: string
  bio?: string | null
  status?: UserStatus
}): Promise<User> {
  if (USE_MOCK) {
    await mockDelay(600)
    return { ...MOCK_USER, bio: null, ...updates }
  }

  const res = await api<BackendUser>("/auth/users/me", {
    method: "PATCH",
    body: JSON.stringify(updates),
  })
  return toUser(res)
}

export async function sendPresence(opts: { active: boolean; leaving?: boolean }): Promise<void> {
  if (USE_MOCK) return
  await api("/auth/users/me/presence", {
    method: "POST",
    body: JSON.stringify({ active: opts.active, leaving: !!opts.leaving }),
    keepalive: !!opts.leaving,
  })
}

export async function getMe(): Promise<User> {
  if (USE_MOCK) {
    await mockDelay(500)
    return {
      id: MOCK_USER.id,
      name: MOCK_USER.name,
      email: MOCK_USER.email,
      bio: null,
      avatar: MOCK_USER.avatar,
      avatarUrl: null,
    }
  }

  const res = await api<BackendUser>("/auth/users/me")
  return toUser(res)
}

// Fetches another user's PUBLIC profile by id. Mirrors getMe()'s request style,
// but hits the per-user route and maps only the public fields. The backend (via
// the gateway) returns 404 when the id doesn't exist.
export async function getUserById(id: string): Promise<PublicUser> {
  if (USE_MOCK) {
    await mockDelay(500)
    // There's no mock store of other users' public profiles, so any lookup
    // resolves as "not found" -> the same 404 the real backend returns for a
    // missing id. The screen renders its empty state instead of fake data.
    const detail = "Este perfil no está disponible."
    throw new ApiError(404, detail, detail)
  }

  const res = await api<BackendPublicUser>(`/auth/users/${id}`)
  return toPublicUser(res)
}

// Fetches PUBLIC profiles for several users in one request. Used to hydrate names
// and avatars for lists that only carry user ids -- e.g. a server's member roster,
// where the servers service only stores ids and roles. Order is not guaranteed, so
// callers should match results back to their ids.
export async function getUsersBatch(ids: string[]): Promise<PublicUser[]> {
  if (ids.length === 0) return []
  if (USE_MOCK) {
    await mockDelay(300)
    return []
  }

  const res = await api<{ users: BackendPublicUser[] }>("/auth/users/batch", {
    method: "POST",
    body: JSON.stringify({ user_ids: ids }),
  })
  return res.users.map(toPublicUser)
}

// Accepts a native file descriptor ({uri,name,type}) or, on web, a real Blob.
// On web, appending a {uri,name,type} object to FormData does NOT upload the
// binary, so the screen converts the picked asset to a Blob before calling.
export async function updateAvatar(
  file: Blob | { uri: string; name: string; type: string },
): Promise<User> {
  if (USE_MOCK) {
    await mockDelay(800)
    const uri = file instanceof Blob ? undefined : file.uri
    return {
      id: MOCK_USER.id,
      name: MOCK_USER.name,
      email: MOCK_USER.email,
      bio: null,
      avatar: MOCK_USER.avatar,
      avatarUrl: uri ?? null,
    }
  }

  const fd = new FormData()
  if (file instanceof Blob) {
    fd.append("file", file, "avatar")
  } else {
    fd.append("file", new NativeFile(file.uri) as any)
  }
  const res = await apiUpload<BackendUser>("/auth/users/me/avatar", fd)
  return toUser(res)
}

export async function requestEmailVerification(): Promise<void> {
  await api("/auth/users/me/email/verification", { method: "POST" })
}

export async function confirmEmailVerification(code: string): Promise<User> {
  const res = await api<BackendUser>("/auth/users/me/email/verification/confirm", {
    method: "POST",
    body: JSON.stringify({ code }),
  })
  return toUser(res)
}

export async function checkCurrentPassword(currentPassword: string): Promise<void> {
  await api("/auth/users/me/password/check", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword }),
  })
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<void> {
  const res = await api<{ access_token: string; refresh_token: string }>("/auth/users/me/password", {
    method: "POST",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  })
  await setToken(res.access_token)
  await setRefreshToken(res.refresh_token)
}

export async function requestEmailChange(newEmail: string, currentPassword: string): Promise<void> {
  await api("/auth/users/me/email", {
    method: "POST",
    body: JSON.stringify({ new_email: newEmail, current_password: currentPassword }),
  })
}

export async function confirmEmailChange(token: string): Promise<void> {
  await api("/auth/email-change/confirm", {
    method: "POST",
    body: JSON.stringify({ token }),
  })
}

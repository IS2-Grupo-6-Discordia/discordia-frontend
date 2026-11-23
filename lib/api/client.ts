import AsyncStorage from "@react-native-async-storage/async-storage"

import { newTraceHeaders } from "@/lib/api/trace"

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? ""

let token: string | null = null
let refreshToken: string | null = null

export async function loadToken() {
  token = await AsyncStorage.getItem("discordia_token")
  refreshToken = await AsyncStorage.getItem("discordia_refresh_token")
}

export function getToken() {
  return token
}

export async function setToken(t: string | null) {
  token = t
  if (t) await AsyncStorage.setItem("discordia_token", t)
  else await AsyncStorage.removeItem("discordia_token")
}

export function getRefreshToken() {
  return refreshToken
}

export async function setRefreshToken(t: string | null) {
  refreshToken = t
  if (t) await AsyncStorage.setItem("discordia_refresh_token", t)
  else await AsyncStorage.removeItem("discordia_refresh_token")
}

// Sin un límite, un fetch contra un backend colgado queda esperando para siempre y la
// pantalla se queda cargando. 30 s alcanza para un cold start de Render (el mismo
// margen que usa wake.ts por intento); las subidas tienen más por el tamaño del archivo.
const REQUEST_TIMEOUT_MS = 30_000
const UPLOAD_TIMEOUT_MS = 60_000

export class RequestTimeoutError extends Error {
  constructor() {
    super("Request timed out")
    this.name = "RequestTimeoutError"
  }
}

// Si el que llama ya pasa su propio signal, maneja él la cancelación y no se agrega otro.
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  if (init.signal) return fetch(url, init)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (controller.signal.aborted) throw new RequestTimeoutError()
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export class ApiError extends Error {
  status: number
  detail: unknown
  requestId?: string

  constructor(status: number, detail: unknown, message: string, requestId?: string) {
    super(message)
    this.status = status
    this.detail = detail
    this.requestId = requestId
  }
}

function extractDetailMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : JSON.stringify(d))).join(" ")
  }
  return fallback
}

// Generic, user-safe messages per HTTP status (Spanish, Rioplatense).
const GENERIC_ERROR_BY_STATUS: Record<number, string> = {
  400: "Revisá los datos e intentá de nuevo.",
  422: "Revisá los datos e intentá de nuevo.",
  401: "Tu sesión expiró. Iniciá sesión de nuevo.",
  403: "No tenés permiso para hacer esto.",
  404: "No encontramos lo que buscabas.",
  429: "Hiciste muchos intentos seguidos. Esperá unos segundos y probá de nuevo.",
  408: "El servidor tardó demasiado en responder. Probá de nuevo.",
  504: "El servidor tardó demasiado en responder. Probá de nuevo.",
}

function genericForStatus(status: number): string {
  const known = GENERIC_ERROR_BY_STATUS[status]
  if (known) return known
  if (status >= 500) return "Algo salió mal en el servidor. Probá de nuevo en unos segundos."
  return "Ocurrió un error. Probá de nuevo."
}

// Short code the user can pass on to support: the start of the request id, enough
// to find the request in the logs. It only goes on errors with no specific cause
// to show; the rest already tell the user what to do.
function withSupportCode(message: string, err: ApiError): string {
  const unexplained = err.status >= 500 || !(err.status in GENERIC_ERROR_BY_STATUS)
  if (!unexplained || !err.requestId) return message
  return `${message} (Código: ${err.requestId.slice(0, 8)})`
}

// Heuristic guard: raw FastAPI/pydantic validation fragments (English) must
// never reach the user, even on the rare chance one arrives as a string detail.
function looksTechnical(msg: string): boolean {
  return /input should|invalid length|value is not|field required|ensure this|not a valid|expected length|value_error|type_error/i.test(
    msg,
  )
}

// Central mapping from any thrown error to a single, user-safe Spanish string.
// The raw error is logged for debugging but never surfaced verbatim to the UI.
export function friendlyError(err: unknown): string {
  // Keep the technical detail available for dev/debug without showing it.
  console.warn("[friendlyError]", err)

  if (err instanceof ApiError) {
    if (err.status === 429) {
      // El bloqueo de login por cuenta (autenticación) dura minutos y lo explica en
      // `detail`; el rate limit del gateway llega sin cuerpo y queda el genérico.
      const detail = typeof err.detail === "string" ? err.detail.trim() : ""
      const readable = detail !== "" && detail !== "Error desconocido" && !looksTechnical(detail) && !detail.startsWith("<")
      return readable ? detail : genericForStatus(429)
    }
    // Business errors (401/403/404/409...) arrive as a human Spanish string in
    // `detail`; 422 validation errors arrive as an array/object, and 5xx are
    // never trustworthy for display -> fall back to a generic message.
    if (err.status < 500 && typeof err.detail === "string") {
      const detail = err.detail.trim()
      if (detail !== "" && !looksTechnical(detail)) {
        return detail
      }
    }
    return withSupportCode(genericForStatus(err.status), err)
  }

  if (err instanceof RequestTimeoutError) return genericForStatus(408)

  if (
    err instanceof TypeError ||
    (err instanceof Error &&
      (err.name === "AbortError" || /network|fetch|connect|timed? ?out/i.test(err.message)))
  ) {
    return "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo."
  }

  if (__DEV__) console.warn("[friendlyError] unexpected error:", err)

  return "Ocurrió un error inesperado. Probá de nuevo."
}

const NO_REFRESH_PATHS = new Set([
  "/auth/login",
  "/auth/oauth/google",
  "/auth/refresh",
  "/auth/logout",
  "/auth/users",
])

// Respuestas pasajeras en los endpoints de sesión: un 429 o 502-504 que no viene de
// autenticación (Render corta un rato las llamadas del gateway a autenticación después de un
// arranque en frío, y el gateway puede estar despertando). Se reintentan sin mostrar error,
// con el botón todavía cargando. Un 429 de autenticación (bloqueo por contraseñas
// incorrectas) trae `detail` y no se reintenta: ese sí se le muestra al usuario.
const RETRYABLE_PATHS = new Set(["/auth/login", "/auth/login/2fa", "/auth/oauth/google", "/auth/refresh"])
const TRANSIENT_STATUSES = new Set([429, 502, 503, 504])
const RETRY_DELAYS_MS = [1_500, 3_000, 5_000, 8_000]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function isTransient(res: Response): Promise<boolean> {
  if (!TRANSIENT_STATUSES.has(res.status)) return false
  const text = await res.clone().text().catch(() => "")
  try {
    return typeof JSON.parse(text)?.detail !== "string"
  } catch {
    return true
  }
}

async function sendWithRetries(send: () => Promise<Response>, retryable: boolean): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const last = !retryable || attempt >= RETRY_DELAYS_MS.length
    let res: Response
    try {
      res = await send()
    } catch (err) {
      // Solo errores de red (TypeError): un timeout de 30 s ya esperó bastante.
      if (last || !(err instanceof TypeError)) throw err
      await sleep(RETRY_DELAYS_MS[attempt])
      continue
    }
    if (last || !(await isTransient(res))) return res
    await sleep(RETRY_DELAYS_MS[attempt])
  }
}

// "unavailable": la renovación falló por algo pasajero (red, Render, gateway despertando). La
// sesión sigue siendo válida, así que no se cierra.
type RefreshOutcome = "renewed" | "rejected" | "unavailable"

let refreshing: Promise<RefreshOutcome> | null = null

async function adoptStoredSession(staleToken: string): Promise<boolean> {
  const storedToken = await AsyncStorage.getItem("discordia_token")
  if (!storedToken || storedToken === staleToken) return false
  token = storedToken
  refreshToken = await AsyncStorage.getItem("discordia_refresh_token")
  return true
}

async function renewSession(staleToken: string): Promise<RefreshOutcome> {
  if (await adoptStoredSession(staleToken)) return "renewed"
  if (!refreshToken) return "rejected"
  const sentRefreshToken = refreshToken

  let res: Response
  try {
    res = await sendWithRetries(
      () =>
        fetchWithTimeout(
          `${API_BASE}/auth/refresh`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...newTraceHeaders() },
            body: JSON.stringify({ refresh_token: sentRefreshToken }),
          },
          REQUEST_TIMEOUT_MS,
        ),
      true,
    )
  } catch {
    return (await adoptStoredSession(staleToken)) ? "renewed" : "unavailable"
  }

  if (!res.ok) {
    if (await adoptStoredSession(staleToken)) return "renewed"
    // Solo un 400/401 dice que el refresh token ya no sirve; lo demás es pasajero.
    return res.status === 400 || res.status === 401 ? "rejected" : "unavailable"
  }

  const body = (await res.json()) as { access_token: string; refresh_token: string }
  await setToken(body.access_token)
  await setRefreshToken(body.refresh_token)
  return "renewed"
}

function refreshSession(staleToken: string): Promise<RefreshOutcome> {
  if (!refreshing) {
    refreshing = renewSession(staleToken).finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

async function authorizedFetch(
  path: string,
  init: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<{ res: Response; requestId: string }> {
  // Outside send(): the retry after a refresh is the same request, with the same id.
  const traceHeaders = newTraceHeaders()
  const sendOnce = () => {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>), ...traceHeaders }
    if (token) headers["Authorization"] = `Bearer ${token}`
    return fetchWithTimeout(`${API_BASE}${path}`, { ...init, headers }, timeoutMs)
  }
  const send = () => sendWithRetries(sendOnce, RETRYABLE_PATHS.has(path))

  const sentToken = token
  let res = await send()

  if (res.status === 401 && sentToken && !NO_REFRESH_PATHS.has(path)) {
    const outcome = await refreshSession(sentToken)
    if (outcome === "renewed") {
      res = await send()
    } else if (outcome === "unavailable") {
      // Se responde como un error pasajero y no como 401, que haría cerrar la sesión.
      return {
        res: new Response(JSON.stringify({ detail: "Servicio no disponible" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
        requestId: traceHeaders["X-Request-Id"],
      }
    }
  }

  if (res.status === 401) {
    await setToken(null)
    await setRefreshToken(null)
  }

  return { res, requestId: traceHeaders["X-Request-Id"] }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  const { res, requestId } = await authorizedFetch(path, { ...options, headers })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    let detail: unknown = text
    try {
      detail = text ? JSON.parse(text).detail ?? text : "Error desconocido"
    } catch {
      detail = text || "Error desconocido"
    }
    if (__DEV__) console.warn(`[api] ${options.method ?? "GET"} ${path} -> ${res.status}`, text.slice(0, 200))
    throw new ApiError(res.status, detail, extractDetailMessage(detail, "Error desconocido"), res.headers.get("X-Request-Id") ?? requestId)
  }

  if (res.status === 204) {
    return undefined as T
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

// Multipart upload helper. Unlike `api()`, this does NOT set Content-Type so
// that fetch can add the multipart boundary itself; it only attaches the
// Authorization header when a token is present. `method` defaults to POST
// (create) but can be PATCH for partial multipart updates (e.g. banner edit).
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  method: string = "POST",
): Promise<T> {
  const { res, requestId } = await authorizedFetch(path, { method, body: formData, headers: {} }, UPLOAD_TIMEOUT_MS)

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    let detail: unknown = text
    try {
      detail = text ? JSON.parse(text).detail ?? text : "Error desconocido"
    } catch {
      detail = text || "Error desconocido"
    }
    if (__DEV__) console.warn(`[apiUpload] ${method} ${path} -> ${res.status}`, text.slice(0, 200))
    throw new ApiError(res.status, detail, extractDetailMessage(detail, "Error desconocido"), res.headers.get("X-Request-Id") ?? requestId)
  }

  if (res.status === 204) {
    return undefined as T
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

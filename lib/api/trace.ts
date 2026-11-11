// Ids for distributed tracing (documentacion/observabilidad.md). The client
// doesn't load the OpenTelemetry SDK, so it doesn't send a traceparent either:
// a parent span that is never exported shows up in Grafana as "root span not
// yet received". The trace is born in the first service that gets the request.
// The client only generates the request id, which is the code support asks for.

function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes)
  // Not every React Native runtime has `crypto`, and these ids aren't secrets.
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values)
  else values.forEach((_, i) => (values[i] = Math.floor(Math.random() * 256)))
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("")
}

// UUID v4: the same shape the services generate when they don't receive one.
export function newRequestId(): string {
  const hex = randomHex(16)
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20)}`
}

export function newTraceHeaders(): { "X-Request-Id": string } {
  return { "X-Request-Id": newRequestId() }
}

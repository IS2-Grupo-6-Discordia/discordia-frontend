# discordia-cliente-web

Cliente de Discordia para usuarios finales: una sola base de código para la web y para Android, hecha con Expo (React Native + React Native Web), TypeScript, Expo Router y NativeWind. Habla con el backend a través del gateway (`EXPO_PUBLIC_API_URL`), y para el tiempo real abre WebSockets directos a mensajes y voz con un ticket que emite el gateway.

## Setup local

Requisitos: Node 22 y npm.

```bash
cp .env.example .env
npm install
npm run web        # http://localhost:8081
```

Para tener backend, levantar el stack desde el repo `root`:
- `make core-up`: Redis, autenticación, servidores, mensajes y gateway en `http://localhost:8080`;
- `make voice-up`: voz y LiveKit;
- `make web`: levanta el cliente en `http://localhost:3000`.

El CORS del gateway local permite `http://localhost:3000` y `http://localhost:8081` (`gateway/.env.example`): si el cliente corre en otro puerto, hay que agregarlo.

Ver `infra/GUIA_LOCAL.md` en `root`.

### Variables (`.env`)

| Variable | Para qué | Local |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | URL base del gateway | `http://localhost:8080/api/v1`. Sin esta variable, el login y el registro usan datos de prueba (mock) |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Client ID web de Google para el login federado | El de `.env.example` |
| `EXPO_PUBLIC_WAKE_URLS` | Opcional: URLs que se despiertan al abrir la app (ver abajo) | Vacía: no despierta nada |

Las `EXPO_PUBLIC_*` se fijan al compilar: después de cambiarlas hay que reiniciar `npm run web`.

### Otros comandos

- `npm start`: el servidor de Expo, para abrir la app en web, en un emulador o en un teléfono.
- `npm run typecheck`: chequeo de tipos con TypeScript. Es lo que corre el CI en cada push y en cada PR.
- `npm run android`: la app en un emulador o un teléfono Android. Expo Go no trae el módulo nativo de WebRTC, así que la voz solo anda con una development build (ver [APK de Android](#apk-de-android-voz-nativa)).

## Estructura

- `app/`: pantallas con Expo Router. `(auth)` tiene login, registro y recupero. `(main)` tiene el chat, la voz, el perfil y Mi cuenta.
- `components/`: componentes compartidos.
- `lib/api/`: cliente HTTP y llamadas al gateway. `client.ts` agrega el token, renueva la sesión y arma los mensajes de error.
- `lib/realtime.ts`: el WebSocket de tiempo real, con reconexión.
- `lib/voiceRoom*.ts`: la voz con LiveKit. `.web.ts` es para el navegador y el otro para Android.

## Deploy

- **Web:** Cloudflare Pages, conectado al repo. `.github/workflows/cloudflare-deploy-respaldo.yml` dispara el deploy hook si Cloudflare no tomó un push.
- **Android:** cada merge a `main` compila la APK con EAS y la publica como Release de GitHub (`.github/workflows/apk-release.yml`).

## Servicios dormidos en Render

En el plan gratuito, Render duerme los servicios tras 15 minutos sin tráfico y **no los despierta
si la request viene de otro servicio de Render** (el gateway): responde `429` con
`x-render-routing: hibernate-rate-limited`. Por eso, al abrir la app, el navegador le pega directo
al health check de cada backend (`lib/api/wake.ts`), que sí los despierta, y el login espera a que
respondan mostrando "Estamos despertando el servidor".

- Si `EXPO_PUBLIC_API_URL` apunta a Render, se usan las URLs de producción de autenticación,
  servidores y voz.
- `EXPO_PUBLIC_WAKE_URLS` (opcional) reemplaza esa lista: URLs separadas por coma. Definida vacía,
  desactiva el despertador. Cuando un servicio nuevo pase a depender del gateway, hay que agregar
  su health check acá.

## APK de Android (voz nativa)

Expo Go no trae el módulo nativo de WebRTC que usa LiveKit, así que la app se compila con
[EAS Build](https://docs.expo.dev/build/introduction/) (en la nube; no hace falta Android SDK). La
voz nativa vive en `lib/voiceRoom.ts` (`@livekit/react-native`); en web se usa `lib/voiceRoom.web.ts`.
La cámara se pide recién al activarla. Como sus permisos nativos están definidos en `app.json`, cualquier
cambio de esos textos o permisos requiere generar una APK nueva; una actualización JavaScript no alcanza.

```bash
npx eas-cli login                                     # una vez, con una cuenta de Expo
npx eas-cli build -p android --profile apk            # APK instalable, contra producción
npx eas-cli build -p android --profile development    # development build para desarrollar con hot reload
```

- Los perfiles están en `eas.json`. `EXPO_PUBLIC_API_URL` se fija **al compilar** (en `env` de cada
  perfil): cambiarla exige otra build. Los `.env` locales no se suben a EAS.
- Con el perfil `development`, se instala la APK y después se corre `npx expo start --dev-client`.
- El login con Google funciona en web y en la APK. En web usa Google Identity Services; en Android,
  `@react-native-google-signin/google-signin` pidiendo el `idToken` con el client ID **web**
  (`webClientId`), que es el que valida el backend. Para que Android lo permita, en Google Cloud
  tiene que existir un cliente OAuth de tipo **Android** con el paquete `com.discordia.app` y el
  SHA-1 del keystore con el que EAS firma la APK (`npx eas-cli credentials -p android`). Sin ese
  cliente, el selector de cuenta falla con `DEVELOPER_ERROR` y la app muestra el aviso de Google
  no disponible. No funciona en Expo Go: hace falta una build de EAS.

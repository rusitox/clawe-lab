# Family Hub — Plan de paridad UX/UI + navegación (Stitch → RN) + build APK

## Objetivo
Dejar el prototipo **React Native (Expo)** con **paridad** respecto a lo generado en **Google Stitch** (proyecto *Family Hub (Clean)*) en:

1) **UX/UI** (look & feel, componentes, spacing, tipografía, colores, sombras)
2) **Navegación/comportamiento** (flujos, botones, estados, modales)
3) **Demo navegable** (Expo Web) para review rápido
4) **APK Android** instalable para pruebas en el dispositivo de Rusitox

> Source of truth: Stitch projectId `10056719031757979596`.

---

## Estado actual (2026-02-26)
- Prototipo web navegable publicado (Expo Web export estático): `http://vinc-rusitox.tail2ffb04.ts.net:8790`
- Repo: `clawe-lab/projects/familyhub-expo`
- Branch de trabajo: `feat/familyhub-expo-happypath`
- Stitch screens: **28**
- RN screens implementadas: ~12 (mayormente **PARTIAL** vs Stitch)

Matriz pantalla↔pantalla (Stitch → RN):
- `clawe-lab/docs/familyhub-stitch-parity.md`

---

## Reglas del juego (para evitar deriva)
- **Canon visual:** Android (porque es el dispositivo de prueba). Web es solo demo.
- **Paridad = “pixel-ish” + comportamiento**: no alcanza con “parecido”.
- **Unificación de tokens:** usar `src/theme.ts` + `src/theme.stitchTokens.ts` como base.
- **Componentizar primero**: cuando un patrón aparece en 2+ pantallas, se vuelve componente (evita inconsistencias).
- **Estados mock**: usar datos fake (pero creíbles) para mostrar interacciones.

---

## Flujo de trabajo propuesto

### Fase 0 — Fuentes y checklist
1) Stitch: `list_screens` export guardado en `workspace/tmp/stitch_familyhub_clean_screens.json`.
2) Checklist operativo (pantallas core + extras): `projects/familyhub-expo/PROTOTYPE_CHECKLIST.md`.
3) Paridad: actualizar `docs/familyhub-stitch-parity.md` cuando se agregue/finalice una pantalla.

### Fase 1 — Core tour (prioridad máxima)
Orden recomendado para cerrar el “tour” principal:
1) **Welcome**
2) **Onboarding** (Create family → Add members → Kids permissions → Invite)
3) **Weekly Home (Semana)**
4) **Monthly Calendar (Mes)**
5) **Day View (Día)**
6) **Create New Item (Nuevo)**
7) **Family Member Management (Familia)**
8) **Settings (Ajustes)**

Criterio “DONE” por pantalla:
- Layout, tipografía, colores y espaciados alineados
- Componentes (cards/pills/headers) iguales
- Navegación completa (botones hacen lo esperado)
- Estados clave presentes (ej: empty/selected)

### Fase 2 — Pantallas extra (de Stitch)
- Login
- Family picker / join by invite
- Settings & Integrations placeholders
- Notifications preferences
- Conflict resolution alert
- User profile & WhatsApp link
- WhatsApp beta integration
- AI assistant

---

## Navegación/comportamiento (definición)
Se considera implementado cuando:
- Los CTAs navegan a la pantalla correcta
- Tabs/headers/back funcionan
- Bottom sheets / modales abren/cierran
- Selecciones actualizan UI (aunque no persistan en backend)

---

## Preview navegable (Expo Web)

### Cómo se genera
Desde `projects/familyhub-expo`:
```bash
npx expo export --platform web
```
Esto crea `dist/`.

### Cómo se sirve (server)
```bash
python3 -m http.server 8790 --directory dist
```
URL:
- `http://vinc-rusitox.tail2ffb04.ts.net:8790`

Notas:
- Web **no es canon**; es para review rápido.
- Si hay diferencias vs Android, se prioriza Android.

---

## APK Android (cuando lleguemos a esa etapa)

### Recomendación: EAS Build (cloud)
En el servidor actual no hay Java/Android SDK, así que para APK usamos EAS.

#### Requisitos
- Cuenta Expo (definir cuál: `clawe.bot@gmail.com` u otra)
- Token Expo guardado **en el servidor**, no en el chat.

#### Preparación (server)
1) Crear token en Expo:
   - https://expo.dev/accounts/<user>/settings/access-tokens
2) Guardarlo en:
   - `/home/ubuntu/.openclaw/workspace/.secrets/expo_token` (chmod 600)
3) Instalar/usar EAS:
```bash
cd clawe-lab/projects/familyhub-expo
npx eas --version
```

#### Config EAS (una sola vez)
- Agregar `eas.json` con profiles `preview` (APK) y `production` (AAB).

#### Build APK
```bash
cd clawe-lab/projects/familyhub-expo
EXPO_TOKEN=$(cat /home/ubuntu/.openclaw/workspace/.secrets/expo_token)
export EXPO_TOKEN
npx eas build -p android --profile preview
```
Resultado: link de descarga del **.apk**.

---

## Checklist de entrega (para pasar a “dev stage”)
- [ ] Core tour con paridad en Android
- [ ] Navegación completa + estados mock
- [ ] Preview web actualizado
- [ ] Parity matrix actualizada (múltiples pantallas en DONE)
- [ ] Luego: generar APK y test en Android

---

## Pendientes inmediatos
- Convertir pantallas PARTIAL → DONE empezando por **Welcome + Onboarding** (componentes y tokens)
- Agregar pantallas faltantes del core tour (Nuevo, Día Timeline, etc.)
- Alinear `WeekScreen`/`CalendarScreen` para que calquen Stitch

# Family Hub — Stitch (Clean) v0 exports

**Source of truth:** Google Stitch project **"Family Hub (Clean)"**
- `projectId`: **10056719031757979596**
- Device: **MOBILE**

## App-first tour (Semana → Mes → Día → Nuevo → Familia → Ajustes)
Carpeta: `app-first/`

| Orden | Pantalla | screenId | Archivo |
|---:|---|---|---|
| 1 | Semana — Weekly Home Dashboard | `f92814da4e4a4ca0873580ab0c56780a` | `01-semana.png` |
| 2 | Mes — Monthly Calendar View | `910192f515504141a394d07cea3e1570` | `02-mes.png` |
| 3 | Día — Detailed Day View | `4eaabc7932a54650b8ac0e1bdcbe262b` | `03-dia.png` |
| 4 | Nuevo — Create New Item Selection | `705cb2e952d84d80b1310e02cfa3d055` | `04-nuevo.png` |
| 5 | Familia — Family Member Management | `7ecb933894494771b2882cf5fbbcbd81` | `05-familia.png` |
| 6 | Ajustes — Settings Screen | `17f1cd78a6684480b1aa0cfb1ea704fb` | `06-ajustes.png` |

> Nota: los `.json` incluyen los `downloadUrl` originales (screenshot/html) además del `screenshotBase64`.

## Onboarding tour (Create family → Add members → Kids permissions → Invite)
Carpeta: `onboarding/`

| Orden | Pantalla | screenId | Archivo |
|---:|---|---|---|
| 1 | Create Family Onboarding | `7daeeb6d995b44198208253d656efc3c` | `01-create-family.png` |
| 2 | Onboarding: Add Family Members | `96cfaf52a4eb4f59befb477eb8779642` | `02-add-members.png` |
| 3 | Configure Kids Permissions | `edb7f19cf6ac4f1dae1c1f2ae3ed1ea7` | `03-kids-permissions.png` |
| 4 | Onboarding: Invite Family Members | `5ac49ebbc4124adcb3cb7a8240e049fc` | `04-invite.png` |

## Pending design cards (from Kanban)
Las próximas pantallas/flows a diseñar (todavía **no** están en este set v0) están trackeadas en el Kanban y se van a ir exportando y agregando acá cuando se generen en Stitch:

- Configuración Familiar (missing)
- Onboarding miembros — rol padre/madre vs hijo/a
- Ajustes — Integraciones (placeholders)
- Preferencias de notificaciones
- Alertas de conflicto de calendario
- Login/Signup + teléfono/WhatsApp (si lo definimos)
- Agente IA (chat) + ingest WhatsApp + onboarding para invitar bot

## Configuración familiar (new)
Carpeta: `family-settings/`

- Screen: **Family Hub: Configuración familiar**
- `screenId`: `5edbf91bc81c48a99df7e862ab032cd0`
- File: `01-config-familiar.png`

## Ajustes — Integraciones (placeholders)
Carpeta: `settings-integrations/`

- Screen: **Family Hub: Settings & Integrations**
- `screenId`: `58f9a090a2734964af0e4ec7518a96d2`
- File: `01-ajustes-integraciones.png`

## Onboarding — Roles de miembros (adulto vs hijo/a)
Carpeta: `onboarding-member-roles/`

- Screen: **Onboarding: Add Family Roles**
- `screenId`: `6dc4afbc63d141a4a6f706f305d338af`
- File: `01-onboarding-roles.png`

## Asistente IA (chat)
Carpeta: `ai-assistant/`

- Screen: **Family Hub: Asistente IA**
- `screenId`: `1705d2707bb54160a7526717ca78e5c9`
- File: `01-asistente-ia.png`

## WhatsApp (Beta)
Carpeta: `whatsapp-integration/`

- Screen: **Family Hub: WhatsApp (Beta) Integration**
- `screenId`: `2226a6bb98364fed943b42c06352551b`
- File: `01-whatsapp-beta.png`

## Conflicto detectado
Carpeta: `conflict-alert/`

- Screen: **Family Hub: Conflict Resolution**
- `screenId`: `dff79c74986e453586e36ae7af83fe86`
- File: `01-conflicto-detectado.png`

# REQ-0001 — Family organization tracker (UX pack)

Source: https://github.com/rusitox/clawe-lab/issues/1

## Decisions (from Rusitox)
- Home/Vista principal: **Agenda semanal familiar unificada** (Option A).
- Roles/permisos: **padres administran permisos por miembro**.
  - Ej: adolescentes pueden crear eventos; niños pequeños solo visualización; algunos miembros (niños pequeños) pueden no usar la app.
- Auth MVP: **Google Sign-In (Gmail)**.
- Sync day-one: **backend requerido** (multi-dispositivo desde el día 1).
- Notificaciones: **configurables**.
- Integraciones: por ahora **Calendar**.

## Key objects
- Family
- Member
- Role/Permission set (per member)
- Event (one-off)
- Routine (recurring)
- Notification rule
- Calendar connection (Google Calendar; iOS calendar as future/bridge)

## Proposed IA (chosen direction)
### Option A — Family week agenda (chosen)
- Home: semana con agenda unificada + colores por miembro + chips de filtro.
- Día seleccionado muestra timeline de items.

## UX deliverables (iteration loop)
- Wireframes low-fi (Home, Create event, Create routine, Member permissions, Notification settings, Calendar connect)
- Luego: UI kit (colors/typography/components) + prototipo click-through

## Open questions (still)
- ¿Requerimos "Family invite" en MVP (invitar a otro padre con link/código) o solo 1 cuenta por ahora?
- ¿Eventos/rutinas se asignan a 1 miembro o a múltiples?
- ¿Zona horaria por familia? (recomendado sí)


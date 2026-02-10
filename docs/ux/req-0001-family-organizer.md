# REQ-0001 — Family organization tracker (UX pack)

Source: https://github.com/rusitox/clawe-lab/issues/1

## Hypotheses
- La unidad principal es la **familia** (grupo) con varios miembros.
- Vista primaria de valor: **semana** (agenda semanal).

## Key objects
- Member
- Event (one-off)
- Routine (recurring)
- Notification rule
- Integration source (future)

## Open questions for Rusitox (to unblock UX)
1) Roles/permisos: ¿niños editan o solo ven?
2) ¿Login o modo local en MVP?
3) Sincronización multi-dispositivo: ¿backend requerido en MVP?
4) Notificaciones: presets (10m/1h/1d) y quiet hours.
5) Integraciones: prioridad (Google/iCloud) vs “apps del colegio” (depende de API oficial).

## Proposed information architecture (3 options)
### Option A — Week view by member (default)
- Home: semana, columnas por miembro, filas por día.
- Pros: claridad por persona.
- Cons: se satura con muchos items.

### Option B — Unified week + filters
- Home: lista/agenda semanal unificada + filtro por miembro.
- Pros: simple, escalable.
- Cons: menos “family-centric” visual.

### Option C — Member-first
- Home: cards por miembro → entrando a su semana.
- Pros: reduce ruido.
- Cons: más taps.

## Next UX deliverables
- Wireframes low-fi (Home, Create event, Create routine, Notifications settings)
- Copy/labels básicos

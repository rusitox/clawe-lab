# REQ-0001 — Family Hub — WhatsApp group bot + AI ingest (idea) (2026-02-11)

## Goal
Integrate Family Hub with the **family WhatsApp group** by adding the AI assistant as a **bot participant**.

The bot analyzes messages (e.g., invitations, schedule changes) and **proposes** creating events/tasks/activities in Family Hub, using the family context.

## Key decisions (Rusitox)
- Preferred UX: **AI as a bot in the WhatsApp group** (most practical).
- **Opt-in**: adding the bot to a group is optional.
- Add a **disclaimer** message to the group (privacy/consent).
- The bot can do a guided **“who is who” mapping** between WhatsApp participants and Family Hub members.
- The bot must ask/define **who is authorized to confirm** the creation of an event/task (final OK owner).

## Example flow
1) Dad forwards/pastes a message: "Cumple de Sofi el sábado 17hs".
2) Bot extracts entities:
   - type: birthday
   - date/time: Saturday 17:00
   - location: (if present)
   - target child: ambiguous
3) Bot asks clarifying questions:
   - "¿Para qué hijo/a es?"
   - "¿Requiere adulto?" (per v1 decision)
4) Bot sends a draft summary and asks for confirmation:
   - "Voy a crear EVENTO: Cumple Sofi, Sáb 17:00, para: Juana. ¿Confirmás?"
5) Only after an authorized user confirms, the bot creates the item in Family Hub.

## Consent / privacy
- Explicit welcome message: "Este grupo tiene a Family Hub AI. Puede analizar mensajes para ayudarte a agendar. Usalo solo si están de acuerdo."
- Define retention policy for messages (store minimal, redact where possible).
- Avoid reading historical messages by default (MVP: only new messages).

## Mapping WhatsApp ↔ Family Hub
- Guided mapping flow:
  - Bot asks each participant to confirm identity (or an admin maps them).
- Store mapping as references; avoid storing phone numbers in plaintext.

## MVP scope
- Propose only (no silent writes)
- Authorized confirmation required
- Create events/tasks/activities
- Basic entity extraction (date/time/person)
- Minimal logs/audit trail

## Open questions
- Platform constraints: WhatsApp official API vs other integrations.
- Buttons/interactive UX available in WhatsApp channel (quick replies).
- Multi-admin: who can confirm, and per-family permissions.

## Confirmation model (decision)
- Any **adult** (parent/mother/tutor) can confirm.
- Minimal confirmation message in the group: `ok clawe`.
- The bot must verify that the sender is mapped to an authorized adult in Family Hub before writing.

# REQ-0001 — Family Hub — Auth/Login notes (2026-02-11)

## Observation
No login/signup screens were shown in the current UX iteration materials.

## Current agreement
- Users register/login with **Gmail**.

## New idea
- Allow register/login with **WhatsApp/phone** as an alternative, which would also help map phone numbers for WhatsApp group integration.

## Recommendation (MVP)
- Keep **Google Sign-In (Gmail)** as the **primary** auth for v1.
- Design WhatsApp/phone auth as a **phase 2** option unless we decide it is a hard dependency for the WhatsApp bot.

Rationale:
- Google Sign-In is standard, fast to implement, and avoids dealing with WhatsApp API constraints for authentication.
- WhatsApp/phone login brings extra complexity (verification, compliance, costs, provider dependency).

## UX flows to define
- First-time user: Google sign-in → create/join family
- Join family by invite link
- Multi-parent setup (adult roles)
- Logout / switch account
- Re-auth when token expires

## Link to backlog
- `fh-auth-login-signup-screens` (P1)
- `fh-auth-whatsapp-option` (P2)
- Related: `fh-whatsapp-ai-ingest` (P1)

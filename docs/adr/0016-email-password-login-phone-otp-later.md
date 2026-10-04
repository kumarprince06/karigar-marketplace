# 0016. Email + password login for MVP; phone OTP later

- Status: Accepted
- Date: 2026-10-03
- Deciders: TBD
- Supersedes: [0008](0008-phone-otp-and-token-sessions.md) (login method only)

## Context
[ADR 0008](0008-phone-otp-and-token-sessions.md) chose phone number + OTP login. No free way to send SMS is available, and Indian OTP SMS also needs TRAI DLT sender and template registration. Email will be sent through **Brevo** (transactional email API; free tier ~300 emails/day).

## Decision
- **MVP:** users sign up and log in with **email + password**.
- **Email and mobile number are both required and both unique.**
  - Email is unique case-insensitively (`UNIQUE (lower(email))`).
  - Mobile is stored in E.164 format (`+919876543210`) with a `UNIQUE (phone)` constraint.
  - Uniqueness applies to deactivated accounts too, until the account is anonymised after a DPDP erasure request ([architecture/03 §7](../architecture/03-erd-and-production-database-design.md)).
- **Accounts are verified by email:** a single-use, hashed, expiring link. Password reset works the same way.
- **The mobile number is collected but not verified** in the MVP (`phone_verified_at` stays NULL).
- **A number already on another account is rejected** at sign-up and on change (`409 Conflict`). The user can change their own number later from their profile (`PUT /api/v1/me/phone`), subject to the same uniqueness check. Once SMS is available, a phone change requires OTP verification of the new number.
- **Email is mandatory for workers too.** Practically every smartphone user already has an email address, because an Android phone needs a Google account, so this does not block onboarding.
- **Transactional email provider: Brevo**, behind the notification provider abstraction (verification links, password reset, important account notices). The sending domain must have SPF, DKIM and DMARC configured.
- **Passwords** are stored only as Argon2id/bcrypt hashes. Login is rate-limited per IP and per email.
- **Later phase:** when an SMS provider is in place, add phone OTP verification and phone-only login. The OTP design in [security/01 §7–12](../security/01-authentication-authorization-and-identity.md) applies then.
- **Unchanged from 0008:** short-lived access tokens, server-side refresh sessions with rotation, and the authorization model.

## Consequences
- **New schema and endpoints:**
  - `users` gains `email NOT NULL`, `password_hash`, `email_verified_at` and `password_updated_at`.
  - A new `user_auth_tokens` table holds email-verification and password-reset tokens.
  - New endpoints: register, login, email verify/resend, password forgot/reset, change phone.
- **Unverified mobile numbers:** until OTP exists, a wrong or someone else's number can be entered. The owner of that number cannot then use it until the other account changes it. Support can release a number manually on a valid complaint.
- **Brevo free-tier limit (~300/day):** enough for the pilot. Move to a paid Brevo plan when daily sign-ups and resets approach it.
- **Password-reset emails must not reveal** whether an account exists.

## Alternatives considered
- **Phone + OTP now:** rejected; there is no free SMS route.
- **WhatsApp OTP:** paid, and needs Meta business verification. Reconsider in the later phase.
- **Google sign-in:** possible later as an addition; not chosen as the only method.

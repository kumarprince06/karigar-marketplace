# 0008. Phone OTP login with short-lived access tokens and rotating refresh sessions

- Status: Superseded by [0016](0016-email-password-login-phone-otp-later.md) for the login method; token and authorization parts still apply
- Date: 2026-10-03 (recorded from existing design docs)
- Deciders: TBD
- Source: [security/01 §14, §17 MVP Decision, §77](../security/01-authentication-authorization-and-identity.md)

## Context
Users (especially workers) are phone-first; passwords add friction. Stateless tokens alone cannot be revoked.

## Decision
- Authentication by phone number + OTP. OTPs are never stored in plaintext; OTP state lives in Redis with rate limits.
- Short-lived signed access token with minimal claims (`sub`, `roles`, `iat`, `exp`).
- Server-side refresh sessions in PostgreSQL with refresh-token rotation and reuse detection.
- Authorization = role + resource ownership + domain rules; admins use explicit privileged operations; step-up auth for sensitive operations.

## Open
OTP lifetime and limits, SMS provider (TRAI DLT registration), access/refresh token lifetimes (docs say both 15 min and 3600 s), JWT signing algorithm and key rotation.

## Alternatives considered
Long-lived stateless JWT only; password login — rejected.

# Security & Compliance Specification

## 1. Authentication & Session Management
- **Password Storage**: Passwords hashed using Argon2id or salted PBKDF2/scrypt with high iteration count. Plaintext passwords never logged or stored.
- **Access Tokens**: Short-lived JSON Web Tokens (15-minute expiration) signed with asymmetric or high-entropy HMAC-SHA256 secrets.
- **Refresh Tokens**: Cryptographically random 256-bit tokens stored in hashed format in the database with strict rotating reuse detection. Refresh tokens transmitted only via `HttpOnly`, `Secure`, `SameSite=Strict` cookies or dedicated mobile headers.
- **Role-Based Access Control (RBAC)**:
  - `SUPER_ADMIN`: Full access to billing, storage credentials, user roles, content deletion.
  - `ADMIN`: Storage bucket allocation management, user suspensions, system audit review.
  - `MODERATOR`: Content review, report flagging, comment removal.
  - `AUDITOR`: Read-only access to storage metrics, cost logs, and audit trails.
  - `CREATOR`: Video uploads, channel management, studio metrics.
  - `USER`: Social feeds, watching, playlists, comments, likes.

---

## 2. Storage & Cloudflare Credential Security
- **Strict Server-Side Isolation**: Cloudflare R2 `AccessKeyId` and `SecretAccessKey` are **never** bundled into the Flutter application, web frontend, or exposed via any client-facing API.
- **Presigned Upload URLs**: Direct PUT uploads to R2 use time-limited (1-hour), single-object presigned signatures generated on the backend after validating quota reservations.
- **Signed Playback URLs**: Media streams use signed URLs or HMAC tokens with 2-hour TTL to prevent unauthorized hotlinking.
- **At-Rest Secret Encryption**: Storage credentials in `storage_accounts` are encrypted using AES-256-GCM before storage in PostgreSQL.

---

## 3. Input Validation & Attack Mitigation
- **SQL Injection**: Parameterized queries and prepared statements exclusively.
- **Cross-Site Scripting (XSS)**: Automatic output encoding; strict Content Security Policy (CSP).
- **Cross-Site Request Forgery (CSRF)**: Anti-CSRF tokens for mutating state cookies in web browsers.
- **Rate Limiting**: IP-based and user-based token bucket rate limiting (100 req/min for general API, 5 req/min for authentication endpoints).
- **MIME & Malware Screening**: Strict verification of file headers (magic bytes) against declared MIME types before processing.

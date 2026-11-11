# FleetOS Enterprise Authentication & Session Security Architecture

## 1. Authentication Lifecycle
- **Dual-Token Architecture:**
  - **Access Token:** Short-lived JWT (15-minute validity) encapsulating `{ userId, email, activeOrganizationId, role }`. Delivered via `HttpOnly`, `SameSite: Lax` cookie or `Authorization: Bearer <token>` header.
  - **Refresh Token:** Cryptographically secure random 256-bit token. Only its SHA-256 hash is persisted in the `sessions` collection.
- **Refresh Token Rotation & Reuse Detection:**
  - Every refresh rotation revokes the previous token and generates a new token in the same `familyId`.
  - If a revoked token is ever presented again (indicative of token theft), FleetOS immediately revokes **all sessions in that family**, terminating the attacker's and victim's sessions.

---

## 2. Multi-Organization Global Identity Model
- One global user account (`users`) with a globally unique email.
- Many-to-many relationship via `organization_members`:
  `{ userId, organizationId, role, status }`
- Organization switching updates `lastActiveOrganizationId` and immediately signs a new scoped JWT access token after verifying active database membership.


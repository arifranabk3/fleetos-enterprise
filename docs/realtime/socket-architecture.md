# Real-Time Socket.IO Architecture

## Overview
FleetOS implements an enterprise-grade, event-driven real-time architecture utilizing Socket.IO, Node.js HTTP servers, and MongoDB persistence.

## Security & Channel Model
1. **Mandatory Socket Handshake Authentication**:
   - Every socket connection handshake must present a valid JWT Access Token.
   - The token is cryptographically validated and checked against `OrganizationMember` in MongoDB.
   - Sockets failing token verification or tenant membership checks are rejected at the connection boundary.
2. **Organization-Scoped Rooms**:
   - Sockets automatically join `org:${organizationId}`.
   - Cross-tenant socket room discovery or message broadcasting is strictly impossible.
3. **Resource-Specific Subscription Authorization**:
   - `subscribe:vehicle`: Verified against active organization vehicle inventory before subscription approval.
   - `subscribe:shipment`: Verified against tenant shipments before subscription approval.

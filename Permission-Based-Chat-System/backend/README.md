# Permission-Based Chat System Backend

Node.js + Express backend for a role-based, permission-aware, real-time chat platform.

## Highlights

- JWT authentication with access/refresh flow
- Session-aware authentication (JWT tokens bound to server-side login sessions)
- Login telemetry: IP + browser + OS + device + optional geo payload
- Audit logs for auth and admin security actions
- IP blocklist enforcement middleware (global)
- Two-factor authentication (2FA) with challenge/verification flow
- Role hierarchy: `user` < `admin` < `superadmin`
- Private chat rules:
- Same-group users can message directly
- Different-group users require admin-approved permission
- Permission request workflow and direct admin grant/revoke
- Group management with full CRUD + member management + leave + ownership transfer
- Real-time messaging with Socket.IO
- Message delivery ticks:
- `single` -> sent
- `double` -> delivered
- `blue` -> read
- Reply-to-message support (`replyToId`)
- One-time private messages (auto-consume on first read)
- File uploads for chat attachments (image/video/document)
- Persistent file asset storage for chat attachments and avatars
- Message edit support within 5 minutes
- Message delete support:
- delete for me
- delete for everyone (within 5 minutes, sender only)

## Tech Stack

- Node.js
- Express.js
- PostgreSQL
- Prisma ORM
- Socket.IO
- JWT
- Multer
- express-validator

## Roles and Access

- `user`: regular chat usage
- `admin`: manages groups and permission approvals
- `superadmin`: can do everything admin can, plus admin-account management

## Functional Requirements

- The system must support user registration, login, token refresh, and logout.
- The system must enforce role-based access control for `user`, `admin`, and `superadmin` roles.
- The system must support optional two-factor authentication (2FA) with OTP challenge verification.
- The system must enforce session-aware authentication, including session revoke and block operations.
- The system must allow admins to manage groups, including create, update, delete, member add/remove, and ownership transfer.
- The system must allow direct private messaging between users who belong to the same group.
- The system must require admin-approved chat permission for private messaging across different groups.
- The system must support chat permission workflows: request, approve, reject, direct grant, and revoke.
- The system must support real-time private and group messaging.
- The system must support message reply, delivery/read states, edit within the allowed time window, and delete modes.
- The system must support one-time private messages that are consumed on first read.
- The system must support file uploads for chat attachments and user avatars with validation rules.
- The system must provide user notifications and mark-as-read functionality.
- The system must provide admin security features, including blocked IP management and audit log access.

## Non-Functional Requirements

- The backend should provide low-latency real-time messaging over Socket.IO.
- The API should maintain consistent REST conventions under the `/api` prefix.
- The system should enforce strong security controls, including JWT validation, authorization middleware, IP blocking, and audit logging.
- The service should ensure data integrity through PostgreSQL and Prisma ORM.
- The system should support reliable operation under concurrent users and high-frequency chat events.
- The platform should enforce input validation and safe error handling on all public endpoints.
- File upload processing should enforce MIME type and file-size limits.
- Session and blocked-IP checks should use caching and throttling to reduce database load.
- The codebase should remain maintainable through modular architecture (controllers, services, middlewares, and routes).
- The backend should be environment-configurable through `.env`-based settings.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure `.env` with at least:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/permission-based-chat-system-backend?schema=public
JWT_ACCESS_SECRET=replace_me
JWT_REFRESH_SECRET=replace_me
JWT_ACCESS_EXPIRES_IN=12h
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000

# Optional 2FA tuning
TWO_FACTOR_CODE_EXPIRY_MINUTES=10
TWO_FACTOR_MAX_ATTEMPTS=5

# 2FA delivery (recommended for production)
TWO_FACTOR_WEBHOOK_URL=http://localhost:4000/internal/2fa

# Debug fallback (non-production already allowed)
# Set true only if you explicitly want debug codes in production responses.
TWO_FACTOR_ALLOW_DEBUG_RESPONSE=false

# Session write throttling (reduces DB write pressure)
SESSION_HEARTBEAT_INTERVAL_MS=60000

# Blocked IP cache TTL in middleware (reduces DB read pressure)
BLOCKED_IP_CACHE_TTL_MS=30000

# Socket anti-flood controls
SOCKET_EVENT_WINDOW_MS=60000
SOCKET_EVENT_MAX_PER_WINDOW=120
SOCKET_SECURITY_RECHECK_MS=30000

# Production safety: do not use defaults
DEFAULT_ADMIN_PASSWORD=replace_with_strong_secret
DEFAULT_SUPERADMIN_PASSWORD=replace_with_strong_secret
```

`JWT_SECRET` is also supported as fallback.

3. Sync schema and generate Prisma client:

```bash
npx prisma db push --accept-data-loss
npx prisma generate
```

4. Seed default admin users (from `.env` values):

```bash
npm run seed:admin
```

5. Start server:

```bash
npm run dev
```

`npm run start` / `npm run dev` now execute `src/app.js` directly as the single runtime entrypoint.

Health check:

- `GET /api/health`

## Postman Collection

Import this file into Postman:

- `postman/Permission-Based-Chat-System.postman_collection.json`

Recommended quick flow:

1. Run `Auth -> POST Login User` (or `POST Admin Login`)
2. Confirm `accessToken` / `refreshToken` collection variables were auto-saved
3. Use protected endpoint folders directly

## File Uploads

Static serving:

- URL base: `/uploads`
- Local path: `public/uploads`
- Persisted DB table: `FileAsset`

Upload endpoint:

- `POST /api/messages/upload`
- `POST /api/users/me/avatar`

Upload constraints:

- Max files per request: 10
- Max file size: 100MB each
- Supported MIME groups:
- `image/*`
- `video/*`
- `application/pdf`
- Word, Excel, PowerPoint formats
- `text/plain`

Avatar upload constraints:

- Single file per request
- Image MIME types only
- Max file size: 10MB

### File Asset Flow

1. Upload files first.
2. Backend stores them in `public/uploads/<folder>` and also creates `FileAsset` rows.
3. API returns persisted file records including `id`, `category`, `folder`, `publicUrl`, and ownership metadata.
4. Use returned file IDs in message send APIs via `attachmentIds`.

File asset categories currently used:

- `chat_attachment`
- `avatar`
- `other`

## REST API

Base prefix: `/api`

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/admin/login`
- `POST /auth/refresh-token`
- `POST /auth/logout` (protected)
- `GET /auth/me` (protected)
- `POST /auth/2fa/login/verify`
- `POST /auth/2fa/enable` (protected)
- `POST /auth/2fa/enable/verify` (protected)
- `POST /auth/2fa/disable` (protected)
- `GET /auth/sessions` (protected)
- `DELETE /auth/sessions/:sessionId` (protected)

### Users

- `GET /users` (admin+)
- `GET /users/search?q=` (protected)
- `GET /users/:id` (protected)
- `PUT /users/:id` (protected)
- `PATCH /users/:id/status` (admin+)

### Groups

User-level routes:

- `GET /groups/my` (protected)
- `POST /groups/:id/leave` (protected)

Admin-level routes:

- `POST /groups` (admin+)
- `GET /groups` (admin+)
- `GET /groups/:id` (admin+)
- `PUT /groups/:id` (admin+)
- `DELETE /groups/:id` (admin+)
- `POST /groups/:id/add-members` (admin+)
- `POST /groups/:id/remove-members` (admin+)
- `PATCH /groups/:id/transfer-ownership` (admin+, current owner only)

### Permission Requests and Chat Permissions

- `POST /permissions/request` (protected)
- `GET /permissions` (protected)
- `GET /permissions/:id` (protected)
- `PATCH /permissions/:id/approve` (admin+)
- `PATCH /permissions/:id/reject` (admin+)
- `POST /permissions/direct-grant` (admin+)
- `PATCH /permissions/chat/:permissionId/revoke` (admin+)
- `GET /permissions/chat-permissions` (protected)

### Messages

- `POST /messages/upload` (protected)
- `POST /messages/private` (protected)
- `POST /messages/group` (protected)
- `GET /messages/private/:userId` (protected)
- `GET /messages/group/:groupId` (protected)
- `GET /messages/search?q=` (protected)
- `PATCH /messages/:id/read` (protected)
- `PATCH /messages/:id` (protected, edit within 5 minutes)
- `DELETE /messages/:id` (protected, body: `{ "deleteFor": "me" | "everyone" }`)

### Notifications

- `GET /notifications` (protected)
- `PATCH /notifications/:id/read` (protected)

### Admin / Superadmin

- `GET /admin/dashboard` (admin+)
- `GET /admin/admins` (superadmin)
- `POST /admin/admins` (superadmin)
- `POST /admin/users/:id/promote` (superadmin)
- `PATCH /admin/admins/:id` (superadmin)
- `PATCH /admin/admins/:id/status` (superadmin)
- `POST /admin/admins/:id/demote` (superadmin)
- `GET /admin/sessions` (admin+)
- `PATCH /admin/sessions/:sessionId/block` (admin+)
- `PATCH /admin/sessions/:sessionId/unblock` (admin+)
- `GET /admin/blocked-ips` (admin+)
- `POST /admin/blocked-ips` (admin+)
- `PATCH /admin/blocked-ips/:blockedIpId/unblock` (admin+)
- `GET /admin/audit-logs` (admin+)

## Security Flows

### Login with optional location context

`POST /api/auth/login` and `POST /api/auth/admin/login` accept an optional `location` object:

```json
{
  "country": "BD",
  "region": "Dhaka",
  "city": "Dhaka",
  "zipCode": "1207",
  "latitude": 23.8103,
  "longitude": 90.4125,
  "accuracyRadius": 15,
  "altitude": 12,
  "locationTimestamp": "2026-03-13T12:00:00.000Z"
}
```

If `twoFactorEnabled=true`, login returns `requiresTwoFactor=true` and a `challengeId`.

### 2FA challenge delivery

- If `TWO_FACTOR_WEBHOOK_URL` is set, the backend POSTs the OTP challenge payload to that webhook.
- In non-production, code is also available as `debugCode` for local development/testing.
- In production without webhook, 2FA endpoints return a configuration error unless `TWO_FACTOR_ALLOW_DEBUG_RESPONSE=true` is explicitly set.

### Session enforcement

- Access tokens must contain a valid `sessionId`.
- Blocked/revoked/expired sessions are rejected by auth middleware.
- `lastSeenAt` is updated on authenticated requests.

### User Media

- `POST /users/me/avatar` (protected)

## Message Behavior

### Delivery and Read Ticks

- `sent` -> single tick
- `delivered` -> double tick
- `read` -> blue tick

### Reply

- Use `replyToId` in private/group send APIs
- Reply target must belong to the same conversation

### One-Time Messages

- Allowed only for private chat
- On first read:
- content is replaced
- attachments are cleared
- consume event is emitted

### Edit Window

- Sender can edit only own message
- Edit allowed up to 5 minutes after `createdAt`
- One-time messages cannot be edited

### Delete Modes

- `deleteFor: "me"`: hides message for current user only
- `deleteFor: "everyone"`: sender-only, within 5 minutes

## Socket.IO

### Client -> Server

- `private_message`
- `group_message`
- `typing_start`
- `typing_stop`
- `mark_read`
- `edit_message`
- `delete_message`
- `permission_request_created`
- `permission_request_updated`

### Server -> Client

- `private_message`
- `group_message`
- `message_status_update`
- `message_one_time_consumed`
- `message_edited`
- `message_deleted`
- `typing_start`
- `typing_stop`
- `permission_request_created`
- `permission_request_updated`
- `notification`

## Quick Payload Examples

Send private message:

```json
{
  "receiverId": "<user-id>",
  "content": "Hello",
  "attachmentIds": ["<file-asset-id>"],
  "replyToId": "<optional-message-id>",
  "oneTime": false
}
```

Send group message:

```json
{
  "groupId": "<group-id>",
  "content": "Hi group",
  "attachmentIds": ["<file-asset-id>"],
  "replyToId": "<optional-message-id>"
}
```

Attachment upload response item:

```json
{
  "id": "<file-asset-id>",
  "category": "chat_attachment",
  "folder": "chat",
  "originalName": "invoice.pdf",
  "storedName": "1741880000000-uuid-invoice.pdf",
  "mimeType": "application/pdf",
  "size": 24576,
  "relativePath": "chat/1741880000000-uuid-invoice.pdf",
  "publicUrl": "/uploads/chat/1741880000000-uuid-invoice.pdf",
  "url": "/uploads/chat/1741880000000-uuid-invoice.pdf"
}
```

Edit message:

```json
{
  "content": "Updated text"
}
```

Delete message:

```json
{
  "deleteFor": "everyone"
}
```

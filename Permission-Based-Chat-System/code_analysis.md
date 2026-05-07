# Backend Module Analysis

This file selects 8 concrete backend modules from the project and presents a simplified intermediate-code view, a control flow graph, and a data dependence graph for each one. The notation is intentionally compact so it can be used as a study or submission draft.

## 1) `src/app.js`

**Role**: application bootstrap, middleware wiring, route registration, server startup, and graceful shutdown.

**Intermediate code**
```text
start
  load env, db, redis, socket, routes
  create express app
  install compression, cors, helmet, logger, parsers
  serve /uploads
  install ip-block and rate-limit middleware
  register health route
  mount auth, user, group, permission, message, notification, admin routes
  install notFound and errorHandler
  if main module:
    connectDB
    try redis.connect
    create httpServer
    create socket server
    listen on env.port
    wait for SIGINT | SIGTERM | uncaughtException | unhandledRejection
    gracefulShutdown
end
```

**Flow graph**
```mermaid
flowchart TD
  A([start]) --> B[load configuration]
  B --> C[create app and install middleware]
  C --> D[register routes]
  D --> E{if main module?}
  E -- yes --> F[connect DB / Redis]
  F --> G[create HTTP + Socket servers]
  G --> H[listen]
  H --> I[shutdown handlers]
  E -- no --> J([end])
  I --> J
```

**DD graph**
```mermaid
flowchart LR
  envPort[env.port] --> listen[listen]
  envNodeEnv[env.nodeEnv] --> logger[logger]
  envCors[env.corsOrigins] --> cors[cors middleware]
  routes[routes] --> mount[app.mount]
  httpServer[httpServer] --> ioServer[ioServer]
  ioServer --> graceful[gracefulShutdown]
  prisma[prisma] --> cleanup[gracefulShutdown cleanup]
  redis[redis] --> cleanup
```

## 2) `src/middlewares/authMiddleware.js`

**Role**: authentication guard that extracts a token, verifies the session, loads the user, and attaches `req.user` and `req.session`.

**Intermediate code**
```text
extract token from Authorization header or cookie
if token missing -> 401 error
decode access token
if sessionId missing -> 401 error
load loginSession with user
if session invalid -> 401 error
if session expired -> mark expired and fail
if session blocked or revoked -> fail
if heartbeat interval elapsed -> update lastSeenAt
if user inactive and role is not elevated -> 403 error
set req.session and req.user
next()
```

**Flow graph**
```mermaid
flowchart TD
  A([start]) --> B[extract token]
  B --> C{token exists?}
  C -- no --> Z([error / next])
  C -- yes --> D[verify token]
  D --> E{sessionId exists?}
  E -- no --> Z
  E -- yes --> F[fetch session and user]
  F --> G{session valid and active?}
  G -- no --> Z
  G -- yes --> H[update heartbeat if needed]
  H --> I[attach request context]
  I --> J([next])
```

**DD graph**
```mermaid
flowchart LR
  authHeader[req.headers.authorization] --> token[token]
  cookie[req.cookies.accessToken] --> token
  token --> decoded[decoded.sessionId / decoded.userId]
  decoded --> sessionLookup[prisma.loginSession lookup]
  sessionLookup --> session[session]
  session --> reqUser[req.user]
  session --> reqSession[req.session]
  sessionLastSeen[session.lastSeenAt] --> heartbeat[heartbeat update decision]
  userRole[user.role] --> authz[authorization decision]
  userActive[user.isActive] --> authz
```

## 3) `src/controllers/authController.js`

**Role**: HTTP layer for login, registration, token refresh, logout, and two-factor actions.

**Intermediate code**
```text
login(req)
  call authService.login(req.body)
  if service says two-factor required
    set login message accordingly
  else
    set success message
  return ApiResponse.success
```

**Flow graph**
```mermaid
flowchart TD
  A([request]) --> B[call authService]
  B --> C{requiresTwoFactor?}
  C -- yes --> D[choose 2FA message]
  C -- no --> E[choose success message]
  D --> F[send success payload]
  E --> F
```

**DD graph**
```mermaid
flowchart LR
  body[req.body] --> service[authService.login]
  resultFlag[authService result.requiresTwoFactor] --> message[response message]
  service --> response[response data]
```

## 4) `src/services/authService.js`

**Role**: authentication core, including password validation, session creation, token issuance, and two-factor challenge handling.

**Intermediate code**
```text
login(email, password, adminOnly, meta)
  normalize email
  find user by email
  if missing -> audit + 401
  compare password
  if invalid -> audit + 401
  if adminOnly and role not admin/superadmin -> audit + 403
  if inactive -> audit + 403
  if two-factor enabled
    create challenge
    audit challenge creation
    return requiresTwoFactor result
  build tokens
  persist refresh token and login session
  audit success
  return user + tokens
```

**Flow graph**
```mermaid
flowchart TD
  A([start]) --> B[normalize credentials]
  B --> C{user found?}
  C -- no --> X1[error]
  C -- yes --> D{password valid?}
  D -- no --> X1
  D -- yes --> E{role allowed for adminOnly?}
  E -- no --> X2[error]
  E -- yes --> F{account active?}
  F -- no --> X3[error]
  F -- yes --> G{two-factor enabled?}
  G -- yes --> H[create challenge / return 2FA]
  G -- no --> I[build session tokens]
  I --> J[persist session and refresh token]
  J --> K([return result])
  H --> K
```

**DD graph**
```mermaid
flowchart LR
  email[email] --> normalized[normalizedEmail]
  password[password] --> valid[isPasswordValid]
  role[user.role] --> access[access decision]
  adminOnly[adminOnly] --> access
  active[user.isActive] --> activeDecision[active account decision]
  twoFactor[user.twoFactorEnabled] --> challenge[challenge branch]
  userId[user.id] --> payload[token payload]
  userRole[user.role] --> payload
  sessionId[sessionId] --> linkage[refresh token and login session linkage]
  meta[meta.location / meta.ip / meta.userAgent] --> audit[audit and session metadata]
```

## 5) `src/controllers/messageController.js`

**Role**: HTTP endpoints for sending, browsing, editing, deleting, and uploading message attachments.

**Intermediate code**
```text
sendPrivateMessage(req)
  resolve attachment ids from body
  call messageService.sendPrivateMessage
  return 201 success response
```

**Flow graph**
```mermaid
flowchart TD
  A([request arrives]) --> B[resolve attachments]
  B --> C[call message service]
  C --> D([response ready])
```

**DD graph**
```mermaid
flowchart LR
  body[req.body.attachmentIds / req.body.attachments] --> ids[attachmentIds]
  user[req.user._id] --> call[service call]
  receiver[req.body.receiverId] --> call
  content[req.body.content] --> call
  call --> response[response data]
```

## 6) `src/services/messageService.js`

**Role**: message rules, permission checks, persistence, socket emission, read status transitions, editing, deletion, history retrieval, and cache invalidation.

**Intermediate code**
```text
sendPrivateMessage(senderId, receiverId, content, attachmentIds, replyToId, oneTime)
  normalize inputs
  reject self messaging
  reject empty message
  ensure both users are active
  check permission to chat privately
  validate reply target
  determine delivered/sent status
  transaction:
    verify attachment ownership
    create message
    attach files to message
  enrich message
  emit private message + status events
  create notification for receiver
  invalidate caches
  return populated message
```

**Flow graph**
```mermaid
flowchart TD
  A([start]) --> B[normalize ids and text]
  B --> C{self message?}
  C -- yes --> X1[error]
  C -- no --> D{empty content and no attachments?}
  D -- yes --> X2[error]
  D -- no --> E[ensure both users are active]
  E --> F{private chat allowed?}
  F -- no --> X3[permission error / history fallback]
  F -- yes --> G[reply allowed?]
  G --> H[create DB transaction]
  H --> I[enrich and emit socket events]
  I --> J[create notification]
  J --> K[invalidate cache]
  K --> L([return message])
```

**DD graph**
```mermaid
flowchart LR
  sender[senderId] --> status[permission checks and status selection]
  receiver[receiverId] --> status
  content[content] --> validation[validation and created message payload]
  attachments[attachmentIds] --> validation
  reply[replyToId] --> replyCheck[reply validation and reply reference]
  normalized[normalizedAttachmentIds] --> fileCheck[ownership verification / file attachment]
  messageId[message.id] --> notify[notification metadata / socket payload / cache invalidation]
  senderName[sender.name] --> title[notification title]
  messageStatus[message.status] --> tick[tick/status payload]
```

## 7) `src/controllers/groupController.js`

**Role**: group lifecycle, membership management, ownership transfer, and avatar enrichment.

**Intermediate code**
```text
createGroup(req)
  start DB transaction
  create group row
  create owner membership row
  reload group with selected fields
  enrich avatars
  return 201 response
```

**Flow graph**
```mermaid
flowchart TD
  A([start]) --> B[create group transaction]
  B --> C[create owner membership]
  C --> D[reload group]
  D --> E[enrich avatars]
  E --> F([send success response])
```

**DD graph**
```mermaid
flowchart LR
  user[req.user._id] --> creator[creatorId]
  creator --> groupOwner[group.createdById]
  creator --> membership[owner membership]
  createdId[created.id] --> reload[reload query]
  avatarIds[group.avatarFileId / createdBy.avatarFileId / member avatar ids] --> enrich[avatar enrichment]
  enrich --> payload[ApiResponse payload]
```

## 8) `src/controllers/notificationController.js`

**Role**: list, read, bulk update, and delete notifications.

**Intermediate code**
```text
listNotifications(req)
  build pagination options from query
  call notificationService.listNotifications
  return items and pagination metadata
```

**Flow graph**
```mermaid
flowchart TD
  A([request arrives]) --> B[parse page and limit]
  B --> C[call notification service]
  C --> D[format payload]
  D --> E([send response])
```

**DD graph**
```mermaid
flowchart LR
  page[req.query.page] --> pagination[pagination options]
  limit[req.query.limit] --> pagination
  pagination --> service[notificationService.listNotifications]
  service --> items[result.items]
  service --> meta[result.pagination]
  items --> response[response body]
  meta --> response
```

## Notes

- The intermediate code is written as simplified three-address style pseudocode, not compiler output.
- The flow graph is a compact control-flow sketch; the DD graph shows primary data dependencies only.
- If you want, this can be expanded into Mermaid diagrams or a PDF-ready report next.

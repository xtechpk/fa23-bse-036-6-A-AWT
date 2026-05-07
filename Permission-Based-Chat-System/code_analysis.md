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
```text
N1 start
N2 load configuration
N3 create app and install middleware
N4 register routes
N5 if main module?
N6 connect DB / Redis
N7 create HTTP + Socket servers
N8 listen
N9 shutdown handlers

Edges:
N1 -> N2 -> N3 -> N4 -> N5
N5(yes) -> N6 -> N7 -> N8 -> N9 -> end
N5(no) -> end
```

**DD graph**
```text
env.port, env.nodeEnv -> listen, logger
env.corsOrigins -> cors middleware
httpServer -> ioServer -> gracefulShutdown
prisma, redis -> gracefulShutdown cleanup
routes -> app.mount
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
```text
N1 start
N2 extract token
N3 token exists?
N4 verify token
N5 sessionId exists?
N6 fetch session and user
N7 session valid and active?
N8 update heartbeat if needed
N9 attach request context
N10 next / error

Edges:
N1 -> N2 -> N3
N3(no) -> N10
N3(yes) -> N4 -> N5
N5(no) -> N10
N5(yes) -> N6 -> N7
N7(no) -> N10
N7(yes) -> N8 -> N9 -> N10
```

**DD graph**
```text
req.headers.authorization, req.cookies.accessToken -> token
token -> decoded.sessionId, decoded.userId
decoded.sessionId -> prisma.loginSession lookup -> session
session.user -> req.user
session -> req.session
session.lastSeenAt -> heartbeat update decision
user.role, user.isActive -> authorization decision
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
```text
N1 receive request
N2 call authService
N3 requiresTwoFactor?
N4 choose response message
N5 send success payload

Edges:
N1 -> N2 -> N3
N3(yes) -> N4 -> N5
N3(no) -> N4 -> N5
```

**DD graph**
```text
req.body -> authService.login
authService result.requiresTwoFactor -> response message
authService result -> response data
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
```text
N1 start
N2 normalize credentials
N3 user found?
N4 password valid?
N5 role allowed for adminOnly?
N6 account active?
N7 two-factor enabled?
N8 create challenge / return 2FA branch
N9 build session tokens
N10 persist session and refresh token
N11 return result

Edges:
N1 -> N2 -> N3
N3(no) -> error
N3(yes) -> N4
N4(no) -> error
N4(yes) -> N5
N5(no) -> error
N5(yes) -> N6
N6(no) -> error
N6(yes) -> N7
N7(yes) -> N8 -> N11
N7(no) -> N9 -> N10 -> N11
```

**DD graph**
```text
email, password -> normalizedEmail, isPasswordValid
user.role, adminOnly -> access decision
user.isActive -> active account decision
user.twoFactorEnabled -> challenge branch
user.id, user.role -> token payload
sessionId -> refresh token and login session linkage
meta.location, meta.ip, meta.userAgent -> audit and session metadata
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
```text
N1 request arrives
N2 resolve attachments
N3 call message service
N4 response ready

Edges:
N1 -> N2 -> N3 -> N4
```

**DD graph**
```text
req.body.attachmentIds / req.body.attachments -> attachmentIds
req.user._id, req.body.receiverId, req.body.content -> service call
service result -> response data
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
```text
N1 start
N2 normalize ids and text
N3 self message?
N4 empty content and no attachments?
N5 users active?
N6 private chat allowed?
N7 reply allowed?
N8 create DB transaction
N9 enrich and emit socket events
N10 create notification
N11 invalidate cache
N12 return message

Edges:
N1 -> N2 -> N3
N3(yes) -> error
N3(no) -> N4
N4(yes) -> error
N4(no) -> N5 -> N6
N6(no) -> permission error path or history fallback
N6(yes) -> N7 -> N8 -> N9 -> N10 -> N11 -> N12
```

**DD graph**
```text
senderId, receiverId -> permission checks and status selection
content, attachmentIds -> validation and created message payload
replyToId -> reply validation and reply reference
normalizedAttachmentIds -> ownership verification, file attachment, message record
message.id -> notification metadata, socket payload, cache invalidation
sender.name -> notification title
message.status -> tick/status payload
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
```text
N1 start
N2 create group transaction
N3 create owner membership
N4 reload group
N5 enrich avatars
N6 send success response

Edges:
N1 -> N2 -> N3 -> N4 -> N5 -> N6
```

**DD graph**
```text
req.user._id -> creatorId -> group.createdById and owner membership
created.id -> membership.groupId and reload query
group.avatarFileId, createdBy.avatarFileId, member avatar ids -> avatar enrichment
enriched group -> ApiResponse payload
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
```text
N1 request arrives
N2 parse page and limit
N3 call notification service
N4 format payload
N5 send response

Edges:
N1 -> N2 -> N3 -> N4 -> N5
```

**DD graph**
```text
req.query.page, req.query.limit -> pagination options
pagination options -> notificationService.listNotifications
result.items, result.pagination -> response body
```

## Notes

- The intermediate code is written as simplified three-address style pseudocode, not compiler output.
- The flow graph is a compact control-flow sketch; the DD graph shows primary data dependencies only.
- If you want, this can be expanded into Mermaid diagrams or a PDF-ready report next.

# Mini Online Store API (Express.js MVC Lab + Full CRUD)

This project is a complete, ready-to-run MVC Express backend with a matching React frontend.

## Learning Goals Covered
- Middleware (`logger` globally, `auth` only on `/users` routes)
- Routing with `express.Router()`
- Route params (`GET /users/:id`)
- Request body (`POST /users`)
- Scalable folder structure (controllers/routes/middleware)
- Full user CRUD using Prisma + PostgreSQL

## Folder Structure

```text
project-folder/
├── app.js
├── controllers/
│   ├── productController.js
│   └── userController.js
├── middleware/
│   ├── auth.js
│   └── logger.js
├── prisma/
│   ├── schema.prisma
│   ├── client.js
│   └── migrations/
├── routes/
│   ├── products.js
│   └── users.js
├── .env
└── package.json
```

## Backend Setup

```bash
cd project-folder
npm install
npx prisma migrate dev --name init_user_crud_schema
npm start
```

Backend URL: `http://localhost:3000`

## Frontend Setup

```bash
cd ../frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

## Required Lab Endpoints (Instructor Ask)

### 1) GET /products
- Returns dummy product list.

### 2) GET /users/:id (Protected)
- Demonstrates `req.params`.

### 3) POST /users (Protected)
- Demonstrates `req.body`.

Auth header for `/users` routes:

```http
Authorization: Bearer demo-token
```

## Additional Industry CRUD Endpoints

- `GET /api/users` → list users
- `GET /api/users/:id` → get user by id
- `POST /api/users` → create user
- `PUT /api/users/:id` → update user
- `PATCH /api/users/:id` → partial update user
- `DELETE /api/users/:id` → delete user

- `GET /api/products` → dummy products (frontend-friendly path)

## Why `express.Router()` Instead of Putting All Routes in `app.js`?
- Keeps feature routes isolated and maintainable.
- Improves readability as project size grows.
- Allows route-level middleware (auth on `/users` only).
- Supports clean scalable architecture aligned with MVC.

## Restaurant Analogy in Code
- Logger middleware = waiter writing order details for every table.
- Auth middleware = waiter checking VIP membership/token before serving a protected area.

## Error Handling
- 404 middleware catches unknown routes at end of pipeline.
- Central error middleware handles unexpected runtime errors safely.

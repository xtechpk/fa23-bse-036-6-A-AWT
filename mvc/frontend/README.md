# Mini Online Store Frontend (React + Ant Design)

This frontend is aligned with the backend API and demonstrates complete operations:

- `GET /products` display
- `GET /users/:id` by route parameter search
- `POST /users` create form
- Full user CRUD (`GET/POST/PUT/DELETE`) through protected `/api/users` routes

## Setup

```bash
cd frontend
npm install
npm run dev
```

Runs at: `http://localhost:5173`

## Environment Variables

`.env`

```env
VITE_API_BASE_URL=http://localhost:3000/api/users
VITE_PRODUCTS_URL=http://localhost:3000/api/products
VITE_API_TOKEN=Bearer demo-token
```

## Notes

- Backend must be running on `http://localhost:3000`.
- `/api/users` requires auth token configured via `VITE_API_TOKEN`.
- UI includes create, read, update, delete operations for users.

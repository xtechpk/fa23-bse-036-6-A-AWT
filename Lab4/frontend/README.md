# Frontend

React + TypeScript frontend for the UHSP Medical Store and Hospital Platform.

## Main Responsibilities

- User login and registration
- Role-based route protection
- Patient dashboard and self-service actions
- Doctor consultation screens
- Pharmacy, lab, ambulance, and admin dashboards

## Commands

```bash
npm install
npm run dev
```

Other available scripts:

- `npm run build`
- `npm run lint`
- `npm run preview`

## Local Development

The frontend expects the backend API to be running at:

```text
http://localhost:3000/api
```

That value is currently defined in `src/config/api.ts`.

## Main Routes

- `/login`
- `/register`
- `/patient/dashboard`
- `/patient/book-appointment`
- `/patient/book-lab-test`
- `/patient/lab-reports`
- `/patient/emergency`
- `/doctor/dashboard`
- `/doctor/consultation`
- `/pharmacy/dashboard`
- `/lab/dashboard`
- `/driver/dashboard`
- `/admin/dashboard`

See the root project README for full setup, backend configuration, and API documentation.

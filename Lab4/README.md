# UHSP Medical Store and Hospital Platform

Full-stack university project for managing hospital workflows across authentication, patients, appointments, pharmacy, lab orders, ambulance dispatch, and admin operations.

## Overview

This repository contains:

- A Node.js + Express backend with Prisma and PostgreSQL
- A React + TypeScript frontend built with Vite
- Role-based workflows for patients, doctors, pharmacists, lab technicians, ambulance drivers, and administrators
- Optional Redis caching and Kafka-based event messaging

## Project Structure

```text
Lab4/
|- backend/    Express API, Prisma schema, migrations, business modules
|- frontend/   React client, route protection, dashboards, API services
`- report.docx
```

## Core Features

### Backend modules

- Authentication with JWT-based access control
- Patient profile and medical record management
- Appointment booking and doctor schedule management
- Pharmacy inventory, stock updates, dispensing, and low-stock reporting
- Lab catalog management, test booking, pending queues, and result submission
- Ambulance dispatch, live trip tracking, and driver location updates
- Admin statistics and broadcast notifications

### Frontend modules

- Login and registration flows
- Role-protected dashboards
- Patient flows for appointments, lab tests, reports, and emergency requests
- Doctor consultation and schedule views
- Pharmacy, lab technician, ambulance driver, and admin consoles

## Tech Stack

### Backend

- Node.js
- Express 5
- Prisma ORM
- PostgreSQL
- JWT authentication
- Joi validation
- Redis for cached health checks
- KafkaJS for event publishing and consuming

### Frontend

- React 19
- TypeScript
- Vite
- React Router
- React Hook Form + Zod
- Axios
- Zustand
- Tailwind CSS 4

## Prerequisites

Install these before running the project:

- Node.js 18+
- npm 9+
- PostgreSQL
- Redis optional for local development
- Kafka optional for local development

The backend runs without Kafka if the broker is unavailable. Redis is also optional, but the health endpoint caching will be skipped if Redis is not reachable.

## Environment Setup

Create a `.env` file inside `backend/`.

Example:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/uhsp_db?schema=public"
JWT_SECRET="change-this-secret"
JWT_EXPIRES_IN="1d"
PORT=3000
NODE_ENV=development

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

KAFKA_CLIENT_ID=hospital-app
KAFKA_BROKER_URL=localhost:9092
KAFKA_GROUP_ID=hospital-group

UV_THREADPOOL_SIZE=32
```

### Important notes

- `DATABASE_URL` is required
- `JWT_SECRET` is required for login and protected routes
- The frontend API base URL is currently hardcoded to `http://localhost:3000/api`
- Backend CORS currently allows `http://localhost:5173`, `http://localhost:5174`, and `http://localhost:3000`

## Installation

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Apply Prisma migrations

```bash
cd backend
npx prisma migrate dev
```

This creates the database schema from `prisma/schema.prisma` and generates Prisma Client.

## Running the Project

Open two terminals.

### Terminal 1: backend

```bash
cd backend
npm start
```

Backend default URL: `http://localhost:3000`

### Terminal 2: frontend

```bash
cd frontend
npm run dev
```

Frontend default URL: `http://localhost:5173`

## Available Scripts

### Backend

- `npm start` starts the Express server with nodemon
- `npm test` is currently a placeholder

### Frontend

- `npm run dev` starts the Vite development server
- `npm run build` builds the production bundle
- `npm run lint` runs ESLint
- `npm run preview` previews the production build locally

## API Summary

The backend is mounted under `http://localhost:3000/api`.

### Auth

- `POST /auth/register` register a patient or staff user
- `POST /auth/login` login and receive a JWT
- `GET /auth/me` fetch current authenticated user

### Patients

- `GET /patients/me` get patient profile
- `PATCH /patients/me` update patient profile
- `GET /patients/me/records` get patient medical records
- `GET /patients/search/:cnic` search patient by CNIC for staff roles
- `POST /patients/medical-record` add consultation record as doctor

### Appointments

- `POST /appointments/book` book an appointment as patient
- `GET /appointments/my-appointments` list patient appointments
- `GET /appointments/doctor/schedule` get doctor schedule
- `PATCH /appointments/:id/status` update appointment status
- `POST /appointments/doctor/schedule-settings` save doctor schedule settings

### Pharmacy

- `POST /pharmacy/medicine` add medicine
- `POST /pharmacy/stock` add stock
- `POST /pharmacy/dispense` dispense prescription items
- `GET /pharmacy/store/:storeId/low-stock` get low-stock report

### Lab

- `POST /lab/catalog` add a lab test to catalog
- `POST /lab/order` create a lab order
- `GET /lab/my-orders` list patient lab orders
- `GET /lab/pending` list pending lab work
- `POST /lab/order/:orderId/result` upload test result

### Ambulance

- `POST /ambulance/dispatch` request ambulance dispatch
- `PATCH /ambulance/location` update driver location
- `GET /ambulance/trip/:tripId` track a trip

### Admin

- `GET /admin/stats` fetch dashboard statistics
- `POST /admin/broadcast` send broadcast notification

## Frontend Routes

### Public

- `/login`
- `/register`

### Protected dashboards

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

## Roles in the System

The Prisma schema defines these roles:

- `SUPERADMIN`
- `MINISTRY_OFFICIAL`
- `HOSPITAL_ADMIN`
- `DOCTOR`
- `NURSE`
- `PHARMACIST`
- `LAB_TECHNICIAN`
- `AMBULANCE_DRIVER`
- `PATIENT`
- `INSURANCE_AGENT`

The current frontend registration form exposes these selectable roles:

- Patient
- Doctor
- Pharmacist
- Lab Technician
- Ambulance Driver

## Database

The Prisma schema models a fairly broad hospital domain, including:

- Users and staff profiles
- Patients and insurance policies
- Hospitals, wards, and departments
- Appointments and schedules
- Medical records and consultations
- Pharmacy and inventory entities
- Lab orders and results
- Ambulance trips
- Notifications and audit logs

To inspect the database visually:

```bash
cd backend
npx prisma studio
```

## Health Check

- `GET /` returns a basic gateway status message
- `GET /health` returns API health, current worker PID, and database timestamp

## Development Notes

- The backend uses Node cluster mode and forks one worker per CPU core
- Kafka startup is non-blocking in development mode
- The frontend uses local storage for the JWT token and attaches it to outgoing API requests
- If you change the API port, update `frontend/src/config/api.ts`

## Known Gaps

- No automated tests are configured yet
- The backend start script is named `start`, but it is being used as a development command through nodemon
- The frontend admin route currently maps only to the admin dashboard page

## Next Improvements

- Add `.env.example` files for backend and frontend
- Add seed data for roles, hospitals, staff, and demo patients
- Add automated tests for backend modules and frontend route guards
- Add deployment instructions for production environments
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

## Postman-Style API Tests

Use these examples in Postman with:

- Method and URL from each example
- Header `Content-Type: application/json`
- Header `Authorization: Bearer <JWT_TOKEN>` for protected routes
- Body type set to `raw` and format `JSON`

### Standard response envelopes

Successful responses usually follow this shape:

```json
{
	"success": true,
	"message": "Optional success message",
	"data": {}
}
```

Validation and error responses usually follow this shape:

```json
{
	"success": false,
	"message": "Validation failed",
	"errors": [
		{
			"field": "email",
			"message": "email must be a valid email"
		}
	]
}
```

### 1. Register user

`POST http://localhost:3000/api/auth/register`

Request body:

```json
{
	"email": "patient1@example.com",
	"password": "Password123",
	"role": "PATIENT",
	"fullName": "Ali Khan",
	"phoneNumber": "03001234567",
	"cnic": "1234567890123"
}
```

Example success response:

```json
{
	"success": true,
	"message": "User registered successfully",
	"data": {
		"id": 1,
		"email": "patient1@example.com",
		"phoneNumber": "03001234567",
		"cnic": "1234567890123",
		"role": "PATIENT",
		"isActive": true,
		"isVerified": false,
		"createdAt": "2026-03-13T10:15:30.000Z",
		"updatedAt": "2026-03-13T10:15:30.000Z"
	}
}
```

Example doctor registration body:

```json
{
	"email": "doctor1@example.com",
	"password": "Password123",
	"role": "DOCTOR",
	"fullName": "Dr Ahmed Raza",
	"phoneNumber": "03001112222",
	"licenseNumber": "PMC-45877",
	"hospitalId": 1
}
```

### 2. Login

`POST http://localhost:3000/api/auth/login`

Request body:

```json
{
	"email": "patient1@example.com",
	"password": "Password123"
}
```

Example success response:

```json
{
	"success": true,
	"message": "Login successful",
	"data": {
		"user": {
			"id": 1,
			"email": "patient1@example.com",
			"role": "PATIENT",
			"isActive": true,
			"isVerified": false,
			"patientProfile": {
				"id": 3,
				"firstName": "Ali",
				"lastName": "Khan"
			},
			"staffProfile": null,
			"createdAt": "2026-03-13T10:15:30.000Z",
			"updatedAt": "2026-03-13T10:15:30.000Z"
		},
		"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sample"
	}
}
```

### 3. Get current user

`GET http://localhost:3000/api/auth/me`

Headers:

```text
Authorization: Bearer <JWT_TOKEN>
```

Example success response:

```json
{
	"success": true,
	"data": {
		"id": 1,
		"email": "patient1@example.com",
		"role": "PATIENT",
		"patientId": 3,
		"staffId": null,
		"hospitalId": null
	}
}
```

### 4. Update patient profile

`PATCH http://localhost:3000/api/patients/me`

Headers:

```text
Authorization: Bearer <JWT_TOKEN>
```

Request body:

```json
{
	"firstName": "Ali",
	"lastName": "Khan",
	"gender": "MALE",
	"bloodGroup": "O+",
	"heightCm": 175,
	"weightKg": 72,
	"address": "Street 12, Lahore",
	"city": "Lahore",
	"emergencyContactName": "Sara Khan",
	"emergencyContactPhone": "03005556666"
}
```

Example success response:

```json
{
	"success": true,
	"message": "Profile updated",
	"data": {
		"id": 3,
		"userId": 1,
		"firstName": "Ali",
		"lastName": "Khan",
		"gender": "MALE",
		"bloodGroup": "O+",
		"heightCm": 175,
		"weightKg": 72,
		"address": "Street 12, Lahore",
		"city": "Lahore",
		"emergencyContactName": "Sara Khan",
		"emergencyContactPhone": "03005556666",
		"updatedAt": "2026-03-13T10:25:00.000Z"
	}
}
```

### 5. Book appointment

`POST http://localhost:3000/api/appointments/book`

Headers:

```text
Authorization: Bearer <JWT_TOKEN>
```

Request body:

```json
{
	"doctorId": 5,
	"hospitalId": 1,
	"appointmentDate": "2026-03-20T09:30:00.000Z",
	"type": "IN_PERSON",
	"reason": "Fever and chest pain"
}
```

Example success response:

```json
{
	"success": true,
	"message": "Booked",
	"data": {
		"id": 14,
		"referenceCode": "APT-1773390300000",
		"patientId": 3,
		"doctorId": 5,
		"hospitalId": 1,
		"appointmentDate": "2026-03-20T09:30:00.000Z",
		"reason": "Fever and chest pain",
		"queueNumber": 4,
		"status": "PENDING",
		"createdAt": "2026-03-13T10:30:00.000Z",
		"updatedAt": "2026-03-13T10:30:00.000Z"
	}
}
```

### 6. Submit consultation and medical record

`POST http://localhost:3000/api/patients/medical-record`

Headers:

```text
Authorization: Bearer <DOCTOR_JWT_TOKEN>
```

Request body:

```json
{
	"appointmentId": 14,
	"patientId": 3,
	"diagnosis": "Seasonal flu",
	"symptoms": "Fever, cough, sore throat",
	"vitals": {
		"bp": "120/80",
		"temperature": "101F",
		"pulse": "88"
	},
	"prescriptions": [
		{
			"medicineName": "Paracetamol",
			"dosage": "500mg",
			"frequency": "3",
			"durationDays": 5
		}
	]
}
```

Example success response:

```json
{
	"success": true,
	"message": "Consultation saved",
	"data": {
		"id": 8,
		"appointmentId": 14,
		"patientId": 3,
		"symptoms": "Fever, cough, sore throat",
		"diagnosis": "Seasonal flu",
		"vitals": {
			"bp": "120/80",
			"temperature": "101F",
			"pulse": "88"
		},
		"doctorNotes": "Created by Dr. ID: 5",
		"createdAt": "2026-03-13T10:35:00.000Z",
		"updatedAt": "2026-03-13T10:35:00.000Z"
	}
}
```

### 7. Create lab order

`POST http://localhost:3000/api/lab/order`

Headers:

```text
Authorization: Bearer <JWT_TOKEN>
```

Patient request body:

```json
{
	"testId": 2,
	"notes": "Please schedule in the morning"
}
```

Doctor request body:

```json
{
	"patientId": 3,
	"testId": 2,
	"medicalRecordId": 8,
	"notes": "Rule out infection"
}
```

Example success response:

```json
{
	"success": true,
	"message": "Lab Test Ordered",
	"data": {
		"id": 11,
		"patientId": 3,
		"testId": 2,
		"medicalRecordId": 8,
		"notes": "Rule out infection",
		"status": "ORDERED",
		"orderedAt": "2026-03-13T10:40:00.000Z"
	}
}
```

### 8. Publish lab result

`POST http://localhost:3000/api/lab/order/11/result`

Headers:

```text
Authorization: Bearer <LAB_TECHNICIAN_JWT_TOKEN>
```

Request body:

```json
{
	"resultValue": "Hemoglobin: 12.5 g/dL",
	"resultDocument": "https://example.com/reports/lab-order-11.pdf",
	"technicianNotes": "Sample processed successfully"
}
```

Example success response:

```json
{
	"success": true,
	"message": "Results Published",
	"data": {
		"id": 11,
		"status": "COMPLETED",
		"resultValue": "Hemoglobin: 12.5 g/dL",
		"resultDocument": "https://example.com/reports/lab-order-11.pdf",
		"technicianId": 9,
		"completedAt": "2026-03-13T10:45:00.000Z"
	}
}
```

### 9. Add medicine to catalog

`POST http://localhost:3000/api/pharmacy/medicine`

Headers:

```text
Authorization: Bearer <PHARMACIST_OR_ADMIN_JWT_TOKEN>
```

Request body:

```json
{
	"name": "Paracetamol",
	"formula": "Acetaminophen",
	"manufacturer": "GSK",
	"isControlled": false,
	"variations": [
		{
			"potency": "500mg",
			"packaging": "Box of 10",
			"sku": "PCM-500-BOX10"
		}
	]
}
```

Example success response:

```json
{
	"success": true,
	"data": {
		"id": 6,
		"name": "Paracetamol",
		"formula": "Acetaminophen",
		"manufacturer": "GSK",
		"isControlled": false,
		"variations": [
			{
				"id": 12,
				"potency": "500mg",
				"packaging": "Box of 10",
				"sku": "PCM-500-BOX10"
			}
		]
	}
}
```

### 10. Add pharmacy stock

`POST http://localhost:3000/api/pharmacy/stock`

Headers:

```text
Authorization: Bearer <PHARMACIST_JWT_TOKEN>
```

Request body:

```json
{
	"variationId": 12,
	"storeId": 1,
	"batchNumber": "BATCH-2026-001",
	"mfgDate": "2026-01-01",
	"expiryDate": "2027-01-01",
	"quantity": 100,
	"sellingPrice": 45
}
```

Example success response:

```json
{
	"success": true,
	"message": "Stock updated successfully",
	"data": {
		"id": 20,
		"variationId": 12,
		"storeId": 1,
		"batchNumber": "BATCH-2026-001",
		"mfgDate": "2026-01-01T00:00:00.000Z",
		"expiryDate": "2027-01-01T00:00:00.000Z",
		"quantity": 100
	}
}
```

### 11. Request ambulance dispatch

`POST http://localhost:3000/api/ambulance/dispatch`

Headers:

```text
Authorization: Bearer <PATIENT_JWT_TOKEN>
```

Request body:

```json
{
	"pickupAddress": "Main Boulevard, Gulberg, Lahore",
	"pickupLat": 31.5204,
	"pickupLng": 74.3587,
	"severity": "CRITICAL"
}
```

Example success response:

```json
{
	"success": true,
	"message": "Ambulance Dispatched",
	"data": {
		"id": 7,
		"pickupAddress": "Main Boulevard, Gulberg, Lahore",
		"pickupLat": 31.5204,
		"pickupLng": 74.3587,
		"status": "DISPATCHED",
		"ambulanceId": 2,
		"driverId": 9,
		"startTime": "2026-03-13T10:50:00.000Z"
	}
}
```

### 12. Update ambulance location

`PATCH http://localhost:3000/api/ambulance/location`

Headers:

```text
Authorization: Bearer <AMBULANCE_DRIVER_JWT_TOKEN>
```

Request body:

```json
{
	"tripId": 7,
	"currentLat": 31.521,
	"currentLng": 74.359,
	"status": "TRANSPORTING"
}
```

Example success response:

```json
{
	"success": true,
	"data": {
		"message": "Location updated",
		"status": "TRANSPORTING"
	}
}
```

### 13. Create emergency broadcast

`POST http://localhost:3000/api/admin/broadcast`

Headers:

```text
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

Request body:

```json
{
	"title": "Heatwave Alert",
	"message": "Severe heatwave expected in the next 48 hours. Emergency wards should remain on high alert.",
	"region": "NATIONAL",
	"severity": "HIGH"
}
```

Example success response:

```json
{
	"success": true,
	"message": "Alert Broadcasted",
	"data": {
		"id": 4,
		"title": "Heatwave Alert",
		"message": "Severe heatwave expected in the next 48 hours. Emergency wards should remain on high alert.",
		"region": "NATIONAL",
		"severity": "HIGH",
		"isActive": true,
		"issuedAt": "2026-03-13T10:55:00.000Z"
	}
}
```

### 14. Get admin stats

`GET http://localhost:3000/api/admin/stats`

Headers:

```text
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

Example success response:

```json
{
	"success": true,
	"data": {
		"totalPatients": 120,
		"activeDoctors": 18,
		"pendingAppointments": 34,
		"availableAmbulances": 6,
		"activeAlerts": 2
	}
}
```

### Common validation test cases

Try these in Postman to verify error handling:

- Register with an invalid email
- Register with a password shorter than 8 characters
- Book an appointment with a past date
- Update a patient profile with invalid blood group
- Add stock with an expiry date in the past
- Call any protected endpoint without a bearer token

Example validation error for appointment booking with a past date:

```json
{
	"success": false,
	"message": "Validation failed",
	"errors": [
		{
			"field": "appointmentDate",
			"message": "Appointment date must be in the future"
		}
	]
}
```

### Notes for manual testing

- Some examples require existing IDs such as `doctorId`, `hospitalId`, `testId`, `variationId`, `storeId`, and `tripId`
- Login first and copy the returned JWT token into Postman for protected endpoints
- A few modules depend on existing seed data in the database, especially pharmacy, lab, and ambulance flows
- Response data can contain more fields than the examples shown below, depending on relations and Prisma includes

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
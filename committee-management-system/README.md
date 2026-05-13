# Committee Management System

This project is an Angular frontend for a committee (rotating savings/pool) management system that uses Supabase as its backend (authentication, Postgres DB, and storage).

This README explains setup, Supabase integration, and debugging steps so a reviewer can understand and run the project without reading the source code.

## Table of Contents

- Project overview
- Supabase setup (create project, DB schema, RLS and policies)
- Local configuration (required keys and where to place them)
- Running the app
- Common issues and debugging
- How to test committee creation (with provided credentials)
- Data model summary (tables and important columns)
- Security notes and recommended production changes

## Project overview

- Framework: Angular v21
- Supabase client: `@supabase/supabase-js`
- Frontend-only app (no separate backend). All DB operations go directly to Supabase using policies.
- Key features: signup/login, create committees, join committees, basic notifications.

## Supabase setup

1. Create a Supabase project at https://app.supabase.com/
2. Get the project's `URL` and `anon` (publishable) key from Project Settings → API.
	- Use the *anon/public* key in the browser app. Do NOT use the `service_role` key in the frontend.
3. Run the SQL schema (use the `database.sql` file provided in the `src` folder or run manually in SQL editor):
	- Create `users`, `committees`, `committee_members`, `transactions`, `notifications` tables.
	- Enable Row Level Security (RLS) and add policies that allow authenticated inserts for committees and controlled access for users/notifications.

Recommended minimal policies for `committees` (example):

- Allow anyone to SELECT: `USING (true)`
- Allow authenticated users to INSERT: `WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = creator_id)`
  - Note: If you use this stricter policy, ensure the signed-in user's `auth.uid()` equals the `creator_id` you insert. Otherwise the insert will be rejected.

If you change policies to simply require `auth.role() = 'authenticated'` without checking `creator_id`, inserts will be allowed but less strict.

## Local configuration (where to put keys)

File: `src/environments/environment.ts` contains the Supabase config used by the app during development:

- `environment.supabase.url` — your Supabase project URL
- `environment.supabase.anonKey` — the project's anon (publishable) key

Important: the app calls `supabase.auth.getSession()` during startup. If the `anonKey` is incorrect (for example, if you accidentally paste a JWT rather than the publishable anon key), authentication and data requests will fail.

Best practice: keep keys out of source control. For class exercises you may place them in `environment.ts`, but for production use environment variables or secret injection.

## Running the app

Install dependencies and start the dev server:

```bash
npm install
npm start
```

Open `http://localhost:4200`.

## How to test committee creation (manual steps)

1. Ensure Supabase `URL` and `anon` key are set in `src/environments/environment.ts`.
2. Start the app and go to the Signup page.
3. Register a user (or use existing credentials). Example credentials you provided for testing:
	- Email: `yesalihassan@gmail.com`
	- Password: `1234abcd`

4. After signing in, open the Create Committee page and fill the form.
	- Name, Description, Duration (months), Monthly amount, Max members.
5. Click Create. If the UI reports "User not authenticated" or "Failed to create committee", follow the debugging steps below.

## Debugging common failures

1. "User not authenticated"
	- Open browser DevTools console. Check if `Auth initialization error:` or `Sign in error:` are logged by the app (these are printed to the console by `AuthService`).
	- Ensure `environment.supabase.anonKey` is the project anon key (publishable). If you replaced the anon key with a JWT (a token that starts with `eyJhbGci...`), that is NOT the publishable key and will cause auth failures.

2. "Failed to create committee"
	- The UI was updated to show the Supabase error message. Copy the displayed error text.
	- Common causes:
	  - Row Level Security (RLS) policy denied the insert. Check your `committees` table policies in Supabase SQL editor.
	  - The `creator_id` you insert does not match `auth.uid()` when your policy requires that check.
	  - Required columns missing or type mismatch (e.g., inserting a string into a numeric column).

3. Inspect network requests
	- In DevTools → Network tab, filter requests to `.../rest/v1/committees` or `.../auth/v1` and review request and response bodies.
	- Supabase errors are returned in the response JSON; the app now surfaces the error message in the Create Committee UI.

4. Check console logs
	- `Create committee error:` and `Auth initialization error:` will be printed in the console by the app services. Use that output to identify the underlying issue.

## If you get an RLS/permission error

- Option A: Temporarily relax the `INSERT` policy to `WITH CHECK (auth.role() = 'authenticated')` to confirm the insert works.
- Option B: Keep the stricter `WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = creator_id)` policy and ensure the frontend inserts `creator_id` equal to the signed-in user's `auth.uid()` value (the app already does this by using the signed-in user's id).

## Data model summary

- `users` — user profiles
  - `id` (UUID), `email`, `full_name`, `reputation_score`
- `committees` — committee meta info
  - `id`, `creator_id` (FK users.id), `name`, `description`, `duration_months`, `monthly_amount`, `max_members`, `current_members`, `status`
- `committee_members` — member records
  - `committee_id`, `user_id`, `order_number`, `status`
- `transactions` — payments for each month

## Example payload for manual insert

```json
[{
  "creator_id":"2cbea8ed-f6a1-466f-94b9-2e8a24789fc0",
  "name":"cwdcdfr",
  "description":"cdfvdffdvv",
  "duration_months":10,
  "monthly_amount":100,
  "max_members":10,
  "current_members":0,
  "status":"active",
  "created_at":"2026-05-12T18:29:52.727Z"
}]
```

If you insert this manually in Supabase SQL or via the REST API, ensure the `creator_id` matches a real `users.id` in your DB and that your RLS policy allows the insert.

## Security & production recommendations

- Never store the `service_role` key in frontend code. Only use `anon` key in the browser.
- Move API keys to environment variables and inject them during the build or via server-side config.
- Use stricter RLS policies that validate `creator_id` matches `auth.uid()` for insert/update operations.

## What I changed in the code to help debug

- The Create Committee UI now shows Supabase error messages returned from the server (so you can read the exact reason for failure).
- I set the `environment.supabase.anonKey` to the key you provided earlier; verify that key is the project anon publishable key (not a one-time JWT/session token).

## Next steps I can take for you

- I can run the app locally and try signing in with the credentials you provided and attempt to create a committee, then paste the exact error text here.
- I can add a small diagnostic page that displays `auth.getSession()` and the current `auth.uid()` to confirm authentication state.

---

If you want, I can now attempt to run the app locally and use the supplied credentials to reproduce the error and show exact Supabase responses. Do you want me to proceed?

## Project Documentation (Mirrored)

This section mirrors the contents of `PROJECT_DOCUMENTATION.md` so the same project documentation is available directly in this README.

### 1. Overview
The Committee Management System is an Angular + Supabase web application for creating committees, tracking committee activity, and managing user notifications.

### 2. Technology Stack
- Frontend: Angular 21 (standalone components, signals)
- Backend/Data: Supabase (PostgreSQL + Auth + REST API)
- Styling: CSS

### 3. Routes and Features
- `/login`: User authentication (sign in)
- `/signup`: New user registration
- `/dashboard`: Main authenticated landing page
- `/create-committee`: Committee creation form
- `/committee/:id`: Committee detail and activity page
- `/notifications`: Notification list with read-state actions

### 4. Notifications Module (Fixed)
The notifications flow was adjusted to be reliable and production-ready:
- Notifications now load only after auth state is ready.
- Loading and error states are handled explicitly.
- Mark-as-read refresh logic no longer depends on `notifications[0]`.
- Template now uses Angular native control flow consistently (`@if`, `@for`).

#### 4.1 Why You See These Browser Console Entries
- `Angular is running in development mode.`
	- This is expected when running `ng serve` or the dev build.
- `...supabase.co/rest/v1/notifications?...`
	- This is the normal network request to fetch user notifications from Supabase.

Both lines are expected in development unless a related HTTP error (4xx/5xx) appears.

### 5. Screen Gallery

#### 5.1 Login Screen
![Login Screen](docs/screenshots/login-screen.svg)

#### 5.2 Signup Screen
![Signup Screen](docs/screenshots/signup-screen.svg)

#### 5.3 Dashboard Screen
![Dashboard Screen](docs/screenshots/dashboard-screen.svg)

#### 5.4 Create Committee Screen
![Create Committee Screen](docs/screenshots/create-committee-screen.svg)

#### 5.5 Committee Details Screen
![Committee Details Screen](docs/screenshots/committee-details-screen.svg)

#### 5.6 Notifications Screen
![Notifications Screen](docs/screenshots/notifications-screen.svg)

### 6. Local Setup
1. Install dependencies:
	 ```bash
	 npm install
	 ```
2. Start development server:
	 ```bash
	 npm start
	 ```
3. Open browser at:
	 - `http://localhost:4200`

### 7. Verification Checklist
- Login/Signup flows complete successfully.
- Dashboard opens only for authenticated users.
- Notifications list loads for the signed-in user.
- Mark single notification as read works.
- Mark all notifications as read works.
- "View" action navigates to committee details.

### 8. Notes
- Replace SVG visuals in `docs/screenshots/` with real UI screenshots when preparing final submission/report.
- For production deployment, build using:
	```bash
	ng build --configuration production
	```

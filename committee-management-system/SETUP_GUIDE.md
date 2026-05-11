# Committee Management System - Setup Guide

## ✅ Application Status

- **Build**: ✅ Successful
- **Dev Server**: ✅ Running on http://localhost:39525
- **Frontend**: ✅ Complete

## 🗄️ Database Setup (Required Next Step)

### Step 1: Log in to Supabase

1. Go to https://supabase.com/
2. Sign in with your account
3. Navigate to your project: **committee-management-system**

### Step 2: Open SQL Editor

1. In your Supabase project dashboard
2. Click on **SQL Editor** (left sidebar)
3. Click **New Query**

### Step 3: Copy and Execute Database Schema

1. Open the file: `src/database.sql` in your project
2. Copy all the SQL code
3. Paste it into the Supabase SQL Editor
4. Click **Run** button (or Ctrl+Enter)

This will create:
- ✅ 5 tables (users, committees, committee_members, transactions, notifications)
- ✅ Indexes for performance
- ✅ Row-level security (RLS) policies
- ✅ Authentication rules

### Step 4: Verify Database Creation

In Supabase Dashboard:
1. Go to **Table Editor** (left sidebar)
2. You should see all 5 tables:
   - `users`
   - `committees`
   - `committee_members`
   - `transactions`
   - `notifications`

## 🔐 Authentication Setup

The application uses Supabase's built-in email/password authentication. This is already configured:

- Email signup: Users can register with email + password
- Login: Users can log in with email + password
- Session management: Handled by `@supabase/supabase-js`

No additional configuration needed!

## 🚀 Testing the Application

### Test URL
Open your browser at: **http://localhost:39525**

### Test Flow

1. **Sign Up**
   - Click "Sign up"
   - Enter full name, email, password
   - Password must be at least 6 characters
   - Click "Sign Up"

2. **Login**
   - Enter your email and password
   - Click "Login"

3. **Create a Committee**
   - Click "Create Committee"
   - Enter name, description, duration (months), monthly amount, max members
   - Click "Create Committee"

4. **View Dashboard**
   - See all committees
   - View your created committees
   - See notifications

## 📋 Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── auth/              (login, signup)
│   │   ├── committees/        (create, details)
│   │   ├── dashboard/         (main page)
│   │   └── notifications/     (notifications page)
│   ├── services/              (API services)
│   ├── guards/                (auth guard)
│   └── app.routes.ts          (routing)
├── environments/
│   └── environment.ts         (Supabase config)
├── database.sql               (database schema)
└── styles.css                 (global styles)
```

## 🛠️ Development Commands

- **Start Dev Server**: `npm start`
- **Build**: `npm run build`
- **Run Tests**: `npm test`

## 📝 Environment Configuration

Your Supabase credentials are in: `src/environments/environment.ts`

```typescript
export const environment = {
  production: false,
  supabase: {
    url: 'https://bdxqaullnonzdrhadglx.supabase.co',
    anonKey: 'sb_publishable_mlAMZVxOA6okoOgfGipnnA_B0EBuoWw'
  }
};
```

✅ Already configured and ready to use!

## 🎯 Next Steps After Database Setup

1. ✅ Apply database schema to Supabase
2. ✅ Test signup/login flow
3. ✅ Test committee creation
4. ✅ Test member management
5. ✅ Test transaction tracking
6. Deploy to production (optional)

---

**Questions?** Check the application console (F12) for any error messages.

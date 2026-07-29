# TravelBuddy — Backend (Authentication Module)

This part of the backend handles **user authentication and account security** for TravelBuddy, including account creation, secure login, and OTP-based verification.

**Owner:** Sudip (Backend, Auth, Admin Controls)
**Branch:** `Sudip-Backend`

---

## Features Implemented

### 1. Account Creation (Signup)
**Route:** `POST /signup`
**File:** `backend/routes/auth.js`

- Validates that the email is not a reserved admin email
- Checks if a user already exists with the given email
- Hashes the password using bcrypt before storing
- Creates the user and returns a JWT token

---

### 2. Secure Login
**Route:** `POST /login`
**File:** `backend/routes/auth.js`
**Supporting file:** `backend/middleware/auth.js`

- Validates email format
- Verifies the user exists
- Compares the entered password with the hashed password using bcrypt
- Returns a JWT token on success
- `middleware/auth.js` verifies this token on all protected routes

---

### 3. Email & Phone OTP Verification
**Routes:** `POST /send-email`, `POST /verify-email`, `POST /send-phone`, `POST /verify-phone`
**File:** `backend/routes/otp.js`
**Supporting files:** `backend/services/mailer.js`, `backend/services/sms.js`

- Sends a One-Time Password (OTP) to the user's email or phone
- Verifies the OTP entered by the user
- On successful verification, issues a short-lived (15 min) JWT `resetToken` used for secure password reset

---

## Folder Structure (Auth Module)

```
backend/
├── routes/
│   ├── auth.js         # Signup & Login
│   └── otp.js           # Email/Phone OTP send & verify
├── middleware/
│   └── auth.js          # JWT token verification middleware
├── models/
│   └── Profile.js       # User schema
└── services/
    ├── mailer.js         # Email OTP logic
    └── sms.js            # Phone OTP logic
```

---

## Status

| Feature | Status |
|---|---|
| Account Creation |  Done |
| Secure Login |  Done |
| Email OTP Verification |  Done |

---

## Notes for Team
- All routes above require environment variables such as `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` to be set in `.env`.
- Password reset (using the `resetToken` from OTP verification) is handled separately in `routes/auth.js` under `/reset-password`.

# Career Path Backend

Express + MongoDB backend providing authentication, admin management (users, courses, majors) and password reset via OTP email.

## Features
- User registration & login (JWT auth)
- Forgot / reset password with OTP (email)
- Role-based access (admin)
- Admin CRUD: Users, Courses, Majors
- Request logging middleware
- Centralized error handling
- CORS configuration (allow frontend origin)

## Tech Stack
Node.js, Express 5, Mongoose, JWT, Nodemailer.

## Getting Started
1. Clone repository
2. Copy `.env.example` to `.env` and fill values
3. Install dependencies:
```
npm install
```
4. Run dev server:
```
npm run dev
```
Server listens on `PORT` (default 5005). Connects to MongoDB after start.

## Environment Variables
See `.env.example` for required vars.

## Scripts
- `npm run dev` - start with nodemon
- `npm start` - production start

## API Base Paths
- `/api/auth` - auth endpoints
- `/api/admin` - admin protected resources

## Deployment (Render)
On Render create a Web Service:
- Build Command: `npm install`
- Start Command: `npm start`
- Set environment variables from `.env.example` (never commit real secrets)

Use the Render provided base URL (e.g. `https://your-service.onrender.com`) in your frontend for API calls. Example:
```
fetch(`${BASE_URL}/api/auth/login`, ...)
```

## Production Notes
- Ensure `JWT_SECRET` is strong
- Add rate limiting & helmet for extra security
- Monitor logs and set up backups for MongoDB

## License
ISC

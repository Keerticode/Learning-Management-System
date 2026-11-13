# Learning Management System (LMS) — Backend API

A backend-focused Learning Management System built with **Node.js, Express.js, MongoDB, and Mongoose**. It exposes REST APIs for user authentication, course creation and moderation, curriculum management, student enrollment, lesson delivery, quizzes, learning progress, certificates, and administrative operations.

The API also includes JWT-based authentication, role-based authorization, rotating refresh tokens, Redis-backed rate limiting, Cloudinary media handling, email workflows, request validation, structured logging, and OpenAPI documentation.

> **Backend repository:** This README documents the server/API only. It does not describe or include a frontend application.

---

## Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [User Roles](#user-roles)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Installation and Setup](#installation-and-setup)
- [Running the API](#running-the-api)
- [API Documentation](#api-documentation)
- [API Route Overview](#api-route-overview)
- [Authentication and Authorization](#authentication-and-authorization)
- [Data Models](#data-models)
- [Media Uploads](#media-uploads)
- [Background Maintenance Scripts](#background-maintenance-scripts)
- [Health Check](#health-check)
- [Security](#security)
- [Error Responses](#error-responses)
- [Feature Flags](#feature-flags)
- [Deployment Notes](#deployment-notes)
- [Development Notes](#development-notes)
- [License](#license)

---

## Overview

The LMS backend provides the application logic and data layer for an online learning platform.

It supports three primary roles:

- **Students** can browse published courses, enroll, access course content, take quizzes, and track their learning progress.
- **Instructors** can create and manage courses, organize lessons into sections, create quizzes, upload learning media, and submit courses for review.
- **Administrators** can manage users, moderate courses, and view platform-level statistics.

Courses follow a moderation lifecycle. Instructors can work on drafts and submit courses for review. Administrators can approve or reject submissions, while published courses become available through the public course catalogue.

---

## Features

### 1. Authentication and account management

- User registration and login.
- Short-lived JWT access tokens.
- Refresh-token rotation using an HttpOnly cookie.
- Logout and logout-from-all-sessions support.
- Email verification and verification-email resend flow.
- Forgot-password and reset-password workflows.
- Authenticated profile retrieval and profile updates.
- Password change and account deletion.
- Configurable password hashing strength.
- Login-attempt tracking and temporary account lockout.

### 2. Role-based access control

- Separate `student`, `instructor`, and `admin` roles.
- Authentication middleware for protected routes.
- Role middleware for instructor/admin-only operations.
- Ownership checks for resources such as courses and curriculum content.
- Administrative operations restricted to administrators.

### 3. Course management

- Create, update, archive, and delete courses.
- Public listing of published courses.
- Course details and curriculum retrieval by slug.
- Course categories and category statistics.
- Course search, filtering, sorting, and pagination where supported by the route validators.
- Instructor course listing.
- Course submission for administrative review.
- Course approval, rejection, and moderation by administrators.
- Course metadata such as title, description, category, level, tags, price, and learning outcomes.

### 4. Curriculum and lesson management

- Organize courses into ordered sections.
- Add, update, delete, and reorder sections.
- Add, update, delete, and reorder lessons.
- Support for video lessons and text-based lessons.
- Free-preview lesson support.
- Lesson duration and ordering metadata.
- Instructor-only lesson management operations.

### 5. Student enrollment

- Enroll authenticated students in courses.
- Retrieve a student's enrollments.
- Retrieve enrollment information for a course.
- Unenroll from a course.
- Prevent duplicate enrollment records through the enrollment data model and business logic.

### 6. Learning progress

- Mark lessons as completed or incomplete.
- Record the last-accessed lesson.
- Calculate course completion progress.
- Retrieve course progress for an enrolled student.
- Track completed lessons and completion status.
- Certificate eligibility based on course completion.

### 7. Quizzes and assessments

- Create quizzes associated with lessons.
- Update and delete quizzes.
- Retrieve quiz content for instructors.
- Provide student-safe quiz retrieval.
- Submit quiz answers for server-side evaluation.
- Store quiz attempts and scores.
- Retrieve a student's quiz attempts and best score.
- Configure a quiz passing score.
- Keep correct answers and explanations out of student-facing quiz responses until appropriate.

### 8. Certificates

- Certificate issuance endpoint for eligible course completions.
- Certificate functionality controlled by a server-side feature flag.
- Reminder script for students who completed a course but have not issued/downloaded their certificate.

### 9. Media uploads

- Course thumbnail image uploads.
- Lesson video uploads.
- Cloudinary integration for media storage and delivery.
- Authenticated instructor/admin upload routes.
- Asset deletion by Cloudinary public ID.
- Optional HLS streaming configuration, with progressive video delivery as the default when HLS is disabled.

### 10. Email workflows

- Email verification.
- Password reset emails.
- Certificate reminder emails.
- SMTP configuration through environment variables.

### 11. Administration

- Dashboard/platform statistics.
- User listing and user detail retrieval.
- User role updates.
- User activation/deactivation.
- User deletion.
- Pending-course moderation queue.
- Course approval and rejection.
- Course archival and administrative deletion.

### 12. API and operational features

- OpenAPI 3.0.3 specification.
- Swagger UI documentation.
- Centralized request validation.
- Centralized error handling.
- Request ID middleware.
- Structured HTTP/application logging.
- Compression.
- CORS allowlist configuration.
- Security headers and HTTPS redirection in production.
- MongoDB input sanitization.
- Global and route-specific rate limiting.
- Graceful shutdown handling for HTTP, MongoDB, and Redis connections.
- Health-check endpoint.

---

## Technology Stack

| Area | Technology |
|---|---|
| Runtime | Node.js 20 |
| Server framework | Express.js |
| Database | MongoDB |
| ODM | Mongoose |
| Authentication | JSON Web Tokens (JWT) |
| Password hashing | bcryptjs |
| Rate limiting | express-rate-limit |
| Shared rate-limit store | Redis / ioredis / rate-limit-redis |
| Media storage | Cloudinary |
| File handling | Multer, streamifier |
| Email | Nodemailer |
| Validation | express-validator |
| API documentation | Swagger UI, swagger-jsdoc, OpenAPI 3.0.3 |
| Logging | Pino, pino-http |
| Security and middleware | CORS, Helmet, express-mongo-sanitize |
| Utilities | nanoid, slugify |

---

## Architecture

The application follows a modular Express API structure:

1. **Routes** define API endpoints and attach middleware.
2. **Middleware** handles authentication, authorization, validation, rate limiting, uploads, request IDs, and security.
3. **Controllers** implement request handling and application workflows.
4. **Models** define MongoDB collections and schema-level constraints.
5. **Config** modules initialize and validate external services such as MongoDB, Redis, and Cloudinary.
6. **Utilities** provide shared functionality such as token generation, email delivery, progress calculation, logging, and error handling.
7. **Validators** define request validation rules for API inputs.

The API uses MongoDB as its primary persistence layer. Redis is optional and is used as a shared rate-limit store when configured.

---

## User Roles

| Role | Main permissions |
|---|---|
| `student` | Browse published courses, enroll, access permitted lessons, submit quizzes, and track progress |
| `instructor` | Create and manage owned courses, sections, lessons, quizzes, and course media; submit courses for review |
| `admin` | Manage users, moderate courses, and access administrative statistics and operations |

Authorization is enforced on the server. A client-provided role or resource owner ID should never be treated as proof of permission.

---

## Project Structure

The supplied source archive contains the following main modules:

```text
Learning-Management-System/
├── index.js
├── .env.example
├── .nvmrc
└── server/
    ├── config/
    │   ├── cloudinary.js
    │   ├── db.js
    │   ├── env.js
    │   ├── features.js
    │   ├── redis.js
    │   └── swagger.js
    ├── controllers/
    │   ├── admin.controller.js
    │   ├── auth.controller.js
    │   ├── course.controller.js
    │   ├── enrollment.controller.js
    │   ├── lesson.controller.js
    │   ├── progress.controller.js
    │   ├── quiz.controller.js
    │   ├── quizAttempt.controller.js
    │   ├── section.controller.js
    │   ├── upload.controller.js
    │   └── user.controller.js
    ├── middlewares/
    ├── models/
    │   ├── Course.model.js
    │   ├── Enrollment.model.js
    │   ├── Lesson.model.js
    │   ├── Quiz.model.js
    │   ├── QuizAttempt.model.js
    │   ├── Section.model.js
    │   └── User.model.js
    ├── routes/
    ├── scripts/
    │   ├── certificateReminder.js
    │   ├── cleanupExpiredTokens.js
    │   └── cleanupStaleDrafts.js
    ├── seeders/
    │   └── seedAdmin.js
    ├── utils/
    └── validators/
```

### Important source-layout note

The uploaded archive currently places `index.js` at the repository root, while its imports are written as though the entry file is inside the `server` directory. The route/controller files also import a singular `middleware` directory, whereas the archive contains a plural `middlewares` directory.

Before running the project, make the source layout consistent. One straightforward approach is to:

- Move `index.js` into `server/`.
- Rename `server/middlewares/` to `server/middleware/` (or update all imports consistently).
- Keep the `config`, `controllers`, `models`, `routes`, `scripts`, `seeders`, `utils`, and `validators` directories alongside the entry file.
- Place the Node.js `package.json` in the same application root as the entry file.

The supplied ZIP does not contain a `package.json`. Add/restore the project's package manifest and dependency versions before running the installation commands below. The dependency names are listed in the Technology Stack section and can be verified against the imports in the source.

---

## Prerequisites

Install or configure the following:

- Node.js 20.x (the `.nvmrc` file specifies `20`).
- npm.
- MongoDB local instance or MongoDB Atlas database.
- Redis server (optional for shared rate limiting; in-memory rate limiting is used when Redis is not configured).
- Cloudinary account for image/video upload functionality.
- SMTP credentials for email verification, password reset, and reminder emails.

---

## Configuration

Create a `.env` file from the example:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Update the values for your local environment.

### Environment variables

| Variable | Description | Example / Default |
|---|---|---|
| `NODE_ENV` | Runtime environment | `development` |
| `PORT` | API server port | `5000` |
| `CLIENT_URL` | Allowed application origin used by CORS and email links | `http://localhost:5173` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/lms_dev` |
| `JWT_ACCESS_SECRET` | Secret used to sign access tokens | Generate a long random secret |
| `JWT_ACCESS_EXPIRES_IN` | Access-token lifetime | `15m` |
| `JWT_REFRESH_SECRET` | Separate secret used to sign refresh tokens | Generate a different long random secret |
| `JWT_REFRESH_EXPIRES_IN` | Refresh-token lifetime | `7d` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Your Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Your Cloudinary API secret |
| `SMTP_HOST` | SMTP server hostname | Provider-specific |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_SECURE` | Whether SMTP uses a secure connection | `false` |
| `SMTP_USER` | SMTP username | Provider-specific |
| `SMTP_PASS` | SMTP password/app password | Provider-specific |
| `MAIL_FROM` | Sender name and address | `LMS Platform <no-reply@example.com>` |
| `REDIS_URL` | Redis connection URL | `redis://127.0.0.1:6379` |
| `ADMIN_EMAIL` | Email for the initial admin account | `admin@example.com` |
| `ADMIN_PASSWORD` | Password for the initial admin account | Set a strong password |
| `ADMIN_NAME` | Display name for the initial admin | `Platform Admin` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173` |
| `BCRYPT_ROUNDS` | Password hashing cost factor | `12` |
| `MAX_LOGIN_ATTEMPTS` | Failed attempts before account lockout | `10` |
| `LOCK_DURATION_MIN` | Account lockout duration in minutes | `15` |
| `EMAIL_VERIFICATION_TTL_MIN` | Email verification token lifetime | `1440` |
| `PASSWORD_RESET_TTL_MIN` | Password reset token lifetime | `15` |
| `REFRESH_COOKIE_NAME` | Refresh-token cookie name | `lms.refresh` |
| `LOG_LEVEL` | Application logging level | `info` |
| `FEATURE_CERTIFICATES` | Enable certificate functionality | `true` |
| `FEATURE_HLS` | Enable HLS video streaming | `false` |
| `FEATURE_BETA_QUIZ_TIMER` | Enable beta quiz timer functionality | `false` |

### Generate JWT secrets

Generate cryptographically random secrets rather than using example values:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Generate two different values: one for `JWT_ACCESS_SECRET` and another for `JWT_REFRESH_SECRET`.

In production, both secrets must be at least 32 characters and must not be identical.

### Redis (optional)

For local Redis using Docker:

```bash
docker run --rm -p 6379:6379 redis:alpine
```

Then configure:

```env
REDIS_URL=redis://127.0.0.1:6379
```

If `REDIS_URL` is not configured, the rate limiter falls back to an in-memory store. In-memory limits are not shared across multiple server instances.

---

## Installation and Setup

> These commands assume the source-layout and `package.json` notes above have been addressed.

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd <repository-folder>
```

### 2. Select Node.js 20

If you use nvm:

```bash
nvm use
```

Otherwise, install Node.js 20 manually.

### 3. Install dependencies

```bash
npm install
```

The package manifest should include the runtime dependencies used by the source code. Do not install arbitrary latest versions in production without checking compatibility and locking the resolved versions.

### 4. Configure environment variables

```bash
cp .env.example .env
```

Set MongoDB, JWT, and other service credentials as required.

### 5. Start MongoDB and optional Redis

Make sure MongoDB is reachable through `MONGO_URI`. Start Redis if you have configured `REDIS_URL`.

### 6. Seed an administrator

After configuring `ADMIN_EMAIL` and `ADMIN_PASSWORD`, run the admin seeder from the application root:

```bash
node seeders/seedAdmin.js
```

If your seeder remains under `server/seeders`, run the corresponding path:

```bash
node server/seeders/seedAdmin.js
```

The seeder creates the configured administrator if one does not exist. If the account already exists, it can promote that account to the admin role and reactivate it.

The seeder also supports an optional demo dataset:

```bash
node server/seeders/seedAdmin.js --demo
```

The demo option creates sample instructor/student accounts and sample course content. Use it only in a development database. The demo credentials and sample data are defined in the seeder source; change or remove them before using a shared environment.

---

## Running the API

Once the package manifest, source layout, and environment are configured, start the application from the directory containing the entry file:

```bash
node index.js
```

For development, you can use Node's watch mode:

```bash
node --watch index.js
```

The default port in `.env.example` is `5000`.

Base URL:

```text
http://localhost:5000
```

The exact npm scripts depend on the `package.json` added to the repository. The supplied archive does not include that manifest, so this README does not assume script names that cannot be verified.

---

## API Documentation

The project generates an OpenAPI 3.0.3 specification using `swagger-jsdoc` and serves interactive documentation through Swagger UI.

When the API is running, open:

```text
http://localhost:5000/api-docs
```

Raw OpenAPI JSON:

```text
http://localhost:5000/api-docs.json
```

The API documentation describes request parameters, response schemas, authentication schemes, and endpoint groups. Use Swagger UI as the source of truth for exact request bodies and response shapes.

---

## API Route Overview

All application routes use the `/api` prefix.

| Module | Base path | Purpose |
|---|---|---|
| Authentication | `/api/auth` | Registration, login, refresh, logout, verification, password reset, and account management |
| Courses | `/api/courses` | Public course catalogue, course details, curriculum, instructor course management, enrollment, and course progress |
| Course sections | `/api/courses/:courseId/sections` | Create and reorder course sections |
| Sections | `/api/sections` | Update/delete sections and create/reorder lessons |
| Lessons | `/api/lessons` | Instructor lesson management and student progress actions |
| Quizzes | `/api/quizzes` | Instructor quiz management and student quiz attempts |
| Enrollments | `/api/enrollments` | Retrieve the authenticated student's enrollments |
| Instructors | `/api/instructors` | Public instructor course listings |
| Users | `/api/users` | Public profiles and authenticated user preferences |
| Uploads | `/api/upload` | Course image and lesson video uploads; asset deletion |
| Administration | `/api/admin` | Platform statistics, user management, and course moderation |
| Health | `/api/health` | API health and uptime information |

### Authentication endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register a user |
| `POST` | `/api/auth/login` | Public | Authenticate a user |
| `POST` | `/api/auth/refresh` | Refresh cookie | Rotate refresh token and issue a new access token |
| `GET` | `/api/auth/verify-email/:token` | Public token | Verify an email address |
| `POST` | `/api/auth/resend-verification` | Public | Resend verification email |
| `POST` | `/api/auth/forgot-password` | Public | Request password reset |
| `POST` | `/api/auth/reset-password/:token` | Public token | Set a new password |
| `GET` | `/api/auth/me` | Authenticated | Get current user |
| `PATCH` | `/api/auth/me` | Authenticated | Update current user's profile |
| `PATCH` | `/api/auth/me/password` | Authenticated | Change password |
| `DELETE` | `/api/auth/me` | Authenticated | Delete current account |
| `POST` | `/api/auth/logout` | Authenticated | Log out current session |
| `POST` | `/api/auth/logout-all` | Authenticated | Log out all sessions |

### Course endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/courses` | Public/optional auth | List published courses |
| `GET` | `/api/courses/categories` | Public/optional auth | Retrieve category statistics |
| `GET` | `/api/courses/:slug` | Public/optional auth | Retrieve course details |
| `GET` | `/api/courses/:slug/curriculum` | Public/optional auth | Retrieve course curriculum |
| `GET` | `/api/courses/mine` | Instructor/admin | List courses managed by the current instructor |
| `POST` | `/api/courses` | Instructor/admin | Create a course |
| `PATCH` | `/api/courses/:id` | Instructor/admin with ownership checks | Update a course |
| `DELETE` | `/api/courses/:id` | Instructor/admin with ownership checks | Delete a course |
| `POST` | `/api/courses/:id/submit` | Instructor/admin | Submit a course for review |
| `POST` | `/api/courses/:id/archive` | Instructor/admin | Archive a course |
| `POST` | `/api/courses/:id/enroll` | Authenticated | Enroll in a course |
| `DELETE` | `/api/courses/:id/enroll` | Authenticated | Unenroll from a course |
| `GET` | `/api/courses/:id/enrollment` | Authenticated | Retrieve enrollment for a course |
| `GET` | `/api/courses/:id/progress` | Authenticated | Retrieve course progress |
| `POST` | `/api/courses/:id/certificate` | Authenticated/eligible student | Issue a course certificate |

### Section and lesson endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/courses/:courseId/sections` | Instructor/admin | Create a section |
| `PATCH` | `/api/courses/:courseId/sections/reorder` | Instructor/admin | Reorder course sections |
| `PATCH` | `/api/sections/:id` | Instructor/admin | Update a section |
| `DELETE` | `/api/sections/:id` | Instructor/admin | Delete a section |
| `POST` | `/api/sections/:sectionId/lessons` | Instructor/admin | Create a lesson |
| `PATCH` | `/api/sections/:sectionId/lessons/reorder` | Instructor/admin | Reorder lessons |
| `GET` | `/api/lessons/:id` | Instructor/admin | Retrieve lesson details for instructor management |
| `PATCH` | `/api/lessons/:id` | Instructor/admin | Update a lesson |
| `DELETE` | `/api/lessons/:id` | Instructor/admin | Delete a lesson |

### Student progress endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/lessons/:id/complete` | Authenticated | Mark a lesson complete |
| `DELETE` | `/api/lessons/:id/complete` | Authenticated | Mark a lesson incomplete |
| `POST` | `/api/lessons/:id/access` | Authenticated | Record lesson access |

### Quiz endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/lessons/:lessonId/quiz` | Instructor/admin | Create a quiz for a lesson |
| `GET` | `/api/lessons/:lessonId/quiz` | Instructor/admin | Retrieve quiz for lesson management |
| `GET` | `/api/quizzes/:id/instructor` | Instructor/admin | Retrieve instructor quiz details |
| `PATCH` | `/api/quizzes/:id` | Instructor/admin | Update a quiz |
| `DELETE` | `/api/quizzes/:id` | Instructor/admin | Delete a quiz |
| `GET` | `/api/quizzes/:id` | Authenticated student | Retrieve student-safe quiz content |
| `POST` | `/api/quizzes/:id/submit` | Authenticated student | Submit quiz answers |
| `GET` | `/api/quizzes/:id/attempts/mine` | Authenticated student | Retrieve own quiz attempts |
| `GET` | `/api/quizzes/:id/best/mine` | Authenticated student | Retrieve own best quiz score |

### Enrollment and instructor endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/enrollments/mine` | Authenticated | List current student's enrollments |
| `GET` | `/api/instructors/:id/courses` | Public/optional auth | List an instructor's public courses |

### User endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/users/:id` | Public | Retrieve a public user profile |
| `PATCH` | `/api/users/me/preferences` | Authenticated | Update current user's preferences |

### Upload endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/api/upload/image` | Instructor/admin | Upload a course thumbnail image |
| `POST` | `/api/upload/video` | Instructor/admin | Upload a lesson video |
| `DELETE` | `/api/upload/:publicId` | Instructor/admin | Delete a Cloudinary asset |

For multipart upload requests, use the field names `image` and `video` respectively.

### Administration endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/admin/stats` | Admin | Retrieve platform statistics |
| `GET` | `/api/admin/users` | Admin | List users |
| `GET` | `/api/admin/users/:id` | Admin | Retrieve user details |
| `PATCH` | `/api/admin/users/:id/role` | Admin | Update a user's role |
| `PATCH` | `/api/admin/users/:id/active` | Admin | Activate/deactivate a user |
| `DELETE` | `/api/admin/users/:id` | Admin | Delete a user |
| `GET` | `/api/admin/courses` | Admin | List courses for moderation/administration |
| `GET` | `/api/admin/courses/pending` | Admin | List courses awaiting review |
| `POST` | `/api/admin/courses/:id/approve` | Admin | Approve a course |
| `POST` | `/api/admin/courses/:id/reject` | Admin | Reject a course |
| `POST` | `/api/admin/courses/:id/archive` | Admin | Force archive a course |
| `DELETE` | `/api/admin/courses/:id` | Admin | Force delete a course |

> The route overview describes the registered route structure. For exact validation constraints, query parameters, request payloads, and response formats, refer to the generated Swagger documentation.

---

## Authentication and Authorization

### Access-token authentication

Protected endpoints use a JWT access token in the Authorization header:

```http
Authorization: Bearer <access_token>
```

The default access-token expiry is `15m`, configurable through `JWT_ACCESS_EXPIRES_IN`.

### Refresh-token flow

The refresh token is issued through an HttpOnly cookie. The default cookie name is `lms.refresh`, configurable through `REFRESH_COOKIE_NAME`.

The refresh endpoint is:

```http
POST /api/auth/refresh
```

The refresh-token flow rotates tokens rather than relying on a long-lived access token. The cookie is HttpOnly so browser JavaScript cannot directly read it.

### Role and ownership checks

Authentication confirms the user's identity. Role and ownership middleware then restrict access to operations based on the user's role and ownership of the requested resource.

For example, instructor/admin middleware protects course curriculum authoring and quiz management, while administrative routes require an admin role.

---

## Data Models

The primary Mongoose models are:

| Model | Responsibility |
|---|---|
| `User` | Account details, credentials, role, profile information, verification/reset token state, account status, and preferences |
| `Course` | Course metadata, instructor reference, publication/moderation status, category, pricing, tags, and catalogue information |
| `Section` | Ordered curriculum groups belonging to a course |
| `Lesson` | Text/video learning content belonging to a course section |
| `Enrollment` | Student-course relationship, completed lessons, last-accessed lesson, and progress/completion information |
| `Quiz` | Quiz questions, answer options, correct-answer data, passing score, and lesson/course association |
| `QuizAttempt` | Student quiz submissions, evaluated score, pass status, and attempt history |

MongoDB ObjectIds are used to reference related records. Mongoose schemas define field types, validation, indexes, and model-level behavior.

---

## Media Uploads

The API uses Cloudinary to store and deliver course images and lesson videos.

### Upload routes

```text
POST   /api/upload/image
POST   /api/upload/video
DELETE /api/upload/:publicId
```

The upload routes require authentication and an instructor/admin role. They also use a dedicated upload rate limiter.

Configure the following values:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

In production, Cloudinary credentials are required by the environment validation logic.

HLS streaming can be enabled through `FEATURE_HLS`. Keep in mind that the default in the example configuration is `false`.

---

## Background Maintenance Scripts

The repository includes standalone scripts for maintenance tasks. They should be run as scheduled jobs or manually from the application root, with the required environment variables available.

### 1. Expired token cleanup

```bash
node server/scripts/cleanupExpiredTokens.js
```

Clears expired password-reset and email-verification token fields from user records.

### 2. Stale draft cleanup

```bash
node server/scripts/cleanupStaleDrafts.js
```

Deletes draft courses that have no enrollments and have not been updated for 90 days.

### 3. Certificate reminder

```bash
node server/scripts/certificateReminder.js
```

Checks for students who completed a course at least seven days earlier and have not had a certificate issued, then attempts to send a reminder email. This task exits without processing when the certificate feature is disabled.

Run these scripts carefully, especially cleanup jobs, and verify the target database before scheduling them in production.

---

## Health Check

The API exposes a health endpoint:

```http
GET /api/health
```

Example response:

```json
{
  "status": "ok",
  "uptime": 123.45,
  "timestamp": "2026-01-01T10:00:00.000Z",
  "env": "development"
}
```

The timestamp and uptime values will vary at runtime.

---

## Security

The backend includes several security-oriented controls:

- JWT access tokens and rotating refresh tokens.
- HttpOnly refresh-token cookie.
- Separate access and refresh JWT secrets.
- Password hashing with bcryptjs.
- Configurable login-attempt limits and account lockout duration.
- Authentication and role-based authorization middleware.
- Resource ownership checks in protected operations.
- Request validation using express-validator.
- MongoDB query/input sanitization.
- Security headers and removal of the Express identifying header.
- HTTPS redirection in production.
- CORS origin allowlisting; wildcard origins are rejected in production.
- Global API rate limiting and additional limiters for sensitive routes.
- Request body size limits.
- Centralized error handling.
- Structured request/application logging.

### Production security checklist

- Use strong, unique JWT secrets of at least 32 characters.
- Never commit `.env` or production credentials.
- Use a production MongoDB connection with appropriate access controls.
- Configure exact allowed CORS origins.
- Use HTTPS.
- Configure Cloudinary and SMTP credentials securely.
- Use Redis when rate limits must be shared across multiple API instances.
- Change seeded/demo passwords and remove demo data before production use.
- Review logging output to ensure secrets and sensitive data are not exposed.

---

## Error Responses

The API uses a consistent JSON error response structure. A typical error response looks like:

```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": [
    {
      "field": "email",
      "message": "Email is required."
    }
  ]
}
```

Depending on the endpoint and error condition, the API may return standard HTTP status codes such as:

| Status | Meaning |
|---|---|
| `400` | Bad request |
| `401` | Authentication required or invalid credentials/token |
| `403` | Authenticated user does not have permission |
| `404` | Resource or route not found |
| `409` | Conflict with the current resource state |
| `422` | Request validation error |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error |

The exact message and error details depend on the operation.

---

## Feature Flags

Server-side feature flags are configured through environment variables:

| Variable | Default | Purpose |
|---|---:|---|
| `FEATURE_CERTIFICATES` | `true` | Enables certificate-related API functionality and reminder processing |
| `FEATURE_HLS` | `false` | Enables HLS video streaming behavior |
| `FEATURE_BETA_QUIZ_TIMER` | `false` | Enables beta quiz timer functionality |

These flags allow selected features to be enabled or disabled without changing application code. Verify the corresponding behavior and client integration before enabling a flag in a deployed environment.

---

## Deployment Notes

The application is designed to run as a Node.js API service.

For a production deployment:

1. Use Node.js 20 or a compatible supported runtime.
2. Configure all required environment variables in the hosting provider's environment settings.
3. Use a managed MongoDB database or secured MongoDB deployment.
4. Configure Cloudinary credentials.
5. Configure SMTP credentials for email workflows.
6. Configure Redis if shared rate limiting is required.
7. Set `NODE_ENV=production`.
8. Set `CLIENT_URL` and `CORS_ORIGINS` to the exact allowed origins.
9. Use strong, separate JWT secrets.
10. Configure the hosting platform's start command to run the server entry file.
11. Schedule maintenance scripts separately if they are required.
12. Confirm `/api/health` and `/api-docs` after deployment.

The server includes graceful shutdown handling for HTTP connections, MongoDB, and Redis.

---

## Development Notes

- Keep controllers focused on HTTP request/response handling.
- Put reusable request validation rules in the validators directory.
- Apply authentication and role middleware at the route level.
- Enforce ownership checks before modifying or deleting user-owned resources.
- Keep secrets in environment variables.
- Update the Swagger/OpenAPI documentation when endpoints or schemas change.
- Test student, instructor, and admin permissions separately.
- Test refresh-token, email verification, password reset, upload, and rate-limit flows before release.

---

## License

The Swagger configuration in the supplied source declares an MIT license. Confirm that the repository includes the corresponding `LICENSE` file and that you have the right to distribute all included code and assets before publishing it as an MIT-licensed project.

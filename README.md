# AcadTrack - Academic ERP System

A complete, production-ready Academic ERP system built with Next.js, Express.js, and PostgreSQL. Features robust role-based access control, geolocation attendance, anti-cheat quizzes, grading analytics, and Cloudflare R2 assignment uploads with Jaccard Similarity plagiarism detection.

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database (Hosted e.g. Render)
- Cloudflare R2 account

### 1. Database Initialization
Run the provided `schema.sql` file in your PostgreSQL database to create all required tables. 
```bash
psql -U your_user -h your_host -d your_db -f schema.sql
```

### 2. Backend Setup
1. Navigate to the `backend` folder: `cd backend`
2. Install dependencies: `npm install`
3. Duplicate `.env.example` as `.env` and configure it:
```env
PORT=5000
DATABASE_URL=postgres://user:password@host/dbname
JWT_SECRET=your_jwt_secret_key
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_BUCKET_NAME=your_bucket
```
4. Start the server: `npm run dev` or `node server.js`

### 3. Frontend Setup
1. Navigate to the `frontend` folder: `cd frontend`
2. Install dependencies: `npm install`
3. Create a `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```
4. Start the app: `npm run dev`

---

## 📚 API Documentation

### Authentication (`/auth`)
- **`POST /auth/register`** 
  - Body: `{ name, email, password, role, [roll_no, department, semester] }`
- **`POST /auth/login`**
  - Body: `{ email, password }`
  - Returns: `{ token, user }`

### Attendance System (`/attendance`)
- **`POST /start`**: `[Student]` Start session (`subject_id`, `lat`, `long`)
- **`POST /ping`**: `[Student]` Keep session active (Heartbeat)
- **`POST /complete`**: `[Student]` End session. Evaluates if present based on threshold.
- **`GET /student/:id`**: `[Student/Prof]` Get student attendance.
- **`GET /subject/:id`**: `[Prof]` Get Subject Attendance Report.

### Quiz System (`/quiz`)
- **`POST /create`**: `[Prof]` Creates quiz and questions.
- **`GET /:id`**: `[Student/Prof]` Fetch quiz details (Hides answers for students).
- **`POST /submit`**: `[Student]` Auto-evaluates score.
- **`POST /violation`**: `[Student]` Records Tab-switch / Full-screen exit. Auto-submits on 3.

### Grading System (`/marks`)
- **`POST /upload`**: `[Prof]` Submits JSON array of marks.
- **`GET /student/:id`**: `[Student]` View personal marks.
- **`GET /subject/:id`**: `[Prof]` Generates max, min, avg analytics per exam type.

### Assignment System (`/assignment`)
- **`POST /create`**: `[Prof]` Creates new assignment link.
- **`POST /submit`**: `[Student]` Uploads `multipart/form-data` file. Stores to R2, runs **Plagiarism Jaccard Check**.
- **`GET /:id/submissions`**: `[Prof]` View submission table sorted by highest similarity score.

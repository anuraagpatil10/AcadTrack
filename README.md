# AcadTrack - Academic ERP System

A complete, production-ready Academic ERP system built with Next.js, Express.js, PostgreSQL, and a Python Flask Microservice. Features robust role-based access control, High-Security Biometric (Facial Recognition) + Continuous GPS Geofencing Attendance, anti-cheat quizzes, grading analytics, and Cloudflare R2 assignment uploads with Jaccard Similarity plagiarism detection.

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v18+)
- Python (v3.10 to v3.12, strict requirement for `tf-keras` compatibility)
- PostgreSQL Database (Hosted e.g. Neon, Render, or Local)
- Cloudinary Account (for Biometric Profile Images)

### 1. Database Initialization
Run the provided `schema.sql` file in your PostgreSQL database to create all required tables. 
```bash
psql -U your_user -h your_host -d your_db -f schema.sql
```

### 2. Python Microservice (DeepFace Biometrics)
The system relies on a Python microservice for heavy AI facial recognition (Facenet512) algorithms.
1. Navigate to the python directory: `cd python_service`
2. Install dependencies: `pip install -r requirements.txt`
3. If running on TensorFlow 2.16+, Keras 3 issues may arise. The script forces Legacy Keras automatically via `os.environ["TF_USE_LEGACY_KERAS"] = "1"`.
4. Start the service: `python app.py`
*(Runs on `http://localhost:5001`)*

### 3. Backend (Node.js) Setup
1. Navigate to the `backend` folder: `cd backend`
2. Install dependencies: `npm install`
3. Duplicate `.env.example` as `.env` and configure it:
```env
PORT=5000
DATABASE_URL=postgres://user:password@host/dbname
JWT_SECRET=your_jwt_secret_key


# Cloudinary (Biometrics & Images)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Python Microservice
PYTHON_SERVICE_URL=http://localhost:5001
```
4. Start the server: `npm run dev` or `node server.js`

### 4. Frontend (Next.js) Setup
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

### Advanced Biometric Attendance (`/attendance`)
- **`POST /register-face`**: `[Student]` Uploads up to 3 base64 selfies to Cloudinary, extracts FaceNet embeddings via Python Service, and appends to PostgreSQL arrays.
- **`POST /start`**: `[Student]` Start session. Enforces GPS proximity (<= 30 meters from professor) AND live webcam facial verification before marking presence.
- **`POST /ping`**: `[Student]` Continuous tracking heartbeat (validates GPS proximity every 30s).
- **`POST /complete`**: `[Student]` End session. Checks if valid accumulated time exceeds 50% of the class duration.
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

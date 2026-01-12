# Frontend (Vite + React)

Simple UI to upload a video or provide a YouTube URL and poll the backend `/api/videos/process` for progress.

Quick start:

1. From project root, install dependencies:
   cd frontend
   npm install

2. Start dev server:
   npm run dev

The frontend is configured to proxy `/api`, `/thumbnails`, and `/trailers` to `http://localhost:5000` (backend). Make sure the backend is running.

Usage:
- Upload a file or provide a YouTube URL and press *Start Processing*.
- The UI will poll `/api/videos/status` and display thumbnails as they are created, and show the trailer (when available).

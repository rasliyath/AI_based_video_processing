# AI-Based Video Processing System

An automated video processing system for CMS that generates thumbnails, trailers, metadata, and subtitles from uploaded videos or YouTube URLs.

## Features

- **Auto Thumbnail Generation**: Creates 20 high-quality thumbnails with AI quality scoring
- **Smart Trailer Creation**: Generates 15-second montage trailers from full video content
- **AI Metadata**: Automatically generates titles, descriptions, tags, and categories
- **Subtitle Generation**: Creates subtitles with multi-language support (when available)
- **Audio Verification**: Ensures all outputs contain audio
- **CMS Integration**: REST API with React frontend for review and approval

## Tech Stack

- **Backend**: Node.js, Express, MongoDB
- **Frontend**: React, Vite
- **AI Processing**: Python, OpenCV, OpenAI Whisper, FFmpeg
- **Video Download**: yt-dlp

## Prerequisites

- Node.js (v18+)
- Python (3.8+)
- MongoDB
- FFmpeg
- Git

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd AI_based_video_processing
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   npm install
   ```

3. **Frontend Setup**:
   ```bash
   cd ../frontend
   npm install
   ```

4. **Python Dependencies**:
   ```bash
   cd ../python_scripts
   pip install opencv-python yt-dlp openai-whisper
   # Optional: pip install googletrans==4.0.0rc1 librosa
   ```

## Configuration

1. **MongoDB**:
   - Start MongoDB service
   - Update `backend/.env` with your MongoDB URI:
     ```
     MONGO_URI=mongodb://127.0.0.1:27017/ai_video_db
     PORT=5000
     ```

## Running the Application

1. **Start Backend**:
   ```bash
   cd backend
   npm run dev
   ```
   Backend runs on http://localhost:5000

2. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend runs on http://localhost:5173

3. **Access Application**:
   Open http://localhost:5173 in your browser

## Usage

1. **Upload Video**: Use the file upload or paste YouTube URL
2. **Processing**: System automatically generates:
   - 10 thumbnails (displayed in gallery)
   - trailer (playable video)
   - Metadata (title, description, tags)
   - Subtitles (SRT files)
3. **Review**: Check generated assets in the UI
4. **Approve**: Assets are saved for CMS use

## API Endpoints

- `POST /api/videos/process` - Process video/upload
- `GET /api/videos/status` - Get processing status
- `GET /api/videos` - List processed videos

## File Structure

```
├── backend/           # Node.js API server
├── frontend/          # React application
├── python_scripts/    # AI processing scripts
├── uploads/           # Uploaded videos
├── thumbnails/        # Generated thumbnails
└── trailers/          # Generated trailers & subtitles
```

## Troubleshooting

- **Whisper Issues**: If subtitles fail, install PyTorch CPU version
- **FFmpeg Errors**: Ensure FFmpeg is in system PATH
- **MongoDB**: Ensure MongoDB is running
- **Audio Missing**: Check with VLC player (default players may not support AAC)

## License

ISC
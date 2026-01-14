# AI-Based Video Processing System

An automated video processing system for CMS that generates thumbnails, trailers, metadata, and subtitles from uploaded videos or YouTube URLs.

## Features

- **Auto Thumbnail Generation**: Creates 10 high-quality thumbnails with AI quality scoring
- **Smart Trailer Creation**: Generates montage trailers from full video content
- **AI Metadata Generation**: Uses local AI (Ollama) to create intelligent titles, descriptions, tags, and categories from video transcripts
- **Subtitle Generation**: Creates accurate subtitles using OpenAI Whisper
- **Audio Verification**: Ensures all outputs contain audio
<!-- - **CMS Integration**: REST API with React frontend for review and approval -->

## Tech Stack

- **Backend**: Node.js, Express, MongoDB
- **Frontend**: React, Vite
- **AI Processing**: Python, OpenCV, OpenAI Whisper, NLTK (free AI analysis), FFmpeg
- **Video Download**: yt-dlp

## Prerequisites

- Node.js (v18+)
- Python (3.8+)
- MongoDB
- FFmpeg
- Git
- Ollama

### Windows-Specific Requirements

- **Visual C++ Redistributable**: Required for PyTorch/Whisper
  - Download from: https://aka.ms/vs/17/release/vc_redist.x64.exe
  - Install the redistributable package

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
    pip install opencv-python yt-dlp openai-whisper transformers nltk python-dotenv
    # Optional: pip install googletrans==4.0.0rc1 librosa
    ```

5. **NLTK Data Setup** (Optional - for enhanced text processing):
    ```bash
    cd python_scripts
    python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('punkt_tab')"
    ```

6. **Ollama Setup** (Required for AI metadata generation):
    ```bash
    # Download and install Ollama from https://ollama.ai/download
    # Pull the Mistral model
    ollama pull mistral
    # Start Ollama service (keep running in background)
    ollama serve
    ```

7. **Whisper Model Configuration** (Optional - for faster processing):
    ```bash
    # Set environment variable for smaller/faster Whisper model
    set WHISPER_MODEL=tiny  # Windows
    # export WHISPER_MODEL=tiny  # Linux/Mac
    ```

## Configuration

1. **MongoDB**:
    - Start MongoDB service
    - Update `backend/.env` with your MongoDB URI:
      ```
      MONGO_URI=mongodb://127.0.0.1:27017/ai_video_db
      PORT=5000
      ```

<!-- 2. **OpenAI API Key** (Optional - for enhanced subtitle accuracy):
    - Get API key from: https://platform.openai.com/api-keys
    - Add to `backend/.env`:
      ```
      OPENAI_API_KEY=sk-your-api-key-here
      ```
    - Note: System works without API key using free AI tools -->

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

<!-- ## Troubleshooting

- **PyTorch/Whisper DLL Errors (Windows)**: Install Visual C++ Redistributable from https://aka.ms/vs/17/release/vc_redist.x64.exe

- **Whisper Model Loading Issues**: Set `WHISPER_MODEL=tiny` environment variable for faster/smaller model

- **NLTK Data Errors**: Run `python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('punkt_tab')"`

- **OpenAI Quota Exceeded**: System automatically falls back to free AI tools - no API key required

- **FFmpeg Errors**: Ensure FFmpeg is in system PATH

- **MongoDB**: Ensure MongoDB is running on default port 27017

- **Audio Missing**: Check with VLC player (default players may not support AAC) -->

## License

ISC
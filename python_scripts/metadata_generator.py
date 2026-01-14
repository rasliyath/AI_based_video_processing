# -*- coding: utf-8 -*-
import sys
import os
import json
import requests
import tempfile
import shutil

sys.stdout.reconfigure(encoding='utf-8')
os.environ['PYTHONIOENCODING'] = 'utf-8'

def safe_print(text):
    """Print to stderr to avoid interfering with JSON output"""
    try:
        sys.stderr.write(str(text) + "\n")
        sys.stderr.flush()
    except:
        pass

def read_transcript(transcript_path):
    """Read and extract text from SRT transcript file"""
    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract text lines (skip numbers and timestamps)
        lines = content.split('\n')
        text_lines = []

        for line in lines:
            line = line.strip()
            # Skip empty lines, numbers, and timestamp lines
            if line and not line.isdigit() and '-->' not in line:
                text_lines.append(line)

        transcript_text = ' '.join(text_lines)
        return transcript_text[:4000]  # Limit to 4000 chars for API
    except Exception as e:
        safe_print(f"[Metadata] Error reading transcript: {e}")
        return None

def check_ollama_available():
    """Check if Ollama is running"""
    try:
        response = requests.get('http://localhost:11434/api/tags', timeout=2)
        return response.status_code == 200
    except:
        return False

def generate_metadata_with_ollama(transcript_text, video_analysis):
    """Use Ollama (local LLM) to generate professional metadata"""
    
    safe_print("[Metadata] Checking Ollama availability...")
    
    if not check_ollama_available():
        safe_print("[Metadata] ERROR: Ollama is not running!")
        safe_print("[Metadata] Please start Ollama with: ollama serve")
        return None
    
    safe_print("[Metadata] Ollama is available, generating metadata...")
    
    duration = video_analysis.get('duration', 0)
    
    # Professional prompt for metadata generation
    prompt = f"""You are a professional video metadata generator for a content management system.

Analyze this video transcript and generate professional metadata in JSON format.

TRANSCRIPT (first 4000 characters):
{transcript_text}

VIDEO DURATION: {duration:.0f} seconds

Generate ONLY valid JSON (no markdown, no explanation, just raw JSON):
{{
  "title": "Professional 5-10 word title that captures the main topic",
  "description": "2-3 engaging sentences explaining what the video is about and who should watch it",
  "tags": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "genre": "One of: Education, Entertainment, Tutorial, Vlog, Interview, News, Documentary, How-To, Motivational, Comedy",
  "category": "Same as genre"
}}

REQUIREMENTS:
- Title: Catchy, clear, 5-10 words max
- Description: Engaging, 2-3 sentences, explains value
- Tags: 5 relevant keywords (no duplicates)
- Genre: Pick ONE that best matches
- Avoid generic titles like "Amazing Video" or "Interesting Content"
- Make it professional for a CMS editor to review

ONLY OUTPUT VALID JSON, NOTHING ELSE."""

    try:
        safe_print("[Metadata] Sending request to Ollama...")
        
        response = requests.post(
            'http://localhost:11434/api/generate',
            json={
                "model": "mistral",
                "prompt": prompt,
                "stream": False,
                "temperature": 0.7,
            },
            timeout=120  # 2 minute timeout for LLM
        )
        
        if response.status_code != 200:
            safe_print(f"[Metadata] Ollama error: {response.status_code}")
            return None
        
        result = response.json()
        response_text = result.get('response', '')
        
        safe_print(f"[Metadata] Raw response length: {len(response_text)}")
        
        # Extract JSON from response (Ollama might add extra text)
        try:
            # Try to find JSON object in response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start != -1 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                metadata = json.loads(json_str)
                
                # Validate required fields
                required_fields = ['title', 'description', 'tags', 'genre', 'category']
                if all(field in metadata for field in required_fields):
                    metadata['duration'] = round(duration, 2)
                    metadata['analysis'] = video_analysis
                    
                    safe_print("[Metadata] ✓ Professional metadata generated via Ollama")
                    return metadata
            
            safe_print("[Metadata] Could not parse JSON from Ollama response")
            return None
            
        except json.JSONDecodeError as e:
            safe_print(f"[Metadata] JSON parse error: {e}")
            safe_print(f"[Metadata] Response text: {response_text[:500]}")
            return None
    
    except requests.exceptions.Timeout:
        safe_print("[Metadata] Ollama request timed out (may be slow on first run)")
        return None
    except Exception as e:
        safe_print(f"[Metadata] Ollama error: {e}")
        import traceback
        traceback.print_exc()
        return None

def generate_fallback_metadata(video_analysis):
    """Generate professional fallback metadata when Ollama fails"""
    
    safe_print("[Metadata] Using professional fallback metadata")
    
    duration = video_analysis.get('duration', 0)
    has_faces = video_analysis.get('face_detected', False)
    avg_motion = video_analysis.get('avg_motion', 0)
    avg_brightness = video_analysis.get('avg_brightness', 128)
    
    # Professional fallback templates
    if has_faces:
        if avg_motion > 10:
            title = "Dynamic Presentation Guide"
            description = "An engaging presentation covering key topics with clear explanations and expert insights."
            genre = "Tutorial"
            tags = ["presentation", "educational", "guide", "learning", "professional"]
        else:
            title = "Expert Interview & Discussion"
            description = "An in-depth interview featuring expert perspectives, practical advice, and valuable insights on important topics."
            genre = "Interview"
            tags = ["interview", "expert", "discussion", "insights", "professional"]
    else:
        if avg_motion > 15:
            title = "Dynamic Visual Tour"
            description = "A fast-paced visual journey showcasing interesting locations, techniques, or concepts with clear narration."
            genre = "Documentary"
            tags = ["visual", "documentary", "tour", "educational", "engaging"]
        else:
            title = "Educational Content Overview"
            description = "An informative video providing comprehensive coverage of important topics with professional presentation."
            genre = "Education"
            tags = ["educational", "informative", "learning", "content", "guide"]
    
    # Adjust brightness/contrast descriptions
    if avg_brightness < 80:
        tags.append("cinematic")
    elif avg_brightness > 180:
        tags.append("bright")
    
    # Adjust motion descriptions
    if avg_motion > 20:
        tags.append("dynamic")
    
    metadata = {
        "title": title,
        "description": description,
        "tags": tags[:7],  # Max 7 tags
        "genre": genre,
        "category": genre,
        "duration": round(duration, 2),
        "analysis": video_analysis
    }
    
    return metadata

def main():
    # Parse arguments
    if len(sys.argv) < 2:
        safe_print("Usage: python metadata_generator.py <video_path> [transcript_path]")
        sys.exit(1)

    video_path = sys.argv[1]
    transcript_path = sys.argv[2] if len(sys.argv) > 2 else None

    safe_print("[Metadata] Starting metadata generation...")
    safe_print(f"[Metadata] Video: {video_path}")
    if transcript_path:
        safe_print(f"[Metadata] Transcript: {transcript_path}")

    import cv2

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        safe_print("[Metadata] WARNING: Cannot open video file, using default values")
        duration = 60.0
        video_analysis = {
            "duration": duration,
            "avg_brightness": 128,
            "avg_motion": 0,
            "face_detected": False,
            "total_faces_found": 0
        }
        has_faces = False
        avg_motion = 0
        avg_brightness = 128
    else:
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0

        # OPTIMIZATION: Seek-based sampling with downscaled processing
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )

        # Settings: cap sample count to keep analysis fast
        sample_count = min(12, 15)
        sample_count = min(sample_count, max(1, frame_count))

        # Choose centered sample positions across the video
        sample_positions = [int((i + 0.5) * frame_count / sample_count) for i in range(sample_count)]

        sample_frames = []
        total_faces = 0
        brightness_sum = 0.0
        motion_scores = []
        prev_gray = None

        MAX_PROC_WIDTH = 640

        for i, pos in enumerate(sample_positions):
            try:
                cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
                ret, frame = cap.read()
                if not ret or frame is None:
                    continue

                h, w = frame.shape[:2]
                if w > MAX_PROC_WIDTH:
                    scale = MAX_PROC_WIDTH / float(w)
                    small = cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
                else:
                    small = frame

                gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
                brightness_sum += float(gray.mean())

                try:
                    faces = face_cascade.detectMultiScale(gray, 1.1, 3, minSize=(30, 30))
                    total_faces += len(faces)
                except Exception as e:
                    pass

                if prev_gray is not None:
                    diff = cv2.absdiff(prev_gray, gray)
                    motion_scores.append(float(diff.mean()))

                prev_gray = gray
                sample_frames.append(small)

            except MemoryError:
                safe_print("[Metadata] MemoryError during sampling — skipping")
                continue

        cap.release()

        # Calculate metrics
        avg_brightness = brightness_sum / len(sample_frames) if sample_frames else 128
        avg_motion = sum(motion_scores) / len(motion_scores) if motion_scores else 0
        has_faces = total_faces > 0

        video_analysis = {
            "duration": round(duration, 2),
            "avg_brightness": round(avg_brightness, 2),
            "avg_motion": round(avg_motion, 2),
            "face_detected": has_faces,
            "total_faces_found": total_faces
        }

    # Try LLM metadata generation if transcript is available
    metadata = None
    if transcript_path:
        safe_print(f"[Metadata] Transcript available, attempting LLM generation with Ollama...")
        transcript_text = read_transcript(transcript_path)
        if transcript_text:
            metadata = generate_metadata_with_ollama(transcript_text, video_analysis)

    # Fall back to professional fallback if LLM failed or no transcript
    if not metadata:
        safe_print("[Metadata] Using professional fallback metadata")
        metadata = generate_fallback_metadata(video_analysis)

    # Output JSON
    print(json.dumps(metadata, ensure_ascii=False))

if __name__ == '__main__':
    main()
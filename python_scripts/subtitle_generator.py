# -*- coding: utf-8 -*-
import sys
import os
import subprocess

sys.stdout.reconfigure(encoding='utf-8')
os.environ['PYTHONIOENCODING'] = 'utf-8'

def safe_print(text):
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        try:
            sys.stdout.write(str(text) + "\n")
            sys.stdout.flush()
        except:
            pass

def format_time_srt(seconds):
    hours = int(seconds / 3600)
    minutes = int((seconds % 3600) / 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

video_path = sys.argv[1]
output_path = sys.argv[2]

safe_print(f"Generating subtitles for: {video_path}")
os.makedirs(os.path.dirname(output_path), exist_ok=True)

# Method 1: Try FFmpeg with subtitle extraction (for embedded subtitles)
try:
    result = subprocess.run(
        ['ffmpeg', '-i', video_path, '-vn', '-an', '-c:s', 'copy', output_path],
        capture_output=True,
        timeout=30
    )
    if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
        safe_print("Extracted embedded subtitles")
        sys.exit(0)
except:
    pass

# Method 2: Try Whisper transcription (local) with fallback to placeholder
safe_print("Attempting AI transcription using Local Whisper (if installed). This may be slow on CPU.")
try:
    import whisper
    model_name = os.environ.get('WHISPER_MODEL', 'small')  # allow override
    safe_print(f"Loading Whisper model: {model_name} (this may take a while)")
    model = whisper.load_model(model_name)
    safe_print("Transcribing audio (Whisper)...")
    # Prefer whisper's built-in transcribe which also returns segments with timings
    res = model.transcribe(video_path, fp16=False)
    segments = res.get('segments', []) if isinstance(res, dict) else []

    if segments:
        safe_print(f"Got {len(segments)} segments from Whisper, writing SRT...")
        with open(output_path, 'w', encoding='utf-8') as f:
            for i, seg in enumerate(segments, start=1):
                start = seg.get('start', 0.0)
                end = seg.get('end', start + seg.get('duration', 0.0))
                text = seg.get('text', '').strip()
                f.write(f"{i}\n")
                f.write(f"{format_time_srt(start)} --> {format_time_srt(end)}\n")
                f.write(f"{text}\n\n")
        safe_print(f"✓ Subtitles saved to: {output_path}")
        sys.exit(0)
    else:
        safe_print("Whisper returned no segments, falling back to placeholder subtitles")
except Exception as e:
    safe_print(f"Whisper transcription unavailable or failed: {e}\nFalling back to placeholder subtitles")
    safe_print("WHISPER ERROR DETAILS:")
    safe_print(repr(e))

# Fallback: placeholder subtitles with proper timing
safe_print("Generating placeholder subtitles with video duration...")

import cv2

try:
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frame_count / fps if fps > 0 else 60
    cap.release()
except Exception:
    duration = 60

# Create SRT with semantic placeholders
with open(output_path, 'w', encoding='utf-8') as f:
    segment_duration = 5  # 5-second segments
    segment_num = 1
    
    for i in range(int(duration / segment_duration) + 1):
        start = i * segment_duration
        end = min((i + 1) * segment_duration, duration)
        
        if start >= duration:
            break
        
        start_srt = format_time_srt(start)
        end_srt = format_time_srt(end)
        
        # Semantic placeholder (more useful than generic text)
        segment_num_display = i + 1
        text = f"[Scene {segment_num_display}]\n(For AI-generated subtitles, install: pip install openai-whisper)"
        
        f.write(f"{segment_num}\n")
        f.write(f"{start_srt} --> {end_srt}\n")
        f.write(f"{text}\n\n")
        segment_num += 1

safe_print(f"Placeholder subtitles saved to: {output_path}")
safe_print("To enable AI transcription:")
safe_print("1. Install GPU drivers (if NVIDIA) if you want faster performance")
safe_print("2. pip install openai-whisper")
safe_print("3. Set environment variable WHISPER_MODEL if you want a different model (tiny/base/small/medium/large)")
safe_print("4. Re-run subtitle generation")
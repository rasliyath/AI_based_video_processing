# -*- coding: utf-8 -*-
import sys
import os
import subprocess
import tempfile
import time  # ← ADD THIS (was missing!)
import shutil  # ← ADD THIS too
import yt_dlp

sys.stdout.reconfigure(encoding='utf-8')
os.environ['PYTHONIOENCODING'] = 'utf-8'

def safe_print(text):
    """Safe print with unicode handling"""
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        try:
            sys.stdout.write(str(text) + "\n")
            sys.stdout.flush()
        except:
            pass

def format_time_srt(seconds):
    """Convert seconds to SRT time format"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def extract_audio(video_path, audio_temp):
    """Extract audio from video using FFmpeg"""
    safe_print(f"[Subtitle] Extracting audio from video...")
    
    try:
        result = subprocess.run([
            'ffmpeg', '-i', video_path, '-q:a', '9', '-n', audio_temp
        ], capture_output=True, text=True, timeout=120)
        
        if result.returncode == 0 and os.path.exists(audio_temp):
            safe_print(f"[Subtitle] Audio extracted successfully")
            return True
        else:
            safe_print(f"[Subtitle] FFmpeg audio extraction failed")
            return False
    except Exception as e:
        safe_print(f"[Subtitle] Error extracting audio: {e}")
        return False

def generate_subtitles_with_whisper(video_path, output_path):
    """Try to generate subtitles using Whisper"""
    safe_print(f"[Subtitle] Attempting Whisper transcription...")

    try:
        import whisper

        # Use tiny model for fastest processing (good enough for subtitles)
        model_name = os.environ.get('WHISPER_MODEL', 'tiny')
        safe_print(f"[Subtitle] Loading Whisper model: {model_name}")

        try:
            model = whisper.load_model(model_name, device='cpu')  # Force CPU
        except Exception as e:
            safe_print(f"[Subtitle] Warning: Could not load model '{model_name}': {e}")
            safe_print(f"[Subtitle] Trying fallback model: tiny")
            model = whisper.load_model('tiny', device='cpu')

        safe_print(f"[Subtitle] Transcribing audio (this may take a while)...")
        result = model.transcribe(video_path, language='en', verbose=False)

        segments = result.get('segments', [])

        if not segments:
            safe_print(f"[Subtitle] Whisper returned no segments")
            return False

        safe_print(f"[Subtitle] Got {len(segments)} segments, writing SRT...")

        # Write SRT file
        with open(output_path, 'w', encoding='utf-8') as f:
            for i, segment in enumerate(segments, 1):
                start = format_time_srt(segment.get('start', 0))
                end = format_time_srt(segment.get('end', 0))
                text = segment.get('text', '').strip()

                if text:  # Only write non-empty segments
                    f.write(f"{i}\n{start} --> {end}\n{text}\n\n")

        safe_print(f"✓ Subtitles generated via Whisper: {output_path}")
        return True

    except ImportError:
        safe_print(f"[Subtitle] Whisper not installed or import failed")
        return False
    except Exception as e:
        safe_print(f"[Subtitle] Whisper error: {e}")
        import traceback
        safe_print(f"[Subtitle] Full traceback:")
        traceback.print_exc()
        return False

def generate_placeholder_subtitles(video_path, output_path):
    """Generate placeholder subtitles with video duration info"""
    safe_print(f"[Subtitle] Generating placeholder subtitles...")
    
    try:
        import cv2
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            safe_print(f"[Subtitle] Cannot determine video duration")
            duration = 60
        else:
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = frame_count / fps if fps > 0 else 60
            cap.release()
    except:
        duration = 60
    
    # Create SRT with placeholder content
    with open(output_path, 'w', encoding='utf-8') as f:
        segment_duration = 10  # 10-second segments
        segment_num = 1
        
        for i in range(int(duration / segment_duration) + 1):
            start = i * segment_duration
            end = min((i + 1) * segment_duration, duration)
            
            if start >= duration:
                break
            
            start_srt = format_time_srt(start)
            end_srt = format_time_srt(end)
            
            f.write(f"{segment_num}\n")
            f.write(f"{start_srt} --> {end_srt}\n")
            f.write(f"[Scene {segment_num}] - Automatic subtitles disabled\n\n")
            segment_num += 1
    
    safe_print(f"[Subtitle] Placeholder subtitles created (install Whisper for AI transcription)")
    return True

def download_streaming_url(video_url, temp_dir):
    """Download streaming video to temp file"""
    safe_print(f"[Subtitle] Downloading streaming video to temp file...")
    
    timestamp = int(time.time())
    base_name = f"sub_video_{timestamp}"
    base_path = os.path.join(temp_dir, base_name)
    
    ydl_opts = {
        'format': 'best[ext=mp4]/best',
        'quiet': True,
        'no_warnings': True,
        'outtmpl': base_path,
        'socket_timeout': 30,
        'http_chunk_size': 10485760,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])
        
        # Find downloaded file
        files = [f for f in os.listdir(temp_dir) if f.startswith(base_name)]
        
        matching_files = []
        for fname in files:
            fpath = os.path.join(temp_dir, fname)
            if os.path.isfile(fpath):
                size = os.path.getsize(fpath)
                if size > 1000000:  # At least 1MB
                    matching_files.append((fpath, size))
        
        if not matching_files:
            raise Exception(f"No valid video file found. Files: {files}")
        
        video_path = max(matching_files, key=lambda x: x[1])[0]
        safe_print(f"[Subtitle] Downloaded: {os.path.basename(video_path)} ({os.path.getsize(video_path) / 1024 / 1024:.1f} MB)")
        
        return video_path
    
    except Exception as e:
        safe_print(f"[Subtitle] Download failed: {e}")
        import traceback
        traceback.print_exc()
        raise

def main():
    # Validate arguments
    if len(sys.argv) < 3:
        safe_print("Usage: python subtitle_generator.py <video_path> <output_path>")
        sys.exit(1)
    
    video_path = sys.argv[1]
    output_path = sys.argv[2]
    
    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    
    safe_print(f"[Subtitle] Starting subtitle generation...")
    safe_print(f"  Input: {video_path}")
    safe_print(f"  Output: {output_path}")
    
    # If it's a streaming URL, we MUST download it first
    actual_video_path = video_path
    temp_dir = None
    
    if video_path.startswith('http'):
        safe_print(f"[Subtitle] Streaming URL detected, downloading to temp file...")
        temp_dir = tempfile.mkdtemp()
        
        try:
            actual_video_path = download_streaming_url(video_path, temp_dir)
        except Exception as e:
            safe_print(f"[Subtitle] Download failed: {e}")
            safe_print(f"[Subtitle] Falling back to placeholder subtitles")
            generate_placeholder_subtitles(video_path, output_path)
            sys.exit(0)
    
    try:
        # Now use actual_video_path (local file)
        success = generate_subtitles_with_whisper(actual_video_path, output_path)
        
        if not success:
            safe_print(f"[Subtitle] Whisper failed, using placeholder...")
            success = generate_placeholder_subtitles(actual_video_path, output_path)
        
        # Cleanup temp dir
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
            safe_print(f"[Subtitle] Cleaned up temp directory")
        
        if success and os.path.exists(output_path):
            file_size = os.path.getsize(output_path)
            safe_print(f"✓ Subtitles saved ({file_size} bytes)")
            sys.exit(0)
        else:
            safe_print(f"[Subtitle] ERROR: Could not generate subtitles")
            sys.exit(1)
    
    except Exception as e:
        safe_print(f"[Subtitle] FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        
        # Cleanup temp dir on error
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        
        sys.exit(1)

if __name__ == '__main__':
    main()
# -*- coding: utf-8 -*-
import sys
import os
import subprocess
import tempfile
import time
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

def download_streaming_url(url, temp_dir):
    """Download streaming video to temp file"""
    safe_print("[Trailer] Downloading streaming video to temp file...")
    
    timestamp = int(time.time())
    base_name = f"trailer_video_{timestamp}"
    base_path = os.path.join(temp_dir, base_name)
    
    ydl_opts = {
        'format': 'best[ext=mp4]/best',
        'quiet': False,
        'no_warnings': True,
        'outtmpl': base_path,
        'socket_timeout': 30,
        'http_chunk_size': 10485760,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        
        # Find downloaded file
        temp_files = []
        if os.path.exists(temp_dir):
            temp_files = os.listdir(temp_dir)
            temp_files = [f for f in temp_files if f.startswith(base_name)]
        
        matching_files = []
        for fname in temp_files:
            fpath = os.path.join(temp_dir, fname)
            if os.path.isfile(fpath):
                size = os.path.getsize(fpath)
                if size > 1000000:
                    matching_files.append((fpath, size))
        
        if not matching_files:
            raise Exception(f"No valid video file found")
        
        video_path = max(matching_files, key=lambda x: x[1])[0]
        safe_print(f"[Trailer] Downloaded: {os.path.basename(video_path)} ({os.path.getsize(video_path) / 1024 / 1024:.1f} MB)")
        
        return video_path
    
    except Exception as e:
        safe_print(f"[Trailer] Download failed: {e}")
        raise

def get_video_duration(video_path):
    """Get video duration using ffprobe"""
    try:
        ffprobe_cmd = [
            'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1:nokey=1', video_path
        ]
        
        result = subprocess.run(ffprobe_cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            return float(result.stdout.strip())
        else:
            return None
    except:
        return None

def generate_highlight_trailer(video_path, output_path, mode='highlights'):
    """Create trailer - works with both local files and streaming URLs"""
    
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    
    safe_print(f"[Trailer] Generating trailer: {output_path}")
    
    # Check if it's a streaming URL or local file
    is_streaming = video_path.startswith('http://') or video_path.startswith('https://')
    actual_video_path = video_path
    temp_dir = None
    
    # If streaming URL, download to temp file
    if is_streaming:
        temp_dir = tempfile.mkdtemp()
        try:
            actual_video_path = download_streaming_url(video_path, temp_dir)
        except Exception as e:
            safe_print(f"[Trailer] ERROR: Failed to download video: {e}")
            return False
    
    # Get video duration
    total_duration = get_video_duration(actual_video_path)
    
    if not total_duration or total_duration <= 0:
        safe_print("[Trailer] ERROR: Could not determine video duration")
        return False
    
    safe_print(f"[Trailer] Video duration: {total_duration:.1f}s")
    
    segments = []
    
    if mode == 'highlights' or mode == 'highlight':
        # Uniform sampling for highlights
        safe_print("[Trailer] Using uniform sampling for best moments...")
        num_samples = 4
        interval = total_duration / (num_samples + 1)
        
        for i in range(1, num_samples + 1):
            start = interval * i
            clip_duration = min(5, total_duration / num_samples)
            end = min(total_duration, start + clip_duration)
            segments.append((start, end))
        
        safe_print(f"[Trailer] Selected {len(segments)} segments (~{len(segments) * 5:.1f}s total)")
    
    else:
        # Fixed duration
        try:
            duration = int(mode)
        except:
            duration = 15
        
        duration = min(duration, int(total_duration))
        segments = [(0, duration)]
        safe_print(f"[Trailer] Using fixed duration: {duration}s")
    
    if not segments:
        safe_print("[Trailer] ERROR: No segments to process")
        return False
    
    # Create trailer
    success = create_trailer_from_segments(actual_video_path, output_path, segments)
    
    # Cleanup temp directory if we created one
    if temp_dir and os.path.exists(temp_dir):
        try:
            import shutil
            shutil.rmtree(temp_dir)
            safe_print(f"[Trailer] Cleaned up temp directory")
        except:
            pass
    
    return success

def create_trailer_from_segments(video_path, output_path, segments):
    """Extract segments and concatenate"""
    
    temp_files = []
    concat_list = []
    
    safe_print(f"[Trailer] Extracting {len(segments)} segments...")
    
    for i, (start, end) in enumerate(segments):
        temp_file = f"{output_path}_seg_{i}.mp4"
        temp_files.append(temp_file)
        
        ff_cmd = [
            'ffmpeg', '-y', '-i', video_path,
            '-ss', str(start),
            '-to', str(end),
            '-c:v', 'libx264',
            '-c:a', 'aac',
            '-preset', 'veryfast',
            '-crf', '28',
            '-pix_fmt', 'yuv420p',
            temp_file
        ]
        
        safe_print(f"  Segment {i+1}: {start:.1f}s - {end:.1f}s")
        
        try:
            result = subprocess.run(ff_cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0 and os.path.exists(temp_file) and os.path.getsize(temp_file) > 5000:
                concat_list.append(f"file '{temp_file}'")
            else:
                safe_print(f"  [Warning] Failed to extract segment {i+1}")
        except subprocess.TimeoutExpired:
            safe_print(f"  [Warning] Segment {i+1} timed out")
        except Exception as e:
            safe_print(f"  [Warning] Segment {i+1} error: {e}")
    
    if not concat_list:
        safe_print("[Trailer] ERROR: No segments extracted")
        for f in temp_files:
            try:
                if os.path.exists(f):
                    os.remove(f)
            except:
                pass
        return False
    
    # Create concat file
    concat_file = f"{output_path}_concat.txt"
    try:
        with open(concat_file, 'w') as f:
            f.write('\n'.join(concat_list))
    except Exception as e:
        safe_print(f"[Trailer] ERROR: Cannot write concat file: {e}")
        for f in temp_files + [concat_file]:
            try:
                if os.path.exists(f):
                    os.remove(f)
            except:
                pass
        return False
    
    # Concatenate
    safe_print("[Trailer] Concatenating segments...")
    
    concat_cmd = [
        'ffmpeg', '-y', '-f', 'concat', '-safe', '0',
        '-i', concat_file,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'veryfast',
        '-crf', '28',
        '-pix_fmt', 'yuv420p',
        output_path
    ]
    
    try:
        result = subprocess.run(concat_cmd, capture_output=True, text=True, timeout=120)
    except subprocess.TimeoutExpired:
        safe_print("[Trailer] ERROR: Concatenation timed out")
        result = None
    
    # Cleanup
    for f in temp_files + [concat_file]:
        try:
            if os.path.exists(f):
                os.remove(f)
        except:
            pass
    
    if not result or result.returncode != 0:
        safe_print("[Trailer] ERROR: Concatenation failed")
        return False
    
    # Verify
    if not os.path.exists(output_path) or os.path.getsize(output_path) < 10000:
        safe_print("[Trailer] ERROR: Output file not created")
        return False
    
    file_size_mb = os.path.getsize(output_path) / 1024 / 1024
    safe_print(f"✓ Trailer created: {output_path} ({file_size_mb:.2f} MB)")
    
    return True

def main():
    if len(sys.argv) < 3:
        safe_print("Usage: python trailer_generator.py <video_path|url> <output_path> [mode]")
        sys.exit(1)
    
    video_path = sys.argv[1]
    output_path = sys.argv[2]
    mode = sys.argv[3] if len(sys.argv) > 3 else 'highlights'
    
    # Check if local file exists (for uploaded files)
    is_local = os.path.exists(video_path)
    is_url = video_path.startswith('http://') or video_path.startswith('https://')
    
    if not is_local and not is_url:
        safe_print(f"[Trailer] ERROR: Invalid input: {video_path}")
        sys.exit(1)
    
    try:
        success = generate_highlight_trailer(video_path, output_path, mode)
        sys.exit(0 if success else 1)
    except Exception as e:
        safe_print(f"[Trailer] FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
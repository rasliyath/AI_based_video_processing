# -*- coding: utf-8 -*-
import sys
import os
import subprocess
import tempfile
import time
import yt_dlp
import numpy as np

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

def extract_audio_to_wav(video_path, audio_temp_path):
    """Extract audio from video using ffmpeg"""
    try:
        safe_print("[Trailer] Extracting audio from video...")
        result = subprocess.run([
            'ffmpeg', '-i', video_path, '-q:a', '9', '-n', audio_temp_path
        ], capture_output=True, text=True, timeout=120)
        
        if result.returncode == 0 and os.path.exists(audio_temp_path):
            size_mb = os.path.getsize(audio_temp_path) / 1024 / 1024
            safe_print(f"[Trailer] ✓ Audio extracted ({size_mb:.1f} MB)")
            return True
        else:
            safe_print(f"[Trailer] Failed to extract audio")
            return False
    except Exception as e:
        safe_print(f"[Trailer] Error extracting audio: {e}")
        return False

def detect_audio_peaks(audio_path, num_peaks=5):
    """
    Detect audio peaks (loud moments, dialogue, excitement) using librosa.
    Returns list of timestamps with high audio energy.
    """
    try:
        import librosa
        from scipy.signal import find_peaks
        
        safe_print("[Trailer] Analyzing audio for exciting moments...")
        
        # Load audio
        y, sr = librosa.load(audio_path, sr=22050)
        safe_print(f"[Trailer] Audio loaded: {len(y)} samples @ {sr} Hz")
        
        # Compute mel-spectrogram (frequency content over time)
        S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128)
        
        # Convert to dB scale
        S_db = librosa.power_to_db(S, ref=np.max)
        
        # Get energy per frame (mean across frequencies)
        energy = np.mean(S_db, axis=0)
        
        # Find peaks (high energy moments)
        # Threshold: 70th percentile of energy
        threshold = np.percentile(energy, 70)
        safe_print(f"[Trailer] Energy threshold: {threshold:.1f} dB")
        
        # Detect peaks with minimum distance
        min_distance = sr // 512 // 2  # Minimum 0.5 seconds between peaks
        peaks, properties = find_peaks(energy, height=threshold, distance=min_distance)
        
        # Convert frame indices to time
        peak_times = librosa.frames_to_time(peaks, sr=sr)
        peak_energies = properties['peak_heights']
        
        # Sort by energy and get top N
        peak_data = list(zip(peak_times, peak_energies))
        peak_data.sort(key=lambda x: x[1], reverse=True)
        
        top_peaks = peak_data[:num_peaks]
        top_peaks.sort(key=lambda x: x[0])  # Sort by time
        
        result = [t for t, e in top_peaks]
        
        safe_print(f"[Trailer] ✓ Found {len(result)} audio peaks:")
        for i, t in enumerate(result):
            safe_print(f"  [{i+1}] {t:.1f}s")
        
        return result
    
    except ImportError:
        safe_print("[Trailer] WARNING: librosa not installed, skipping audio analysis")
        safe_print("[Trailer] Install with: pip install librosa scipy")
        return []
    except Exception as e:
        safe_print(f"[Trailer] Audio analysis failed: {e}")
        import traceback
        traceback.print_exc()
        return []

def detect_motion_peaks(video_path, num_peaks=5):
    """
    Detect high-motion moments using optical flow.
    Returns timestamps with high motion (action scenes).
    """
    try:
        import cv2
        
        safe_print("[Trailer] Analyzing video for motion peaks...")
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            safe_print("[Trailer] Cannot open video for motion analysis")
            return []
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        if fps <= 0 or total_frames <= 0:
            cap.release()
            return []
        
        motion_scores = []
        sample_rate = max(1, int(fps // 2))  # Sample every 0.5s
        prev_gray = None
        frame_num = 0
        
        safe_print(f"[Trailer] Sampling video: {total_frames} frames @ {fps:.1f} fps")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_num % sample_rate != 0:
                frame_num += 1
                continue
            
            try:
                # Resize for faster processing
                gray = cv2.cvtColor(
                    cv2.resize(frame, (320, 180)), 
                    cv2.COLOR_BGR2GRAY
                )
                
                if prev_gray is not None:
                    # Calculate motion using frame difference
                    flow = cv2.absdiff(prev_gray, gray)
                    motion = float(flow.mean())
                    
                    timestamp = frame_num / fps
                    motion_scores.append((timestamp, motion))
                
                prev_gray = gray
            except:
                pass
            
            frame_num += 1
        
        cap.release()
        
        if not motion_scores:
            return []
        
        safe_print(f"[Trailer] Analyzed {len(motion_scores)} frames")
        
        # Find high-motion moments
        motion_scores.sort(key=lambda x: x[1], reverse=True)
        top_motion = motion_scores[:num_peaks]
        top_motion.sort(key=lambda x: x[0])  # Sort by time
        
        result = [t for t, m in top_motion]
        
        safe_print(f"[Trailer] ✓ Found {len(result)} motion peaks:")
        for i, t in enumerate(result):
            safe_print(f"  [{i+1}] {t:.1f}s")
        
        return result
    
    except Exception as e:
        safe_print(f"[Trailer] Motion analysis failed: {e}")
        return []

def generate_highlight_trailer(video_path, output_path, mode='highlights'):
    """Create trailer using intelligent scene selection (audio + motion peaks)"""
    
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    
    safe_print(f"[Trailer] Generating highlight trailer: {output_path}")
    
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
        safe_print("[Trailer] Using intelligent highlight detection...")
        
        # Extract audio and detect peaks
        audio_temp = os.path.join(tempfile.gettempdir(), f"audio_{int(time.time())}.wav")
        audio_peaks = []
        
        try:
            if extract_audio_to_wav(actual_video_path, audio_temp):
                audio_peaks = detect_audio_peaks(audio_temp, num_peaks=3)
        except Exception as e:
            safe_print(f"[Trailer] Audio analysis failed: {e}")
        finally:
            if os.path.exists(audio_temp):
                try:
                    os.remove(audio_temp)
                except:
                    pass
        
        # Detect motion peaks
        motion_peaks = detect_motion_peaks(actual_video_path, num_peaks=3)
        
        # Combine audio and motion peaks
        key_moments = sorted(set(audio_peaks + motion_peaks))
        
        if key_moments:
            safe_print(f"[Trailer] ✓ Selected {len(key_moments)} key moments")
            
            # Create segments around key moments
            for moment in key_moments[:4]:  # Max 4 segments
                # Start 2 seconds before, end 3 seconds after
                start = max(0, moment - 2)
                end = min(total_duration, moment + 3)
                
                duration_seg = end - start
                if duration_seg > 2:  # Only include segments >= 2s
                    segments.append((start, end))
                    safe_print(f"  Segment: {start:.1f}s - {end:.1f}s ({duration_seg:.1f}s)")
        else:
            safe_print("[Trailer] No clear peaks found, using uniform sampling...")
            # Fallback to uniform sampling
            for i in range(4):
                start = (total_duration / 5) * i
                end = min(total_duration, start + 5)
                segments.append((start, end))
    
    else:
        # Fixed duration mode
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
    
    # Create trailer from segments
    success = create_trailer_from_segments(actual_video_path, output_path, segments)
    
    # Cleanup temp directory
    if temp_dir and os.path.exists(temp_dir):
        try:
            import shutil
            shutil.rmtree(temp_dir)
            safe_print(f"[Trailer] Cleaned up temp directory")
        except:
            pass
    
    return success

def create_trailer_from_segments(video_path, output_path, segments):
    """Extract segments and concatenate into trailer"""
    
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
        
        safe_print(f"  Segment {i+1}/{len(segments)}: {start:.1f}s - {end:.1f}s")
        
        try:
            result = subprocess.run(ff_cmd, capture_output=True, text=True, timeout=60)
            
            if result.returncode == 0 and os.path.exists(temp_file) and os.path.getsize(temp_file) > 5000:
                concat_list.append(f"file '{temp_file}'")
            else:
                safe_print(f"    [Warning] Failed to extract segment {i+1}")
        except subprocess.TimeoutExpired:
            safe_print(f"    [Warning] Segment {i+1} timed out")
        except Exception as e:
            safe_print(f"    [Warning] Segment {i+1} error: {e}")
    
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
    safe_print(f"✓ Highlight trailer created: {output_path} ({file_size_mb:.2f} MB)")
    
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
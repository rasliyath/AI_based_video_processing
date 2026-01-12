# -*- coding: utf-8 -*-
import sys
import os
import subprocess
import json
import cv2
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

def detect_scene_changes(video_path, threshold=25.0, max_scenes=5):
    """Detect scene boundaries using histogram difference"""
    safe_print("[Trailer] Detecting scene changes...")
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        safe_print("[Trailer] Warning: Cannot analyze scenes")
        return []
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    prev_hist = None
    scenes = []
    frame_num = 0
    sample_rate = max(1, int(fps / 2))  # Sample every 0.5s to speed up
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Only check every nth frame
        if frame_num % sample_rate != 0:
            frame_num += 1
            continue
        
        try:
            # Resize for faster processing
            small = cv2.resize(frame, (320, 180))
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
            
            if prev_hist is not None:
                # Compute histogram difference
                hist_diff = cv2.compareHist(
                    prev_hist, hist, cv2.HISTCMP_BHATTACHARYYA
                )
                
                if hist_diff > threshold:
                    scenes.append({
                        'frame': frame_num,
                        'timestamp': frame_num / fps,
                        'diff': float(hist_diff)
                    })
            
            prev_hist = hist
        except:
            pass
        
        frame_num += 1
    
    cap.release()
    
    # Sort by difference and take top scenes
    scenes.sort(key=lambda x: x['diff'], reverse=True)
    scenes = scenes[:max_scenes]
    scenes.sort(key=lambda x: x['timestamp'])  # Re-sort by time
    
    safe_print(f"[Trailer] Found {len(scenes)} scene changes")
    return scenes

def detect_audio_peaks(video_path, max_peaks=5):
    """Detect moments with high audio energy"""
    safe_print("[Trailer] Analyzing audio peaks...")
    
    try:
        import librosa
        from scipy.signal import find_peaks
        
        # Extract audio to temp file
        audio_temp = '/tmp/audio_temp.wav'
        
        result = subprocess.run([
            'ffmpeg', '-i', video_path, '-q:a', '9', '-n', audio_temp
        ], capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0 or not os.path.exists(audio_temp):
            safe_print("[Trailer] Warning: Could not extract audio")
            return []
        
        # Load and analyze
        y, sr = librosa.load(audio_temp, sr=None)
        
        # Get energy envelope
        S = librosa.feature.melspectrogram(y=y, sr=sr, n_fft=2048, hop_length=512)
        log_S = librosa.power_to_db(S, ref=np.max)
        energy = np.mean(log_S, axis=0)
        
        # Find peaks
        mean_energy = np.mean(energy)
        std_energy = np.std(energy)
        threshold = mean_energy + std_energy
        
        peaks, _ = find_peaks(energy, height=threshold, distance=int(sr / 512))
        
        # Clean up
        try:
            os.remove(audio_temp)
        except:
            pass
        
        # Convert frame indices to timestamps
        hop_length = 512
        peak_times = [(p * hop_length) / sr for p in peaks]
        
        # Get top peaks by energy
        peak_data = [
            {'timestamp': t, 'energy': float(energy[int(t * sr / hop_length)])}
            for t in peak_times
        ]
        peak_data.sort(key=lambda x: x['energy'], reverse=True)
        peak_data = peak_data[:max_peaks]
        peak_data.sort(key=lambda x: x['timestamp'])
        
        safe_print(f"[Trailer] Found {len(peak_data)} audio peaks")
        return peak_data
    
    except ImportError:
        safe_print("[Trailer] librosa not installed, skipping audio analysis")
        return []
    except Exception as e:
        safe_print(f"[Trailer] Audio analysis error: {e}")
        return []

def generate_highlight_trailer(video_path, output_path, mode='highlights'):
    """Create trailer from best moments or fixed duration"""
    
    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    
    safe_print(f"[Trailer] Generating trailer: {output_path}")
    
    # Get video info
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        safe_print("[Trailer] ERROR: Cannot open video")
        return False
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    total_duration = total_frames / fps if fps > 0 else 0
    cap.release()
    
    safe_print(f"[Trailer] Video info: {total_duration:.1f}s, {fps:.1f} fps")
    
    if total_duration <= 0:
        safe_print("[Trailer] ERROR: Invalid video duration")
        return False
    
    segments = []
    
    if mode == 'highlights' or mode == 'highlight':
        # Detect scenes and audio peaks
        scenes = detect_scene_changes(video_path, threshold=20.0, max_scenes=3)
        audio_peaks = detect_audio_peaks(video_path, max_peaks=3)
        
        # Combine moments
        best_moments = []
        
        for scene in scenes:
            best_moments.append(scene['timestamp'])
        
        for peak in audio_peaks:
            best_moments.append(peak['timestamp'])
        
        # Remove duplicates and sort
        best_moments = sorted(set(best_moments))
        
        if not best_moments:
            safe_print("[Trailer] No highlights detected, using uniform sampling")
            # Fallback: sample evenly
            num_samples = 3
            interval = total_duration / (num_samples + 1)
            best_moments = [interval * i for i in range(1, num_samples + 1)]
        
        safe_print(f"[Trailer] Selected {len(best_moments)} highlight moments")
        
        # Extract 3-second clips around each moment
        segment_duration = 3
        for moment in best_moments:
            start = max(0, moment - segment_duration / 2)
            end = min(total_duration, start + segment_duration)
            segments.append((start, end))
    
    else:
        # Fixed duration (first N seconds)
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
    
    # Extract and concatenate segments using FFmpeg
    return create_trailer_from_segments(video_path, output_path, segments, fps)

def create_trailer_from_segments(video_path, output_path, segments, fps):
    """Extract segments and concatenate into single video"""
    
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
            '-preset', 'fast',
            '-pix_fmt', 'yuv420p',
            temp_file
        ]
        
        safe_print(f"  Segment {i+1}: {start:.1f}s - {end:.1f}s")
        
        result = subprocess.run(ff_cmd, capture_output=True, text=True, timeout=120)
        
        if result.returncode == 0 and os.path.exists(temp_file):
            concat_list.append(f"file '{temp_file}'")
        else:
            safe_print(f"  [Warning] Failed to extract segment {i+1}")
    
    if not concat_list:
        safe_print("[Trailer] ERROR: No segments extracted")
        return False
    
    # Create concat file
    concat_file = f"{output_path}_concat.txt"
    try:
        with open(concat_file, 'w') as f:
            f.write('\n'.join(concat_list))
    except Exception as e:
        safe_print(f"[Trailer] ERROR: Cannot write concat file: {e}")
        return False
    
    # Concatenate segments
    safe_print("[Trailer] Concatenating segments...")
    
    concat_cmd = [
        'ffmpeg', '-y', '-f', 'concat', '-safe', '0',
        '-i', concat_file,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'fast',
        '-pix_fmt', 'yuv420p',
        output_path
    ]
    
    result = subprocess.run(concat_cmd, capture_output=True, text=True, timeout=180)
    
    # Cleanup temp files
    for f in temp_files + [concat_file]:
        try:
            if os.path.exists(f):
                os.remove(f)
        except:
            pass
    
    if result.returncode != 0:
        safe_print(f"[Trailer] ERROR: Concatenation failed: {result.stderr}")
        return False
    
    # Verify output
    if not os.path.exists(output_path) or os.path.getsize(output_path) < 10000:
        safe_print("[Trailer] ERROR: Output file not created or too small")
        return False
    
    file_size_mb = os.path.getsize(output_path) / 1024 / 1024
    safe_print(f"✓ Trailer created: {output_path} ({file_size_mb:.2f} MB)")
    
    return True

def is_url(path):
    """Check if path is a URL"""
    return path.startswith('http://') or path.startswith('https://')

def main():
    # Validate arguments
    if len(sys.argv) < 3:
        safe_print("Usage: python trailer_generator.py <video_path|url> <output_path> [mode|duration]")
        safe_print("  mode: 'highlights' (detect best moments) or integer duration in seconds")
        sys.exit(1)
    
    video_path = sys.argv[1]
    output_path = sys.argv[2]
    mode = sys.argv[3] if len(sys.argv) > 3 else 'highlights'
    
    # Verify input file or URL
    if not is_url(video_path) and not os.path.exists(video_path):
        safe_print(f"[Trailer] ERROR: Input file not found: {video_path}")
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
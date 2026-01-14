# -*- coding: utf-8 -*-
import sys
import os
import cv2
import numpy as np
import random
import time
import yt_dlp
import tempfile
import subprocess

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

def download_youtube_video(url, temp_dir):
    """Download YouTube video directly using yt-dlp (handles HLS/DASH properly)"""
    safe_print("[Thumbnail] Downloading YouTube video...")
    
    timestamp = int(time.time())
    output_template = os.path.join(temp_dir, f"video_{timestamp}.%(ext)s")
    
    ydl_opts = {
        'format': 'best[height<=720][ext=mp4]/best[ext=mp4]/best',  # Prefer 720p or lower
        'quiet': False,
        'no_warnings': False,
        'outtmpl': output_template,
        'socket_timeout': 60,
        'http_chunk_size': 10485760,  # 10MB chunks
        'retries': 3,  # Retry failed fragments
        'fragment_retries': 10,  # Retry individual fragments
        'skip_unavailable_fragments': True,  # Skip missing fragments instead of failing
        'no_check_certificate': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'web'],
                'player_skip': ['js', 'configs', 'webpage'],
            }
        },
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    }
    
    try:
        safe_print("[Thumbnail] Starting download with yt-dlp...")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            
            if not os.path.exists(filename):
                raise Exception(f"Downloaded file not found: {filename}")
            
            file_size = os.path.getsize(filename) / 1024 / 1024
            
            if file_size < 1:
                raise Exception(f"Downloaded file is too small: {file_size:.1f} MB")
            
            safe_print(f"[Thumbnail] ✓ Downloaded successfully: {os.path.basename(filename)} ({file_size:.1f} MB)")
            return filename
    
    except Exception as e:
        safe_print(f"[Thumbnail] ✗ Download failed: {e}")
        raise

def download_streaming_video_ffmpeg(url, temp_dir):
    """
    Fallback: Use FFmpeg to download streaming video directly.
    More reliable for HLS/DASH streams.
    """
    safe_print("[Thumbnail] FFmpeg fallback: Downloading stream directly...")
    
    timestamp = int(time.time())
    output_path = os.path.join(temp_dir, f"video_{timestamp}.mp4")
    
    ffmpeg_cmd = [
        'ffmpeg',
        '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        '-i', url,
        '-c:v', 'copy',  # Copy video codec (no re-encoding)
        '-c:a', 'aac',   # Re-encode audio to AAC
        '-bsf:a', 'aac_adtstoasc',  # AAC to MP4 conversion
        '-y',  # Overwrite output file
        output_path
    ]
    
    try:
        safe_print("[Thumbnail] Running FFmpeg download...")
        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            safe_print(f"[Thumbnail] FFmpeg error output: {result.stderr[-500:]}")
            raise Exception(f"FFmpeg failed with code {result.returncode}")
        
        if not os.path.exists(output_path):
            raise Exception("Output file not created by FFmpeg")
        
        file_size = os.path.getsize(output_path) / 1024 / 1024
        
        if file_size < 1:
            raise Exception(f"Downloaded file too small: {file_size:.1f} MB")
        
        safe_print(f"[Thumbnail] ✓ FFmpeg download complete: {file_size:.1f} MB")
        return output_path
    
    except subprocess.TimeoutExpired:
        safe_print("[Thumbnail] FFmpeg timeout - stream may be too long or unstable")
        raise Exception("Download timed out after 5 minutes")
    except Exception as e:
        safe_print(f"[Thumbnail] FFmpeg download failed: {e}")
        raise

def download_streaming_video(url, temp_dir):
    """Download streaming video - tries yt-dlp first, then FFmpeg fallback"""
    
    # If it's a direct HLS/DASH URL (not YouTube)
    if url.startswith('https://manifest.googlevideo.com') or '.m3u8' in url or '.mpd' in url:
        safe_print("[Thumbnail] Detected HLS/DASH stream URL, using FFmpeg...")
        return download_streaming_video_ffmpeg(url, temp_dir)
    
    # Try yt-dlp first (better for YouTube)
    try:
        return download_youtube_video(url, temp_dir)
    except Exception as e:
        safe_print(f"[Thumbnail] yt-dlp failed, trying FFmpeg fallback...")
        try:
            return download_streaming_video_ffmpeg(url, temp_dir)
        except Exception as e2:
            safe_print(f"[Thumbnail] Both methods failed:")
            safe_print(f"  yt-dlp: {e}")
            safe_print(f"  FFmpeg: {e2}")
            raise Exception("Failed to download video with both yt-dlp and FFmpeg")

def detect_scene_changes(video_path, threshold=25.0, max_scenes=5):
    """Detect scene boundaries using histogram difference"""
    safe_print("[Thumbnail] Detecting scene changes...")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        safe_print("[Thumbnail] Warning: Cannot analyze scenes")
        return []

    fps = cap.get(cv2.CAP_PROP_FPS)
    prev_hist = None
    scenes = []
    frame_num = 0
    sample_rate = max(1, int(fps / 2)) if fps > 0 else 1

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_num % sample_rate != 0:
            frame_num += 1
            continue

        try:
            small = cv2.resize(frame, (320, 180))
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            hist = cv2.calcHist([gray], [0], None, [256], [0, 256])

            if prev_hist is not None:
                hist_diff = cv2.compareHist(
                    prev_hist, hist, cv2.HISTCMP_BHATTACHARYYA
                )

                if hist_diff > threshold:
                    scenes.append({
                        'frame': frame_num,
                        'timestamp': frame_num / fps if fps > 0 else 0,
                        'diff': float(hist_diff)
                    })

            prev_hist = hist
        except:
            pass

        frame_num += 1

    cap.release()

    scenes.sort(key=lambda x: x['diff'], reverse=True)
    scenes = scenes[:max_scenes]
    scenes.sort(key=lambda x: x['timestamp'])

    safe_print(f"[Thumbnail] Found {len(scenes)} scene changes")
    return scenes

def score_frame_quality_strict(frame, motion=0.0):
    """
    STRICT quality scoring - rejects blurry/bad frames.
    Returns 0.0 if frame fails quality checks.
    """
    try:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # 1. SHARPNESS CHECK (Most Important!)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        sharpness = laplacian.var()
        
        if sharpness < 50:
            return 0.0  # FAIL - Too blurry
        
        sharpness_score = min((sharpness - 50) / 450, 1.0)

        # 2. BRIGHTNESS CHECK
        brightness = np.mean(gray)
        
        if brightness < 50 or brightness > 220:
            return 0.0  # FAIL - Bad lighting
        
        brightness_score = 1 - abs(brightness - 128) / 128

        # 3. CONTRAST CHECK
        contrast = np.std(gray)
        
        if contrast < 20:
            return 0.0  # FAIL - No contrast
        
        contrast_score = min(contrast / 80, 1.0)

        # 4. FACE DETECTION
        face_score = 0.3
        try:
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )
            faces = face_cascade.detectMultiScale(gray, 1.1, 4, minSize=(30, 30))
            if len(faces) > 0:
                face_score = 1.0
        except:
            pass

        # 5. MOTION CHECK
        if motion > 50:
            return 0.0  # FAIL - Too much motion blur
        
        motion_score = max(0, 1 - (motion / 30))

        # FINAL SCORE
        score = (
            sharpness_score * 0.40 +
            contrast_score * 0.20 +
            brightness_score * 0.15 +
            face_score * 0.15 +
            motion_score * 0.10
        )
        
        return float(score)
    
    except:
        return 0.0

def score_frame_quality_relaxed(frame, motion=0.0):
    """
    RELAXED quality scoring - used when strict filtering doesn't yield enough frames.
    Doesn't hard-reject frames, scores them more leniently.
    """
    try:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Sharpness (relaxed threshold)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        sharpness = laplacian.var()
        sharpness_score = min(max(0, (sharpness - 30) / 300), 1.0)
        
        # Brightness (wider range allowed)
        brightness = np.mean(gray)
        brightness_score = 1 - abs(brightness - 128) / 150
        brightness_score = max(0.1, min(brightness_score, 1.0))
        
        # Contrast (relaxed)
        contrast = np.std(gray)
        contrast_score = min(max(0, (contrast - 10) / 80), 1.0)
        
        # Face detection
        face_score = 0.2
        try:
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )
            faces = face_cascade.detectMultiScale(gray, 1.1, 4, minSize=(30, 30))
            if len(faces) > 0:
                face_score = 0.8
        except:
            pass

        # Motion (relaxed)
        motion_score = max(0, 1 - (motion / 50))
        
        # Final score (no hard rejection)
        score = (
            sharpness_score * 0.30 +
            contrast_score * 0.20 +
            brightness_score * 0.20 +
            face_score * 0.20 +
            motion_score * 0.10
        )
        
        return float(max(0.05, score))
    
    except:
        return 0.1

def generate_smart_thumbnails(video_path, output_dir, num_candidates=20):
    """Generate MINIMUM 10 thumbnails from video with smart quality filtering"""
    
    # If it's a streaming URL, download it first
    if video_path.startswith('http'):
        temp_dir = tempfile.mkdtemp()
        try:
            video_path = download_streaming_video(video_path, temp_dir)
        except Exception as e:
            safe_print(f"[Thumbnail] ERROR: Failed to download video: {e}")
            return 0
    
    safe_print(f"[Thumbnail] Opening video: {video_path}")
    
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        safe_print("[Thumbnail] ERROR: Cannot open video file")
        return 0
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frame_count / fps if fps > 0 else 0
    
    if frame_count <= 0:
        safe_print(f"[Thumbnail] ERROR: Invalid frame count: {frame_count}")
        cap.release()
        return 0
    
    safe_print(f"[Thumbnail] Video info: {duration:.1f}s, {frame_count} frames, {fps:.1f} fps")
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Detect scene changes
    scenes = detect_scene_changes(video_path, threshold=15.0, max_scenes=15)
    sample_positions = [int(s['timestamp'] * fps) for s in scenes]

    random.seed(time.time())
    num_random = max(0, num_candidates - len(sample_positions))

    for _ in range(num_random):
        if random.random() < 0.3 and scenes:
            scene = random.choice(scenes)
            offset = random.randint(-int(fps*3), int(fps*3))
            pos = max(0, min(frame_count - 1, int(scene['timestamp'] * fps) + offset))
        else:
            pos = random.randint(0, frame_count - 1)
        sample_positions.append(pos)

    sample_positions = list(set(sample_positions))
    random.shuffle(sample_positions)
    sample_positions = sample_positions[:num_candidates]
    safe_print(f"[Thumbnail] Sampling {len(sample_positions)} candidate frames...\n")
    
    candidates = []
    prev_gray = None
    
    for idx, pos in enumerate(sample_positions):
        try:
            cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
            ret, frame = cap.read()
            
            if not ret or frame is None:
                continue
            
            h, w = frame.shape[:2]
            if w > 640:
                scale = 640 / float(w)
                frame = cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
            
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            if prev_gray is not None:
                diff = cv2.absdiff(prev_gray, gray)
                motion = float(diff.mean())
            else:
                motion = 0.0
            
            prev_gray = gray
            score = score_frame_quality_strict(frame, motion)
            
            # Only add if passed strict quality check
            if score > 0:
                candidates.append({
                    'frame': frame,
                    'score': score,
                    'position': pos,
                    'timestamp': pos / fps if fps > 0 else 0,
                    'motion': motion
                })
        
        except Exception as e:
            continue
    
    cap.release()
    
    safe_print(f"[Thumbnail] Strict filter: {len(candidates)} frames passed quality checks")
    
    # ====================================================
    # FALLBACK: If < 10 frames, use relaxed scoring
    # ====================================================
    if len(candidates) < 10:
        safe_print(f"[Thumbnail] ⚠ Only {len(candidates)} high-quality frames found")
        safe_print(f"[Thumbnail] Re-scanning with RELAXED threshold...")
        
        cap = cv2.VideoCapture(video_path)
        prev_gray = None
        
        for pos in sample_positions:
            try:
                cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
                ret, frame = cap.read()
                
                if not ret or frame is None:
                    continue
                
                h, w = frame.shape[:2]
                if w > 640:
                    scale = 640 / float(w)
                    frame = cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
                
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                
                if prev_gray is not None:
                    diff = cv2.absdiff(prev_gray, gray)
                    motion = float(diff.mean())
                else:
                    motion = 0.0
                
                prev_gray = gray
                score = score_frame_quality_relaxed(frame, motion)
                
                # Check if already in candidates
                if not any(c['position'] == pos for c in candidates):
                    candidates.append({
                        'frame': frame,
                        'score': score,
                        'position': pos,
                        'timestamp': pos / fps if fps > 0 else 0,
                        'motion': motion
                    })
            except:
                continue
        
        cap.release()
        safe_print(f"[Thumbnail] ✓ Relaxed filter: Now have {len(candidates)} total candidates")
    
    if not candidates:
        safe_print("[Thumbnail] ERROR: No candidates found even with relaxed threshold")
        return 0
    
    # Sort by quality score
    candidates.sort(key=lambda x: x['score'], reverse=True)
    
    # Ensure MINIMUM 10 thumbnails
    num_to_save = max(10, min(len(candidates), 15))
    top_candidates = candidates[:num_to_save]
    
    # Sort by timestamp (chronological order for diverse coverage)
    best_frames = sorted(top_candidates, key=lambda x: x['position'])
    
    safe_print(f"[Thumbnail] Saving {len(best_frames)} thumbnails...\n")
    saved_count = 0
    
    for i, item in enumerate(best_frames):
        try:
            output_path = os.path.join(output_dir, f'thumb_{i+1:02d}.jpg')
            
            success = cv2.imwrite(
                output_path, 
                item['frame'], 
                [cv2.IMWRITE_JPEG_QUALITY, 95]
            )
            
            if success:
                safe_print(f"  [{i+1:2d}] thumb_{i+1:02d}.jpg")
                safe_print(f"       └─ Score: {item['score']:.3f} | Time: {item['timestamp']:.1f}s")
                saved_count += 1
            else:
                safe_print(f"  [!] Failed to save thumb_{i+1:02d}.jpg")
        
        except Exception as e:
            safe_print(f"  [!] Error saving thumbnail {i+1}: {e}")
    
    safe_print(f"\n✓ Generated {saved_count} thumbnails")
    return saved_count

def main():
    if len(sys.argv) < 3:
        safe_print("Usage: python thumbnail_generator.py <video_path> <output_dir> [num_candidates]")
        sys.exit(1)
    
    video_path = sys.argv[1]
    output_dir = sys.argv[2]
    num_candidates = int(sys.argv[3]) if len(sys.argv) > 3 else 20
    
    try:
        count = generate_smart_thumbnails(video_path, output_dir, num_candidates)
        sys.exit(0 if count >= 10 else 1)
    except Exception as e:
        safe_print(f"[Thumbnail] FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
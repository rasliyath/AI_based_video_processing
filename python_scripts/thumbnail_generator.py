# -*- coding: utf-8 -*-
import sys
import os
import cv2
import numpy as np
import random
import time
import yt_dlp
import tempfile

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

def download_streaming_video(url, temp_dir):
    """Download streaming video (HLS/DASH) to temporary local file"""
    safe_print("[Thumbnail] Downloading streaming video to temp file...")
    
    timestamp = int(time.time())
    base_name = f"video_{timestamp}"
    base_path = os.path.join(temp_dir, base_name)
    
    ydl_opts = {
        'format': 'best[ext=mp4]/best',
        'quiet': False,
        'no_warnings': True,
        'outtmpl': base_path,  # No extension - yt-dlp adds it
        'socket_timeout': 30,
        'http_chunk_size': 10485760,  # 10MB chunks
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.download([url])
        
        # yt-dlp adds extension automatically after download
        # Check for files that were created
        temp_files = []
        if os.path.exists(temp_dir):
            temp_files = os.listdir(temp_dir)
            temp_files = [f for f in temp_files if f.startswith(base_name)]
        
        safe_print(f"[Thumbnail] Files in temp dir: {temp_files}")
        
        # Look for the most recently modified file with our base name
        matching_files = []
        for fname in temp_files:
            fpath = os.path.join(temp_dir, fname)
            if os.path.isfile(fpath):
                size = os.path.getsize(fpath)
                if size > 1000000:  # At least 1MB
                    matching_files.append((fpath, size))
        
        if not matching_files:
            raise Exception(f"No valid video file found. Temp files: {temp_files}")
        
        # Use the largest file
        video_path = max(matching_files, key=lambda x: x[1])[0]
        safe_print(f"[Thumbnail] Using downloaded file: {os.path.basename(video_path)} ({os.path.getsize(video_path) / 1024 / 1024:.1f} MB)")
        
        return video_path
    
    except Exception as e:
        safe_print(f"[Thumbnail] Download failed: {e}")
        import traceback
        traceback.print_exc()
        raise

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

def score_frame_quality(frame, motion=0.0):
    """Rate frame quality on multiple dimensions"""
    try:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        sharpness = laplacian.var()
        sharpness_score = min(sharpness / 100, 1.0)

        brightness = np.mean(gray)
        brightness_score = 1 - abs(brightness - 128) / 128

        contrast = np.std(gray)
        contrast_score = min(contrast / 50, 1.0)

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

        motion_score = 1 - min(motion / 50, 1.0)

        score = (
            sharpness_score * 0.25 +
            brightness_score * 0.2 +
            contrast_score * 0.2 +
            face_score * 0.25 +
            motion_score * 0.1
        )

        return float(score)
    except:
        return 0.0

def generate_smart_thumbnails(video_path, output_dir, num_candidates=20):
    """Generate smart thumbnails from video"""
    
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
    safe_print(f"[Thumbnail] Sampling {len(sample_positions)} candidate frames...")
    
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
            score = score_frame_quality(frame, motion)
            
            candidates.append({
                'frame': frame,
                'score': score,
                'position': pos,
                'timestamp': pos / fps if fps > 0 else 0,
                'motion': motion
            })
        
        except Exception as e:
            safe_print(f"[Thumbnail] Error sampling frame {idx}: {e}")
            continue
    
    cap.release()
    
    if not candidates:
        safe_print("[Thumbnail] ERROR: No frames could be sampled")
        return 0
    
    safe_print(f"[Thumbnail] Evaluated {len(candidates)} frames")
    
    candidates.sort(key=lambda x: x['score'], reverse=True)
    top_candidates = candidates[:20]
    random.shuffle(top_candidates)
    best_frames = top_candidates[:10]
    
    best_frames.sort(key=lambda x: x['position'])
    
    safe_print(f"[Thumbnail] Saving top 10 thumbnails...")
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
                safe_print(f"  [{i+1}] thumb_{i+1:02d}.jpg (score: {item['score']:.3f}, time: {item['timestamp']:.1f}s)")
                saved_count += 1
            else:
                safe_print(f"  [!] Failed to save thumb_{i+1:02d}.jpg")
        
        except Exception as e:
            safe_print(f"  [!] Error saving thumbnail {i+1}: {e}")
    
    safe_print(f"✓ Generated {saved_count} thumbnails")
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
        sys.exit(0 if count > 0 else 1)
    except Exception as e:
        safe_print(f"[Thumbnail] FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
# -*- coding: utf-8 -*-
import sys
import os
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

def score_frame_quality(frame):
    """
    Rate frame quality on multiple dimensions (0-1 scale)
    
    Factors:
    - Sharpness (Laplacian variance)
    - Brightness (avoid too dark/bright)
    - Contrast (standard deviation)
    - Face presence (bonus)
    """
    try:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # 1. Sharpness (Laplacian variance - higher is sharper)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        sharpness = laplacian.var()
        sharpness_score = min(sharpness / 100, 1.0)  # Normalize
        
        # 2. Brightness (avoid too dark/bright)
        brightness = np.mean(gray)
        brightness_score = 1 - abs(brightness - 128) / 128  # Peak at 128
        
        # 3. Contrast (standard deviation)
        contrast = np.std(gray)
        contrast_score = min(contrast / 50, 1.0)  # Normalize
        
        # 4. Face presence (bonus for frames with faces)
        face_score = 0.3  # Default
        try:
            face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )
            faces = face_cascade.detectMultiScale(gray, 1.1, 4, minSize=(30, 30))
            if len(faces) > 0:
                face_score = 1.0
        except:
            pass
        
        # Combined weighted score
        score = (
            sharpness_score * 0.3 +      # Sharpness: 30%
            brightness_score * 0.2 +     # Brightness: 20%
            contrast_score * 0.2 +       # Contrast: 20%
            face_score * 0.3             # Face detection: 30%
        )
        
        return float(score)
    except:
        return 0.0

def generate_smart_thumbnails(video_path, output_dir, num_candidates=20):
    """
    Generate many thumbnail candidates and select the best 10 by quality
    """
    safe_print(f"[Thumbnail] Opening video: {video_path}")
    
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        safe_print("[Thumbnail] ERROR: Cannot open video file")
        return 0
    
    # Get video info
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frame_count / fps if fps > 0 else 0
    
    if frame_count <= 0:
        safe_print(f"[Thumbnail] ERROR: Invalid frame count: {frame_count}")
        cap.release()
        return 0
    
    safe_print(f"[Thumbnail] Video info: {duration:.1f}s, {frame_count} frames, {fps:.1f} fps")
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Sample positions evenly throughout video
    sample_positions = np.linspace(0, frame_count - 1, num_candidates, dtype=int)
    safe_print(f"[Thumbnail] Sampling {num_candidates} candidate frames...")
    
    candidates = []
    
    for idx, pos in enumerate(sample_positions):
        try:
            cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
            ret, frame = cap.read()
            
            if not ret or frame is None:
                continue
            
            # Score this frame
            score = score_frame_quality(frame)
            
            candidates.append({
                'frame': frame,
                'score': score,
                'position': pos,
                'timestamp': pos / fps
            })
        
        except Exception as e:
            safe_print(f"[Thumbnail] Error sampling frame {idx}: {e}")
            continue
    
    cap.release()
    
    if not candidates:
        safe_print("[Thumbnail] ERROR: No frames could be sampled")
        return 0
    
    safe_print(f"[Thumbnail] Evaluated {len(candidates)} frames")
    
    # Sort by quality score and take TOP 10
    candidates.sort(key=lambda x: x['score'], reverse=True)
    best_frames = candidates[:10]
    
    # Re-sort by chronological order (not by score)
    best_frames.sort(key=lambda x: x['position'])
    
    # Save thumbnails
    safe_print(f"[Thumbnail] Saving top 10 thumbnails...")
    saved_count = 0
    
    for i, item in enumerate(best_frames):
        try:
            output_path = os.path.join(output_dir, f'thumb_{i+1:02d}.jpg')
            
            # Save with high quality
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
    # Validate arguments
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
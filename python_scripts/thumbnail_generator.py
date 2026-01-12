# -*- coding: utf-8 -*-
import sys
import os
import time
import numpy as np
import cv2
import subprocess
import tempfile
import shutil
import glob

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

def calculate_sharpness(gray):
    """Fast sharpness check using Laplacian on float32 to reduce memory use.
    Falls back to Sobel-based metric if Laplacian fails."""
    try:
        laplacian = cv2.Laplacian(gray, cv2.CV_32F)
        return float(np.var(laplacian))
    except Exception:
        try:
            sobelx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
            sobely = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
            mag = np.sqrt(sobelx * sobelx + sobely * sobely)
            return float(np.var(mag))
        except Exception:
            return float(np.var(gray))

video_path = sys.argv[1]
output_dir = sys.argv[2]
num_thumbnails = int(sys.argv[3]) if len(sys.argv) > 3 else 10

os.makedirs(output_dir, exist_ok=True)

safe_print(f"[Thumbnail] Opening: {video_path}")

cap = cv2.VideoCapture(video_path)

if not cap.isOpened():
    safe_print("ERROR: Cannot open video")
    sys.exit(1)

fps = cap.get(cv2.CAP_PROP_FPS)
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

safe_print(f"[Thumbnail] {width}x{height}, {fps}fps, {total_frames} frames (~{round(total_frames/fps)}s)")

# AGGRESSIVE OPTIMIZATION: Sample fewer frames by seeking and compute metrics on downscaled frames
frames_to_sample = min(50, max(15, int(total_frames / 100)))
sample_interval = max(1, total_frames // frames_to_sample)

safe_print(f"[Thumbnail] Sampling ~{frames_to_sample} frames (interval: {sample_interval})")

candidates = []
start_time = time.time()

# Parameters for memory/perf trade-offs
MAX_SCORE_WIDTH = 640     # downscale width for scoring computations
PREVIEW_WIDTH = 320       # small preview stored in memory

# Try fast FFmpeg extraction first (downscaled frames), fallback to seek-based sampling if unavailable
duration = total_frames / fps if fps > 0 else 0
frames_to_sample = min(frames_to_sample, total_frames) if total_frames > 0 else frames_to_sample

ffmpeg_used = False
if duration > 0 and frames_to_sample > 0:
    ffmpeg_path = shutil.which('ffmpeg')
    if ffmpeg_path:
        tmpdir = tempfile.mkdtemp(prefix='thumb_')
        try:
            fps_out = max(0.01, float(frames_to_sample) / float(max(1.0, duration)))
            safe_print(f"[Thumbnail] Using ffmpeg to extract ~{frames_to_sample} frames at fps={fps_out:.4f} into {tmpdir}")

            ff_cmd = [
                ffmpeg_path, '-y', '-i', video_path,
                '-vf', f"fps={fps_out},scale={MAX_SCORE_WIDTH}:-1",
                '-frames:v', str(frames_to_sample),
                os.path.join(tmpdir, 'frame_%06d.jpg')
            ]

            res = subprocess.run(ff_cmd, capture_output=True, text=True, timeout=120)
            if res.returncode == 0:
                imgs = sorted(glob.glob(os.path.join(tmpdir, 'frame_*.jpg')))
                for i, img in enumerate(imgs):
                    small = cv2.imread(img)
                    if small is None:
                        continue
                    gray_small = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
                    try:
                        sharpness = calculate_sharpness(gray_small)
                    except Exception as e:
                        safe_print(f"[Thumbnail] Sharpness calc failed for {img}: {e}")
                        sharpness = float(np.var(gray_small))
                    brightness = float(gray_small.mean())
                    score = sharpness
                    if 50 < brightness < 220:
                        score *= 1.1
                    timestamp = (i / max(1, len(imgs))) * duration
                    preview = cv2.resize(small, (max(1, int(small.shape[1] * (PREVIEW_WIDTH / float(max(1, small.shape[1]))))),
                                                 max(1, int(small.shape[0] * (PREVIEW_WIDTH / float(max(1, small.shape[1])))))),
                                         interpolation=cv2.INTER_AREA)
                    candidates.append({
                        'frame_idx': int(i * (total_frames / max(1, len(imgs)))),
                        'preview': preview,
                        'score': score,
                        'timestamp': timestamp,
                        'sharpness': sharpness,
                        'brightness': brightness
                    })
                ffmpeg_used = True
                safe_print(f"[Thumbnail] Collected {len(candidates)} candidates via ffmpeg in {round(time.time()-start_time,1)}s")
            else:
                safe_print(f"[Thumbnail] FFmpeg extraction failed: {res.stderr}")
        except Exception as e:
            safe_print(f"[Thumbnail] FFmpeg extraction error: {e}")
        finally:
            try:
                shutil.rmtree(tmpdir, ignore_errors=True)
            except:
                pass

# Fallback: seek-based sampling if ffmpeg not used or yielded no candidates
if not ffmpeg_used:
    safe_print(f"[Thumbnail] FFmpeg not used or failed, falling back to seek-based sampling")
    sample_positions = [min(total_frames - 1, i * sample_interval) for i in range(frames_to_sample)]

    for i, pos in enumerate(sample_positions):
        try:
            cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
            ret, frame = cap.read()
            if not ret:
                continue

            h, w = frame.shape[:2]
            scale = min(1.0, MAX_SCORE_WIDTH / float(w))
            if scale < 1.0:
                small = cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
            else:
                small = frame

            gray_small = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

            try:
                sharpness = calculate_sharpness(gray_small)
            except Exception as e:
                safe_print(f"[Thumbnail] Sharpness calc failed at pos {pos}: {e}")
                sharpness = float(np.var(gray_small))

            brightness = float(gray_small.mean())

            score = sharpness
            if 50 < brightness < 220:
                score *= 1.1

            timestamp = pos / fps

            preview = cv2.resize(small, (max(1, int(small.shape[1] * (PREVIEW_WIDTH / float(max(1, small.shape[1]))))),
                                         max(1, int(small.shape[0] * (PREVIEW_WIDTH / float(max(1, small.shape[1])))))),
                                 interpolation=cv2.INTER_AREA)

            candidates.append({
                'frame_idx': pos,
                'preview': preview,
                'score': score,
                'timestamp': timestamp,
                'sharpness': sharpness,
                'brightness': brightness
            })

            if (i + 1) % 10 == 0:
                elapsed = time.time() - start_time
                safe_print(f"[Thumbnail] Sampled {i+1} frames... ({round(elapsed,1)}s)")

        except MemoryError:
            safe_print("[Thumbnail] MemoryError during sampling — skipping this frame")
            continue

    cap.release()

safe_print(f"[Thumbnail] Collected {len(candidates)} candidates in {round(time.time()-start_time, 1)}s")

if len(candidates) == 0:
    safe_print("ERROR: No frames found")
    sys.exit(1)

# SORT by quality
candidates.sort(key=lambda x: x['score'], reverse=True)

# SELECT: Take top N with time diversity
selected = []
min_gap = max(1, (candidates[-1]['timestamp'] - candidates[0]['timestamp']) / (num_thumbnails + 1))

for c in candidates:
    if len(selected) >= num_thumbnails:
        break
    too_close = any(abs(c['timestamp'] - s['timestamp']) < min_gap for s in selected)
    if not too_close:
        selected.append(c)

# FALLBACK: If not enough, just take top N
if len(selected) < num_thumbnails:
    selected = candidates[:num_thumbnails]

selected.sort(key=lambda x: x['timestamp'])

# SAVE: Write files
safe_print(f"[Thumbnail] Saving {len(selected)} thumbnails...")

THUMB_MAX_WIDTH = 1280
cap_reopen = cv2.VideoCapture(video_path)

for i, c in enumerate(selected):
    file_path = os.path.join(output_dir, f"thumb_{i}.jpg")
    try:
        cap_reopen.set(cv2.CAP_PROP_POS_FRAMES, c['frame_idx'])
        ret, frame_full = cap_reopen.read()
        if not ret or frame_full is None:
            # fallback to preview (small)
            frame_to_save = c.get('preview')
        else:
            h, w = frame_full.shape[:2]
            if w > THUMB_MAX_WIDTH:
                new_h = int(h * (THUMB_MAX_WIDTH / float(w)))
                frame_to_save = cv2.resize(frame_full, (THUMB_MAX_WIDTH, new_h), interpolation=cv2.INTER_AREA)
            else:
                frame_to_save = frame_full

        if frame_to_save is not None:
            cv2.imwrite(file_path, frame_to_save, [cv2.IMWRITE_JPEG_QUALITY, 90])
    except Exception as e:
        safe_print(f"[Thumbnail] Failed to save {file_path}: {e}")
        try:
            if c.get('preview') is not None:
                cv2.imwrite(file_path, c['preview'], [cv2.IMWRITE_JPEG_QUALITY, 90])
        except Exception:
            pass

cap_reopen.release()

elapsed = time.time() - start_time
safe_print(f"✓ [Thumbnail] Generated {len(selected)} thumbnails in {round(elapsed, 1)}s")

sys.exit(0)
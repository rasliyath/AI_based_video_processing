# -*- coding: utf-8 -*-
import sys
import os
import subprocess

sys.stdout.reconfigure(encoding='utf-8')
os.environ['PYTHONIOENCODING'] = 'utf-8'

def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        pass

video_path = sys.argv[1]
output_path = sys.argv[2]
trailer_duration = int(sys.argv[3]) if len(sys.argv) > 3 else 15

# Ensure output directory exists
output_dir = os.path.dirname(output_path)
if output_dir:
    os.makedirs(output_dir, exist_ok=True)

safe_print("Generating trailer for: " + video_path)

import cv2

cap = cv2.VideoCapture(video_path)

if not cap.isOpened():
    safe_print("ERROR: Cannot open video file")
    sys.exit(1)

fps = cap.get(cv2.CAP_PROP_FPS)
width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
duration = total_frames / fps if fps > 0 else 0

safe_print(f"Video: {width}x{height}, {fps} fps, {duration}s duration, {total_frames} frames")

# Validate FPS
if not fps or fps <= 0 or fps != fps:  # check for NaN
    safe_print("WARNING: Invalid FPS, defaulting to 30")
    fps = 30.0

# Calculate frames to extract
frames_to_extract = int(fps * trailer_duration)

# Cap at total frames available
if total_frames and frames_to_extract > total_frames:
    frames_to_extract = total_frames
    safe_print(f"Video shorter than {trailer_duration}s, using full video")

if frames_to_extract <= 0:
    frames_to_extract = min(total_frames if total_frames > 0 else 100, max(1, int(trailer_duration * 30)))

safe_print(f"Extracting {frames_to_extract} frames at {fps} fps")

frames = []
frame_idx = 0

while frame_idx < total_frames and len(frames) < frames_to_extract:
    ret, frame = cap.read()
    if not ret:
        break
    frames.append(frame)
    frame_idx += 1

cap.release()

if len(frames) == 0:
    safe_print("ERROR: No frames extracted")
    sys.exit(1)

safe_print(f"Extracted {len(frames)} frames, writing video file...")

# Prefer an FFmpeg-based trim/encode (H.264) for compatibility
safe_print("Attempting FFmpeg direct trim/encode (H.264 mp4)...")
try:
    ffmpeg_cmd = [
        'ffmpeg', '-y',
        '-i', video_path,
        '-t', str(trailer_duration),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-pix_fmt', 'yuv420p',
        '-an',
        output_path
    ]
    safe_print(f"Running FFmpeg: {' '.join(ffmpeg_cmd)}")
    res = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=300)
    if res.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
        # Validate the file can be opened
        chk = cv2.VideoCapture(output_path)
        if chk.isOpened() and chk.get(cv2.CAP_PROP_FRAME_COUNT) > 0:
            safe_print(f"✓ Trailer saved via FFmpeg: {output_path}")
            safe_print(f"File size: {round(os.path.getsize(output_path) / 1024 / 1024, 2)} MB")
            chk.release()
            sys.exit(0)
        else:
            safe_print("Warning: FFmpeg created file but validation failed, will try image-based FFmpeg fallback")
            try:
                chk.release()
            except:
                pass
    else:
        safe_print(f"FFmpeg direct trim failed: {res.stderr}")
except Exception as e:
    safe_print(f"FFmpeg direct trim error: {e}")

# Method 1: Try cv2.VideoWriter (legacy fallback)
fourcc_candidates = ['avc1', 'mp4v', 'H264', 'MJPG']
writer = None
for code in fourcc_candidates:
    try:
        fourcc = cv2.VideoWriter_fourcc(*code)
        writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        if writer.isOpened():
            safe_print(f"Using codec: {code}")
            for frame in frames:
                writer.write(frame)
            writer.release()

            # Verify file was created and has size
            if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
                # Validate with OpenCV
                chk = cv2.VideoCapture(output_path)
                if chk.isOpened() and chk.get(cv2.CAP_PROP_FRAME_COUNT) > 0:
                    safe_print(f"✓ Trailer saved: {output_path}")
                    safe_print(f"File size: {round(os.path.getsize(output_path) / 1024 / 1024, 2)} MB")
                    chk.release()
                    sys.exit(0)
                else:
                    safe_print(f"Warning: {code} created file but validation failed, trying next codec...")
                    try:
                        chk.release()
                    except:
                        pass
                    writer = None
            else:
                safe_print(f"Warning: {code} created empty file, trying next codec...")
                writer = None
        else:
            writer = None
    except Exception as e:
        safe_print(f"Codec {code} failed: {str(e)}")
        writer = None

# Method 2: Use FFmpeg image-based fallback
safe_print("OpenCV codecs failed or validation failed, using FFmpeg image-based fallback...")
try:
    import tempfile
    import shutil

    # Create temporary directory for frames
    tmpdir = tempfile.mkdtemp(prefix='trailer_')
    safe_print(f"Writing {len(frames)} frames to: {tmpdir}")

    # Write frames as PNGs
    for i, frame in enumerate(frames):
        img_path = os.path.join(tmpdir, f"frame_{i:06d}.png")
        cv2.imwrite(img_path, frame)

    # Build FFmpeg command
    input_pattern = os.path.join(tmpdir, 'frame_%06d.png')
    ffmpeg_cmd = [
        'ffmpeg', '-y',
        '-framerate', str(int(fps)),
        '-i', input_pattern,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'fast',
        output_path
    ]

    safe_print(f"Running FFmpeg: {' '.join(ffmpeg_cmd)}")
    result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=300)

    # Cleanup temp directory
    shutil.rmtree(tmpdir, ignore_errors=True)

    if result.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
        # Validate file
        chk = cv2.VideoCapture(output_path)
        if chk.isOpened() and chk.get(cv2.CAP_PROP_FRAME_COUNT) > 0:
            safe_print(f"✓ Trailer saved via FFmpeg: {output_path}")
            safe_print(f"File size: {round(os.path.getsize(output_path) / 1024 / 1024, 2)} MB")
            chk.release()
            sys.exit(0)
        else:
            safe_print(f"FFmpeg image fallback created file but validation failed: {result.stderr}")
            try:
                chk.release()
            except:
                pass
            sys.exit(1)
    else:
        safe_print(f"FFmpeg error: {result.stderr}")
        sys.exit(1)

except Exception as e:
    safe_print(f"FFmpeg fallback failed: {str(e)}")
    safe_print("ERROR: Could not generate trailer")
    sys.exit(1)
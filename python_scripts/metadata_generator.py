# -*- coding: utf-8 -*-
import sys
import os
import json
import random

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

video_path = sys.argv[1]
import cv2

cap = cv2.VideoCapture(video_path)

if not cap.isOpened():
    safe_print("ERROR: Cannot open video file")
    sys.exit(1)

fps = cap.get(cv2.CAP_PROP_FPS)
frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
duration = frame_count / fps if fps > 0 else 0

safe_print(f"Analyzing video: {video_path}")
safe_print(f"Duration: {round(duration, 2)}s, Frames: {frame_count}")

# OPTIMIZATION: Seek-based sampling with downscaled processing for speed and low memory
face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)

# Settings: cap sample count to keep analysis fast
sample_count = min(12, 15)
sample_count = min(sample_count, max(1, frame_count))

safe_print(f"Sampling {sample_count} frames by seeking (frame_count={frame_count})")

# Choose centered sample positions across the video
sample_positions = [int((i + 0.5) * frame_count / sample_count) for i in range(sample_count)]

sample_frames = []
total_faces = 0
brightness_sum = 0.0
motion_scores = []
prev_gray = None

MAX_PROC_WIDTH = 640

for i, pos in enumerate(sample_positions):
    try:
        cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
        ret, frame = cap.read()
        if not ret or frame is None:
            safe_print(f"[Metadata] Warning: cannot read frame at {pos}")
            continue

        h, w = frame.shape[:2]
        if w > MAX_PROC_WIDTH:
            scale = MAX_PROC_WIDTH / float(w)
            small = cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        else:
            small = frame

        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        brightness_sum += float(gray.mean())

        try:
            faces = face_cascade.detectMultiScale(gray, 1.1, 3, minSize=(30, 30))
            total_faces += len(faces)
        except Exception as e:
            safe_print(f"[Metadata] face detect error at {pos}: {e}")

        if prev_gray is not None:
            diff = cv2.absdiff(prev_gray, gray)
            motion_scores.append(float(diff.mean()))

        prev_gray = gray
        sample_frames.append(small)

        if (i + 1) % 5 == 0:
            safe_print(f"[Metadata] Sampled {i+1}/{sample_count} frames...")

    except MemoryError:
        safe_print("[Metadata] MemoryError during sampling — skipping")
        continue

cap.release()

safe_print(f"[Metadata] Collected {len(sample_frames)} samples")# Calculate metrics
avg_brightness = brightness_sum / len(sample_frames) if sample_frames else 128
avg_motion = sum(motion_scores) / len(motion_scores) if motion_scores else 0
has_faces = total_faces > 0

# Genre selection logic
genres = ["Entertainment", "Education", "Sports", "Music", "Gaming", "Tech", "Lifestyle", "News"]
moods = ["Exciting", "Calm", "Inspiring", "Informative", "Fun", "Serious"]

if has_faces:
    selected_genres = random.sample(["Entertainment", "Sports", "Music", "Gaming"], 2) if avg_motion > 5 else random.sample(["Education", "Lifestyle", "News", "Tech"], 2)
else:
    selected_genres = random.sample(["Sports", "Gaming", "Music"], 2) if avg_motion > 10 else random.sample(["Nature", "Tech", "Education"], 2)

# Metadata generation
title_prefixes = ["Amazing", "Epic", "Incredible", "Must Watch", "Viral", "Exclusive", "Breaking", "Top 10"]
title = f"{random.choice(title_prefixes)} {random.choice(selected_genres)} Video"

description_templates = [
    f"Discover everything about {random.choice(selected_genres).lower()} in this amazing video.",
    f"This {random.choice(moods).lower()} video brings you the most exciting content.",
    f"Join us for an amazing journey into {random.choice(selected_genres).lower()}."
]

tags = [random.choice(genres).lower(), "video", "trending", random.choice(selected_genres).lower()]
if has_faces:
    tags.append("featured")
if avg_motion > 5:
    tags.extend(["action", "exciting"])
if avg_brightness > 150:
    tags.append("bright")
elif avg_brightness < 80:
    tags.append("cinematic")

metadata = {
    "title": title,
    "description": random.choice(description_templates),
    "tags": tags,
    "genre": selected_genres[0],
    "duration": round(duration, 2),
    "analysis": {
        "avg_brightness": round(avg_brightness, 2),
        "avg_motion": round(avg_motion, 2),
        "face_detected": has_faces,
        "total_faces_found": total_faces
    }
}

print(json.dumps(metadata, ensure_ascii=False))
safe_print("Metadata generation complete")
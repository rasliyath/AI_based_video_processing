# -*- coding: utf-8 -*-
import sys
import os
import json
import random

sys.stdout.reconfigure(encoding='utf-8')
os.environ['PYTHONIOENCODING'] = 'utf-8'

# Load environment variables from backend/.env
try:
    from dotenv import load_dotenv
    backend_env = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
    load_dotenv(backend_env)
except ImportError:
    pass  # dotenv not available, continue

def safe_print(text):
    """Print to stderr to avoid interfering with JSON output"""
    try:
        sys.stderr.write(str(text) + "\n")
        sys.stderr.flush()
    except:
        pass

def read_transcript(transcript_path):
    """Read and extract text from SRT transcript file"""
    try:
        with open(transcript_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract text lines (skip numbers and timestamps)
        lines = content.split('\n')
        text_lines = []

        for line in lines:
            line = line.strip()
            # Skip empty lines, numbers, and timestamp lines
            if line and not line.isdigit() and '-->' not in line:
                text_lines.append(line)

        transcript_text = ' '.join(text_lines)
        return transcript_text[:4000]  # Limit to 4000 chars for API
    except Exception as e:
        safe_print(f"[Metadata] Error reading transcript: {e}")
        return None

def generate_metadata_with_llm(transcript_text, video_analysis):
    """Use free intelligent text analysis to generate metadata from transcript"""
    try:
        import nltk
        from nltk.tokenize import word_tokenize, sent_tokenize
        from nltk.corpus import stopwords
        from nltk.probability import FreqDist
        from collections import Counter
        import re

        safe_print("[Metadata] Analyzing transcript with free AI tools...")

        # Download required NLTK data (only first time)
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            safe_print("[Metadata] Downloading NLTK punkt tokenizer...")
            nltk.download('punkt', quiet=True)

        try:
            nltk.data.find('corpora/stopwords')
        except LookupError:
            safe_print("[Metadata] Downloading NLTK stopwords...")
            nltk.download('stopwords', quiet=True)

        # For newer NLTK versions, also try punkt_tab
        try:
            nltk.data.find('tokenizers/punkt_tab')
        except LookupError:
            try:
                safe_print("[Metadata] Downloading NLTK punkt_tab tokenizer...")
                nltk.download('punkt_tab', quiet=True)
            except:
                pass  # Ignore if not available

        # Clean and tokenize transcript
        transcript_lower = transcript_text.lower()

        # Split into sentences for analysis
        sentences = sent_tokenize(transcript_text)
        if not sentences:
            return None

        # Get first and last sentences (often contain key info)
        first_sentence = sentences[0] if sentences else ""
        last_sentence = sentences[-1] if len(sentences) > 1 else first_sentence

        # Tokenize and remove stopwords
        stop_words = set(stopwords.words('english'))
        words = word_tokenize(transcript_lower)
        filtered_words = [word for word in words if word.isalnum() and word not in stop_words and len(word) > 2]

        # Find most common words (potential tags)
        word_freq = Counter(filtered_words)
        common_words = [word for word, freq in word_freq.most_common(15) if freq > 1]

        # Extract potential topics/keywords
        topics = []
        topic_keywords = {
            'education': ['teach', 'learn', 'student', 'school', 'class', 'teacher', 'lesson'],
            'technology': ['tech', 'software', 'computer', 'digital', 'online', 'app', 'device'],
            'business': ['business', 'company', 'market', 'money', 'profit', 'customer', 'sales'],
            'health': ['health', 'medical', 'doctor', 'patient', 'treatment', 'disease'],
            'sports': ['game', 'team', 'player', 'score', 'win', 'match', 'sport'],
            'entertainment': ['movie', 'music', 'show', 'film', 'actor', 'celebrity'],
            'science': ['research', 'study', 'data', 'experiment', 'theory', 'discovery'],
            'politics': ['government', 'policy', 'election', 'political', 'law', 'vote']
        }

        for topic, keywords in topic_keywords.items():
            if any(keyword in transcript_lower for keyword in keywords):
                topics.append(topic)

        # Generate title from first sentence or key phrases
        title_candidates = []

        # Extract noun phrases or key sentences
        for sentence in sentences[:3]:  # Check first 3 sentences
            # Look for sentences with question words or key indicators
            if any(word in sentence.lower() for word in ['what', 'how', 'why', 'when', 'where', 'who']):
                title_candidates.append(sentence[:80])  # Limit length

        # Fallback: use first sentence or extract key phrase
        if not title_candidates:
            title_candidates.append(first_sentence[:80])

        title = title_candidates[0].strip()
        if not title.endswith('?') and not title.endswith('!'):
            title = title.rstrip('.')

        # Generate description
        description_parts = []

        # Add summary of main topic
        if topics:
            main_topic = topics[0]
            description_parts.append(f"This video explores {main_topic} topics")

        # Add key insights from transcript
        if len(sentences) > 2:
            middle_sentences = sentences[1:-1][:2]  # Get 2 middle sentences
            key_insights = ' '.join(middle_sentences)[:200]
            if key_insights:
                description_parts.append(f"covering {key_insights}")

        # Add duration info
        duration = video_analysis.get('duration', 0)
        if duration > 0:
            description_parts.append(f"in {int(duration)} minutes")

        description = '. '.join(description_parts)
        if not description:
            description = f"A {int(duration)}-minute video discussing important topics."

        # Generate tags
        tags = []

        # Add topic-based tags
        tags.extend(topics[:3])  # Up to 3 topic tags

        # Add common words as tags (filter out uninteresting ones)
        interesting_words = [word for word in common_words[:7] if word not in ['video', 'content', 'time', 'way', 'day', 'thing', 'part']]
        tags.extend(interesting_words)

        # Add video analysis based tags
        if video_analysis.get('face_detected'):
            tags.append('interview')
        if video_analysis.get('avg_motion', 0) > 10:
            tags.append('dynamic')
        if video_analysis.get('avg_brightness', 128) > 180:
            tags.append('bright')

        # Ensure we have at least some tags
        if not tags:
            tags = ['educational', 'video', 'content']

        # Remove duplicates and limit
        tags = list(set(tags))[:8]

        # Determine genre
        if topics:
            genre = topics[0].title()
        else:
            # Fallback based on common words
            if any(word in transcript_lower for word in ['teach', 'learn', 'student']):
                genre = 'Education'
            elif any(word in transcript_lower for word in ['business', 'company', 'market']):
                genre = 'Business'
            elif any(word in transcript_lower for word in ['tech', 'software', 'computer']):
                genre = 'Technology'
            else:
                genre = 'Educational'

        # Create metadata
        metadata = {
            "title": title,
            "description": description,
            "tags": tags,
            "genre": genre,
            "category": genre,  # Same as genre for simplicity
            "duration": round(duration, 2),
            "analysis": video_analysis
        }

        safe_print("[Metadata] Free AI metadata generated successfully")
        return metadata

    except ImportError as e:
        safe_print(f"[Metadata] NLTK not available: {e}")
        return None
    except Exception as e:
        safe_print(f"[Metadata] Free AI analysis error: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    # Parse arguments only when run as main script
    if len(sys.argv) < 2:
        safe_print("Usage: python metadata_generator.py <video_path> [transcript_path]")
        sys.exit(1)

    video_path = sys.argv[1]
    transcript_path = sys.argv[2] if len(sys.argv) > 2 else None

    import cv2

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        safe_print("ERROR: Cannot open video file")
        sys.exit(1)

    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frame_count / fps if fps > 0 else 0

    # OPTIMIZATION: Seek-based sampling with downscaled processing for speed and low memory
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    # Settings: cap sample count to keep analysis fast
    sample_count = min(12, 15)
    sample_count = min(sample_count, max(1, frame_count))

    # Removed print to avoid JSON parsing issues

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

            # Removed progress print to avoid JSON parsing issues

        except MemoryError:
            safe_print("[Metadata] MemoryError during sampling — skipping")
            continue

    cap.release()

    # Calculate metrics
    avg_brightness = brightness_sum / len(sample_frames) if sample_frames else 128
    avg_motion = sum(motion_scores) / len(motion_scores) if motion_scores else 0
    has_faces = total_faces > 0

    video_analysis = {
        "duration": round(duration, 2),
        "avg_brightness": round(avg_brightness, 2),
        "avg_motion": round(avg_motion, 2),
        "face_detected": has_faces,
        "total_faces_found": total_faces
    }

    # Try LLM metadata generation if transcript is available
    metadata = None
    if transcript_path:
        safe_print(f"[Metadata] Transcript available, attempting LLM generation...")
        transcript_text = read_transcript(transcript_path)
        if transcript_text:
            metadata = generate_metadata_with_llm(transcript_text, video_analysis)

    # Fall back to heuristic generation if LLM failed or no transcript
    if not metadata:
        safe_print("[Metadata] Using heuristic metadata generation")
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
            "analysis": video_analysis
        }

    print(json.dumps(metadata, ensure_ascii=False))

if __name__ == '__main__':
    main()
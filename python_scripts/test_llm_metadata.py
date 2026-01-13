# -*- coding: utf-8 -*-
import os
import json

# Load environment variables from backend/.env
try:
    from dotenv import load_dotenv
    backend_env = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
    load_dotenv(backend_env)
except ImportError:
    pass

# Test LLM metadata generation
def test_llm():
    # Mock transcript and analysis
    transcript = "This is a test video about artificial intelligence and machine learning. The speaker discusses how AI is transforming various industries including healthcare, education, and entertainment."

    video_analysis = {
        "duration": 120.5,
        "avg_brightness": 145.2,
        "avg_motion": 12.3,
        "face_detected": True,
        "total_faces_found": 3
    }

    # Import the function
    from metadata_generator import generate_metadata_with_llm

    result = generate_metadata_with_llm(transcript, video_analysis)

    if result:
        print("LLM Test Successful!")
        print(json.dumps(result, indent=2))
    else:
        print("LLM Test Failed - check API key and OpenAI setup")

if __name__ == '__main__':
    test_llm()
# -*- coding: utf-8 -*-
import sys
import os
import json
import yt_dlp

# Force UTF-8 encoding for output
sys.stdout.reconfigure(encoding='utf-8')
os.environ['PYTHONIOENCODING'] = 'utf-8'

def get_video_stream_url(url):
    """Extract direct stream URL without downloading the entire file"""
    
    ydl_opts = {
        'format': 'best[ext=mp4]/best',
        'quiet': True,
        'no_warnings': True,
        'socket_timeout': 30,
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        
        if not info:
            raise Exception("Could not extract video info")
        
        stream_url = info.get('url')
        
        if not stream_url:
            raise Exception("No stream URL found in video info")
        
        return stream_url

def check_audio_presence(video_url):
    """Check if video URL has audio stream using ffprobe"""
    try:
        import subprocess
        result = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_streams', video_url],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            streams = data.get('streams', [])
            has_audio = any(s.get('codec_type') == 'audio' for s in streams)
            return has_audio
        else:
            return False
    except:
        return False

def main():
    # Validate arguments
    if len(sys.argv) < 2:
        result = {
            'success': False,
            'error': 'Usage: python youtube_downloader.py <URL>'
        }
        print(json.dumps(result))
        sys.exit(1)
    
    url = sys.argv[1]
    
    try:
        # Get streaming URL instead of downloading
        stream_url = get_video_stream_url(url)
        
        # Check for audio
        has_audio = check_audio_presence(stream_url)
        
        # Return as JSON only - NO other output
        result = {
            'success': True,
            'url': stream_url,
            'type': 'streaming',
            'has_audio': has_audio
        }
        
        print(json.dumps(result))
        sys.exit(0)
    
    except Exception as e:
        result = {
            'success': False,
            'error': str(e),
            'type': 'streaming'
        }
        print(json.dumps(result))
        sys.exit(1)

if __name__ == '__main__':
    main()
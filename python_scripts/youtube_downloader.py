# -*- coding: utf-8 -*-
import sys
import os

# Force UTF-8 encoding for output
sys.stdout.reconfigure(encoding='utf-8')
os.environ['PYTHONIOENCODING'] = 'utf-8'

def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        pass

url = sys.argv[1]
output_dir = sys.argv[2]

os.makedirs(output_dir, exist_ok=True)

import yt_dlp

# Define logger class BEFORE using it
class MyLogger:
    def debug(self, msg):
        pass
    def warning(self, msg):
        pass
    def error(self, msg):
        safe_print("ERROR: " + msg)

# Suppress most output, only show errors
ydl_opts = {
    "format": "bv*+ba/b",
    "merge_output_format": "mp4",
    "outtmpl": f"{output_dir}/%(title)s.%(ext)s",
    "quiet": False,
    "no_warnings": False,
    "logger": MyLogger(),
}

try:
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    safe_print("Download completed successfully!")
except Exception as e:
    safe_print("Download failed: " + str(e))
    sys.exit(1)

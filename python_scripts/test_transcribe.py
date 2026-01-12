import whisper
print('loading model tiny...')
model = whisper.load_model('tiny')
print('model loaded')
res = model.transcribe(r'E:\RGB\AI_based_video_processing\python_scripts\sample.wav', fp16=False)
print('segments:', len(res.get('segments', [])))
segments = res.get('segments', [])
if segments:
    print(segments[:2])
print('text:', res.get('text', '')[:400])

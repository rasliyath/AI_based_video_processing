import React, { useState, useEffect, useRef } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || '' // proxy handles /api

function App() {
  const [running, setRunning] = useState(false)
  const [thumbnails, setThumbnails] = useState([])
  const [trailer, setTrailer] = useState(null)
  const [uploadFile, setUploadFile] = useState(null)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [log, setLog] = useState([])

  const pollRef = useRef(null)
  const retryLoggedRef = useRef(false)
  const failureCountRef = useRef(0)
  const [backendAvailable, setBackendAvailable] = useState(true)

  useEffect(() => {
    return () => stopPolling()
  }, [])

  const appendLog = (text) => setLog(l => [...l, text])

  // Adaptive polling using setTimeout so we can adjust interval on error
  const startPolling = () => {
    stopPolling()

    const loop = async () => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s fetch timeout

        const res = await fetch(`${API_BASE}/api/videos/status`, { signal: controller.signal })
        clearTimeout(timeoutId)

        if (!res.ok) throw new Error('Status fetch failed: ' + res.status)

        const data = await res.json()

        // Reset failure counter and mark backend available if previously down
        failureCountRef.current = 0
        if (!backendAvailable) {
          setBackendAvailable(true)
          appendLog('Backend reachable, resuming polling')
          retryLoggedRef.current = false
        }

        if (data.thumbnails) {
          setThumbnails(prev => {
            const newItems = data.thumbnails.filter(t => !prev.includes(t))
            if (newItems.length) appendLog(`Got ${newItems.length} new thumbnail(s)`)
            return [...prev, ...newItems].slice(0, 20)
          })
        }
        if (data.trailer) setTrailer(data.trailer)

        // schedule next poll faster when backend is healthy
        pollRef.current = setTimeout(loop, 1000)
      } catch (e) {
        // On failure, increment failure count and back off; show banner after 3 consecutive failures
        failureCountRef.current = (failureCountRef.current || 0) + 1
        if (failureCountRef.current >= 3) {
          if (!retryLoggedRef.current) {
            appendLog('Backend not reachable (proxy error). Will retry...')
            retryLoggedRef.current = true
          }
          setBackendAvailable(false)
        }
        // back off polling interval
        pollRef.current = setTimeout(loop, 3000)
      }
    }

    loop()
  }

  const stopPolling = () => {
    if (pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setThumbnails([])
    setTrailer(null)
    appendLog('Starting processing...')
    setRunning(true)
    startPolling()

    const form = new FormData()
    if (uploadFile) form.append('video', uploadFile)
    if (youtubeUrl) form.append('youtubeUrl', youtubeUrl)

    try {
      const res = await fetch(`${API_BASE}/api/videos/process`, { method: 'POST', body: form })
      const result = await res.json()
      appendLog('Processing finished')
      if (result.thumbnails) {
        setThumbnails(result.thumbnails.map(p => `/${p}`))
      }
      if (result.trailer) setTrailer(`/${result.trailer}`)
    } catch (err) {
      appendLog('Processing error: ' + (err.message || err))
    } finally {
      setRunning(false)
      stopPolling()
    }
  }

  return (
    <div className="container">
      <h1>AI Video Processor (Frontend)</h1>

      <form onSubmit={onSubmit} className="form">
        <label>Upload video file</label>
        <input type="file" accept="video/*" onChange={e => setUploadFile(e.target.files[0])} />

        <label>Or YouTube URL</label>
        <input type="text" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/.." />

        <button type="submit" disabled={running}>Start Processing</button>
      </form>

      <div className="status">
        {running ? <div className="loader">Processing... (polling for thumbnails)</div> : <div>Idle</div>}
        {/* { !backendAvailable && <div style={{color:'#a00', marginTop:8}}>Backend not reachable — check server (http://localhost:5000)</div> } */}
      </div>

      <div className="gallery">
        {thumbnails.map((t, i) => (
          <div key={t} className="thumb">
            <img src={(t.startsWith('http') ? t : (API_BASE + t))} alt={`thumb-${i}`} />
          </div>
        ))}
      </div>

      <div className="trailer">
        {trailer ? (
          <div>
            <h3>Trailer</h3>
            <video width="640" controls preload="metadata" src={(trailer.startsWith('http') ? trailer : (API_BASE + trailer))} type="video/mp4"></video>
          </div>
        ) : null}
      </div>

      {/* <div className="log">
        <h4>Activity Log</h4>
        <div className="logLines">
          {log.map((l, idx) => <div key={idx}>{l}</div>)}
        </div>
      </div> */}

    </div>
  )
}

export default App
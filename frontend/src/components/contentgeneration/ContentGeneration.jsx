import React, { useState, useEffect } from 'react'
import { Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Box, Grid, Card, CardContent, IconButton, Chip, ToggleButton, ToggleButtonGroup, Input, FormControl, FormLabel,Typography } from '@mui/material'
import { Close as CloseIcon, PlayArrow, Edit, Visibility, YouTube, UploadFile } from '@mui/icons-material'

const API_BASE = import.meta.env.VITE_API_BASE || ''

function ContentGeneration() {
  console.log('ContentGeneration component rendering')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [processingMode, setProcessingMode] = useState('url')
  const [loading, setLoading] = useState({})

  const isProcessingReady = (videoUrl || videoFile)
  
  // Table data
  const [videos, setVideos] = useState([])
  
  // Modals
  const [showThumbnailModal, setShowThumbnailModal] = useState(false)
  const [showTrailerModal, setShowTrailerModal] = useState(false)
  const [showSubtitleModal, setShowSubtitleModal] = useState(false)
  const [showMetadataModal, setShowMetadataModal] = useState(false)
  
  // Current data in modals
  const [currentModalData, setCurrentModalData] = useState(null)
  const [editingMetadata, setEditingMetadata] = useState(null)

  // Load videos on mount
  useEffect(() => {
    loadVideos()
  }, [])

  const loadVideos = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/videos/`)
      const data = await res.json()
      setVideos(data)
    } catch (err) {
      console.error('Error loading videos:', err)
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setVideoFile(file)
      setVideoPreview(URL.createObjectURL(file))
      setProcessingMode('upload')
    }
  }

  const processVideo = async () => {
    try {
      setLoading(prev => ({ ...prev, process: true }))

      let options = { method: 'POST' }

      if (processingMode === 'upload' && videoFile) {
        const formData = new FormData()
        formData.append('video', videoFile)
        options.body = formData
      } else if (processingMode === 'url' && videoUrl) {
        options.headers = { 'Content-Type': 'application/json' }
        options.body = JSON.stringify({ youtubeUrl: videoUrl })
      } else {
        alert('Provide video URL or upload file')
        setLoading(prev => ({ ...prev, process: false }))
        return
      }

      const res = await fetch(`${API_BASE}/api/videos/process`, options)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      alert('✓ Processing complete!')
      setVideoUrl('')
      setVideoFile(null)
      setVideoPreview(null)
      await loadVideos()
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setLoading(prev => ({ ...prev, process: false }))
    }
  }

  const generateThumbnails = async () => {
    try {
      setLoading(prev => ({ ...prev, thumbnails: true }))

      let options = { method: 'POST' }

      if (processingMode === 'upload' && videoFile) {
        const formData = new FormData()
        formData.append('video', videoFile)
        options.body = formData
      } else if (processingMode === 'url' && videoUrl) {
        options.headers = { 'Content-Type': 'application/json' }
        options.body = JSON.stringify({ url: videoUrl })
      } else {
        alert('Provide video URL or upload file')
        setLoading(prev => ({ ...prev, thumbnails: false }))
        return
      }

      const res = await fetch(`${API_BASE}/api/videos/thumbnails`, options)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      alert(`✓ Generated ${data.count} thumbnails!`)
      await loadVideos()
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setLoading(prev => ({ ...prev, thumbnails: false }))
    }
  }

  const generateTrailer = async () => {
    try {
      setLoading(prev => ({ ...prev, trailer: true }))

      let options = { method: 'POST' }

      if (processingMode === 'upload' && videoFile) {
        const formData = new FormData()
        formData.append('video', videoFile)
        options.body = formData
      } else if (processingMode === 'url' && videoUrl) {
        options.headers = { 'Content-Type': 'application/json' }
        options.body = JSON.stringify({ url: videoUrl })
      } else {
        alert('Provide video URL or upload file')
        setLoading(prev => ({ ...prev, trailer: false }))
        return
      }

      const res = await fetch(`${API_BASE}/api/videos/trailer`, options)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      alert('✓ Trailer generated!')
      await loadVideos()
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setLoading(prev => ({ ...prev, trailer: false }))
    }
  }

  const generateSubtitles = async () => {
    try {
      setLoading(prev => ({ ...prev, subtitles: true }))

      let options = { method: 'POST' }

      if (processingMode === 'upload' && videoFile) {
        const formData = new FormData()
        formData.append('video', videoFile)
        options.body = formData
      } else if (processingMode === 'url' && videoUrl) {
        options.headers = { 'Content-Type': 'application/json' }
        options.body = JSON.stringify({ url: videoUrl })
      } else {
        alert('Provide video URL or upload file')
        setLoading(prev => ({ ...prev, subtitles: false }))
        return
      }

      const res = await fetch(`${API_BASE}/api/videos/subtitles`, options)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      alert('✓ Subtitles generated!')
      await loadVideos()
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setLoading(prev => ({ ...prev, subtitles: false }))
    }
  }

  const generateMetadata = async () => {
    try {
      setLoading(prev => ({ ...prev, metadata: true }))

      let options = { method: 'POST' }

      if (processingMode === 'upload' && videoFile) {
        const formData = new FormData()
        formData.append('video', videoFile)
        options.body = formData
      } else if (processingMode === 'url' && videoUrl) {
        options.headers = { 'Content-Type': 'application/json' }
        options.body = JSON.stringify({ url: videoUrl })
      } else {
        alert('Provide video URL or upload file')
        setLoading(prev => ({ ...prev, metadata: false }))
        return
      }

      const res = await fetch(`${API_BASE}/api/videos/metadata`, options)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      alert('✓ Metadata generated!')
      await loadVideos()
    } catch (err) {
      alert(`Error: ${err.message}`)
    } finally {
      setLoading(prev => ({ ...prev, metadata: false }))
    }
  }

  const openThumbnailModal = (video) => {
    setCurrentModalData(video)
    setShowThumbnailModal(true)
  }

  const openTrailerModal = (video) => {
    setCurrentModalData(video)
    setShowTrailerModal(true)
  }

  const openSubtitleModal = (video) => {
    setCurrentModalData(video)
    setShowSubtitleModal(true)
  }

  const openMetadataModal = (video) => {
    setEditingMetadata({ ...video.metadata })
    setCurrentModalData(video)
    setShowMetadataModal(true)
  }

  const saveMetadata = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/videos/metadata/${currentModalData._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingMetadata)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      alert('✓ Metadata updated!')
      setShowMetadataModal(false)
      await loadVideos()
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  const closeModal = () => {
    setShowThumbnailModal(false)
    setShowTrailerModal(false)
    setShowSubtitleModal(false)
    setShowMetadataModal(false)
    setCurrentModalData(null)
  }

  return (
    <>
      {/* Input Section */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Input Options
          </Typography>
          <Box sx={{ mb: 2 }}>
            <ToggleButtonGroup
              value={processingMode}
              exclusive
              onChange={(event, newMode) => {
                if (newMode) {
                  setProcessingMode(newMode);
                  if (newMode === 'url') setVideoFile(null);
                  else setVideoUrl('');
                }
              }}
              aria-label="processing mode"
            >
              <ToggleButton value="url" aria-label="YouTube URL">
                <YouTube sx={{ mr: 1 }} />
                YouTube URL
              </ToggleButton>
              <ToggleButton value="upload" aria-label="Upload Video">
                <UploadFile sx={{ mr: 1 }} />
                Upload Video
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {processingMode === 'url' ? (
            <TextField
              label="YouTube URL"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Enter YouTube URL"
              fullWidth
              sx={{ mb: 2 }}
            />
          ) : (
            <Box sx={{ mb: 2 }}>
              <FormControl fullWidth>
                <FormLabel>Upload Video File</FormLabel>
                <Input
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  sx={{ mt: 1 }}
                />
              </FormControl>
              {videoPreview && (
                <Card sx={{ mt: 2, p: 2 }}>
                  <Typography variant="body2">📁 {videoFile?.name}</Typography>
                  <Typography variant="body2">Size: {(videoFile?.size / 1024 / 1024 / 1024).toFixed(2)} GB</Typography>
                  <Box sx={{ mt: 1 }}>
                    <video width="200" height="120" controls>
                      <source src={videoPreview} type="video/mp4" />
                    </video>
                  </Box>
                </Card>
              )}
            </Box>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
            <Button
              variant="contained"
              onClick={processVideo}
              disabled={!isProcessingReady || loading.process}
              fullWidth
            >
              {loading.process ? '⏳ Processing All...' : '🚀 Process All (Thumbnails, Trailer, Subtitles, Metadata)'}
            </Button>
            <Button
              variant="outlined"
              onClick={generateThumbnails}
              disabled={!isProcessingReady || loading.thumbnails}
            >
              {loading.thumbnails ? '⏳ Generating...' : '🖼️ Generate Thumbnails'}
            </Button>
            <Button
              variant="outlined"
              onClick={generateTrailer}
              disabled={!isProcessingReady || loading.trailer}
            >
              {loading.trailer ? '⏳ Generating...' : '🎥 Generate Trailer'}
            </Button>
            <Button
              variant="outlined"
              onClick={generateSubtitles}
              disabled={!isProcessingReady || loading.subtitles}
            >
              {loading.subtitles ? '⏳ Generating...' : '📝 Generate Subtitles'}
            </Button>
            <Button
              variant="outlined"
              onClick={generateMetadata}
              disabled={!isProcessingReady || loading.metadata}
            >
              {loading.metadata ? '⏳ Generating...' : '📋 Generate Metadata'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Videos Table */}
      {videos.length > 0 && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📊 Generated Videos
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Source</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Thumbnails</TableCell>
                    <TableCell>Trailer</TableCell>
                    <TableCell>Subtitles</TableCell>
                    <TableCell>Metadata</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {videos.map(video => (
                    <TableRow key={video._id}>
                      <TableCell>
                        <Chip
                          label={video.type === 'youtube' ? 'YouTube' : 'Upload'}
                          icon={video.type === 'youtube' ? <YouTube /> : <UploadFile />}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{video.title || '—'}</TableCell>
                      <TableCell>
                        {video.generated.thumbnails ? (
                          <>
                            <Chip label="✓" color="success" size="small" sx={{ mr: 1 }} />
                            <Button size="small" onClick={() => openThumbnailModal(video)}>
                              View ({video.thumbnails.length})
                            </Button>
                          </>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {video.generated.trailer ? (
                          <>
                            <Chip label="✓" color="success" size="small" sx={{ mr: 1 }} />
                            <IconButton size="small" onClick={() => openTrailerModal(video)}>
                              <PlayArrow />
                            </IconButton>
                          </>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {video.generated.subtitles ? (
                          <>
                            <Chip label="✓" color="success" size="small" sx={{ mr: 1 }} />
                            <Button size="small" onClick={() => openSubtitleModal(video)}>
                              View
                            </Button>
                          </>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {video.generated.metadata ? (
                          <>
                            <Chip label="✓" color="success" size="small" sx={{ mr: 1 }} />
                            <IconButton size="small" onClick={() => openMetadataModal(video)}>
                              <Edit />
                            </IconButton>
                          </>
                        ) : '—'}
                      </TableCell>
                      <TableCell>{new Date(video.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Thumbnails Modal */}
      <Dialog open={showThumbnailModal} onClose={closeModal} maxWidth="md" fullWidth>
        <DialogTitle>
          🖼️ Thumbnails
          <IconButton
            aria-label="close"
            onClick={closeModal}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            {currentModalData?.thumbnails.map((thumb, i) => (
              <Grid item xs={6} sm={4} md={3} key={i}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <img src={thumb.dataUrl} alt={`Thumb ${i+1}`} style={{ width: '100%', height: 'auto' }} />
                    <Typography variant="body2">#{i + 1}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
      </Dialog>

      {/* Trailer Modal */}
      <Dialog open={showTrailerModal} onClose={closeModal} maxWidth="md" fullWidth>
        <DialogTitle>
          🎬 Trailer
          <IconButton
            aria-label="close"
            onClick={closeModal}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <video controls style={{ maxWidth: '100%', height: 'auto' }}>
              <source src={`${API_BASE}/api/videos/trailer/${currentModalData?._id}`} type="video/mp4" />
            </video>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Subtitles Modal */}
      <Dialog open={showSubtitleModal} onClose={closeModal} maxWidth="md" fullWidth>
        <DialogTitle>
          📝 Subtitles
          <IconButton
            aria-label="close"
            onClick={closeModal}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
            {currentModalData?.subtitles?.content}
          </Typography>
        </DialogContent>
      </Dialog>

      {/* Metadata Modal */}
      <Dialog open={showMetadataModal} onClose={closeModal} maxWidth="sm" fullWidth>
        <DialogTitle>
          📋 Edit Metadata
          <IconButton
            aria-label="close"
            onClick={closeModal}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Title"
            value={editingMetadata?.title || ''}
            onChange={(e) => setEditingMetadata({ ...editingMetadata, title: e.target.value })}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Description"
            value={editingMetadata?.description || ''}
            onChange={(e) => setEditingMetadata({ ...editingMetadata, description: e.target.value })}
            fullWidth
            multiline
            rows={4}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Genre"
            value={editingMetadata?.genre || ''}
            onChange={(e) => setEditingMetadata({ ...editingMetadata, genre: e.target.value })}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Tags"
            value={editingMetadata?.tags?.join(', ') || ''}
            onChange={(e) => setEditingMetadata({ ...editingMetadata, tags: e.target.value.split(',').map(t => t.trim()) })}
            placeholder="comma separated"
            fullWidth
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={saveMetadata} variant="contained">
            💾 Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default ContentGeneration
// import React, { useState, useEffect } from 'react'

// const API_BASE = import.meta.env.VITE_API_BASE || ''

// function ContentGeneration() {
//   console.log('ContentGeneration component rendering')
//   const [videoUrl, setVideoUrl] = useState('')
//   const [videoFile, setVideoFile] = useState(null)
//   const [videoPreview, setVideoPreview] = useState(null)
//   const [processingMode, setProcessingMode] = useState('url')
//   const [loading, setLoading] = useState({})

//   const isProcessingReady = (videoUrl || videoFile)
  
//   // Table data
//   const [videos, setVideos] = useState([])
  
//   // Modals
//   const [showThumbnailModal, setShowThumbnailModal] = useState(false)
//   const [showTrailerModal, setShowTrailerModal] = useState(false)
//   const [showSubtitleModal, setShowSubtitleModal] = useState(false)
//   const [showMetadataModal, setShowMetadataModal] = useState(false)
  
//   // Current data in modals
//   const [currentModalData, setCurrentModalData] = useState(null)
//   const [editingMetadata, setEditingMetadata] = useState(null)

//   // Load videos on mount
//   useEffect(() => {
//     loadVideos()
//   }, [])

//   const loadVideos = async () => {
//     try {
//       const res = await fetch(`${API_BASE}/api/videos/`)
//       const data = await res.json()
//       setVideos(data)
//     } catch (err) {
//       console.error('Error loading videos:', err)
//     }
//   }

//   const handleFileSelect = (e) => {
//     const file = e.target.files[0]
//     if (file) {
//       setVideoFile(file)
//       setVideoPreview(URL.createObjectURL(file))
//       setProcessingMode('upload')
//     }
//   }

//   const processVideo = async () => {
//     try {
//       setLoading(prev => ({ ...prev, process: true }))

//       let options = { method: 'POST' }

//       if (processingMode === 'upload' && videoFile) {
//         const formData = new FormData()
//         formData.append('video', videoFile)
//         options.body = formData
//       } else if (processingMode === 'url' && videoUrl) {
//         options.headers = { 'Content-Type': 'application/json' }
//         options.body = JSON.stringify({ youtubeUrl: videoUrl })
//       } else {
//         alert('Provide video URL or upload file')
//         setLoading(prev => ({ ...prev, process: false }))
//         return
//       }

//       const res = await fetch(`${API_BASE}/api/videos/process`, options)
//       const data = await res.json()
//       if (!res.ok) throw new Error(data.error)

//       alert('✓ Processing complete!')
//       setVideoUrl('')
//       setVideoFile(null)
//       setVideoPreview(null)
//       await loadVideos()
//     } catch (err) {
//       alert(`Error: ${err.message}`)
//     } finally {
//       setLoading(prev => ({ ...prev, process: false }))
//     }
//   }

//   const generateThumbnails = async () => {
//     try {
//       setLoading(prev => ({ ...prev, thumbnails: true }))

//       let options = { method: 'POST' }

//       if (processingMode === 'upload' && videoFile) {
//         const formData = new FormData()
//         formData.append('video', videoFile)
//         options.body = formData
//       } else if (processingMode === 'url' && videoUrl) {
//         options.headers = { 'Content-Type': 'application/json' }
//         options.body = JSON.stringify({ url: videoUrl })
//       } else {
//         alert('Provide video URL or upload file')
//         setLoading(prev => ({ ...prev, thumbnails: false }))
//         return
//       }

//       const res = await fetch(`${API_BASE}/api/videos/thumbnails`, options)
//       const data = await res.json()
//       if (!res.ok) throw new Error(data.error)

//       alert(`✓ Generated ${data.count} thumbnails!`)
//       await loadVideos()
//     } catch (err) {
//       alert(`Error: ${err.message}`)
//     } finally {
//       setLoading(prev => ({ ...prev, thumbnails: false }))
//     }
//   }

//   const generateTrailer = async () => {
//     try {
//       setLoading(prev => ({ ...prev, trailer: true }))

//       let options = { method: 'POST' }

//       if (processingMode === 'upload' && videoFile) {
//         const formData = new FormData()
//         formData.append('video', videoFile)
//         options.body = formData
//       } else if (processingMode === 'url' && videoUrl) {
//         options.headers = { 'Content-Type': 'application/json' }
//         options.body = JSON.stringify({ url: videoUrl })
//       } else {
//         alert('Provide video URL or upload file')
//         setLoading(prev => ({ ...prev, trailer: false }))
//         return
//       }

//       const res = await fetch(`${API_BASE}/api/videos/trailer`, options)
//       const data = await res.json()
//       if (!res.ok) throw new Error(data.error)

//       alert('✓ Trailer generated!')
//       await loadVideos()
//     } catch (err) {
//       alert(`Error: ${err.message}`)
//     } finally {
//       setLoading(prev => ({ ...prev, trailer: false }))
//     }
//   }

//   const generateSubtitles = async () => {
//     try {
//       setLoading(prev => ({ ...prev, subtitles: true }))

//       let options = { method: 'POST' }

//       if (processingMode === 'upload' && videoFile) {
//         const formData = new FormData()
//         formData.append('video', videoFile)
//         options.body = formData
//       } else if (processingMode === 'url' && videoUrl) {
//         options.headers = { 'Content-Type': 'application/json' }
//         options.body = JSON.stringify({ url: videoUrl })
//       } else {
//         alert('Provide video URL or upload file')
//         setLoading(prev => ({ ...prev, subtitles: false }))
//         return
//       }

//       const res = await fetch(`${API_BASE}/api/videos/subtitles`, options)
//       const data = await res.json()
//       if (!res.ok) throw new Error(data.error)

//       alert('✓ Subtitles generated!')
//       await loadVideos()
//     } catch (err) {
//       alert(`Error: ${err.message}`)
//     } finally {
//       setLoading(prev => ({ ...prev, subtitles: false }))
//     }
//   }

//   const generateMetadata = async () => {
//     try {
//       setLoading(prev => ({ ...prev, metadata: true }))

//       let options = { method: 'POST' }

//       if (processingMode === 'upload' && videoFile) {
//         const formData = new FormData()
//         formData.append('video', videoFile)
//         options.body = formData
//       } else if (processingMode === 'url' && videoUrl) {
//         options.headers = { 'Content-Type': 'application/json' }
//         options.body = JSON.stringify({ url: videoUrl })
//       } else {
//         alert('Provide video URL or upload file')
//         setLoading(prev => ({ ...prev, metadata: false }))
//         return
//       }

//       const res = await fetch(`${API_BASE}/api/videos/metadata`, options)
//       const data = await res.json()
//       if (!res.ok) throw new Error(data.error)

//       alert('✓ Metadata generated!')
//       await loadVideos()
//     } catch (err) {
//       alert(`Error: ${err.message}`)
//     } finally {
//       setLoading(prev => ({ ...prev, metadata: false }))
//     }
//   }

//   const openThumbnailModal = (video) => {
//     setCurrentModalData(video)
//     setShowThumbnailModal(true)
//   }

//   const openTrailerModal = (video) => {
//     setCurrentModalData(video)
//     setShowTrailerModal(true)
//   }

//   const openSubtitleModal = (video) => {
//     setCurrentModalData(video)
//     setShowSubtitleModal(true)
//   }

//   const openMetadataModal = (video) => {
//     setEditingMetadata({ ...video.metadata })
//     setCurrentModalData(video)
//     setShowMetadataModal(true)
//   }

//   const saveMetadata = async () => {
//     try {
//       const res = await fetch(`${API_BASE}/api/videos/metadata/${currentModalData._id}`, {
//         method: 'PUT',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(editingMetadata)
//       })
//       const data = await res.json()
//       if (!res.ok) throw new Error(data.error)

//       alert('✓ Metadata updated!')
//       setShowMetadataModal(false)
//       await loadVideos()
//     } catch (err) {
//       alert(`Error: ${err.message}`)
//     }
//   }

//   const closeModal = () => {
//     setShowThumbnailModal(false)
//     setShowTrailerModal(false)
//     setShowSubtitleModal(false)
//     setShowMetadataModal(false)
//     setCurrentModalData(null)
//   }

//   return (
//     <div style={{
//       width: '100%',
//       minHeight: '100vh',
//       background: 'linear-gradient(to bottom right, #0f172a, #1e293b)',
//       padding: '24px',
//       color: '#fff'
//     }}>
//       {/* Input Section */}
//       <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
//         <h2 className="text-xl font-semibold mb-4 text-white">Input Options</h2>

//         {/* Mode Toggle */}
//         <div className="mb-4">
//           <div className="flex space-x-2">
//             <button
//               onClick={() => {
//                 setProcessingMode('url');
//                 setVideoFile(null);
//               }}
//               className={`px-4 py-2 rounded-md flex items-center ${
//                 processingMode === 'url'
//                   ? 'bg-blue-500 text-white'
//                   : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
//               }`}
//             >
//               📺 YouTube URL
//             </button>
//             <button
//               onClick={() => {
//                 setProcessingMode('upload');
//                 setVideoUrl('');
//               }}
//               className={`px-4 py-2 rounded-md flex items-center ${
//                 processingMode === 'upload'
//                   ? 'bg-blue-500 text-white'
//                   : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
//               }`}
//             >
//               📁 Upload Video
//             </button>
//           </div>
//         </div>

//         {/* URL Input */}
//         {processingMode === 'url' ? (
//           <div className="mb-4">
//             <label className="block text-sm font-medium text-gray-300 mb-2">
//               YouTube URL
//             </label>
//             <input
//               type="text"
//               value={videoUrl}
//               onChange={(e) => setVideoUrl(e.target.value)}
//               placeholder="Enter YouTube URL"
//               className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
//             />
//           </div>
//         ) : (
//           <div className="mb-4">
//             <label className="block text-sm font-medium text-gray-300 mb-2">
//               Upload Video File
//             </label>
//             <input
//               type="file"
//               accept="video/*"
//               onChange={handleFileSelect}
//               className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white file:bg-gray-600 file:text-white file:border-none file:rounded-md file:px-3 file:py-1 file:mr-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
//             />
//             {videoPreview && (
//               <div className="mt-4 p-4 bg-gray-700 rounded-md border border-gray-600">
//                 <p className="text-sm text-gray-300">📁 {videoFile?.name}</p>
//                 <p className="text-sm text-gray-300">Size: {(videoFile?.size / 1024 / 1024 / 1024).toFixed(2)} GB</p>
//                 <div className="mt-2">
//                   <video width="200" height="120" controls>
//                     <source src={videoPreview} type="video/mp4" />
//                   </video>
//                 </div>
//               </div>
//             )}
//           </div>
//         )}

//         {/* Action Buttons */}
//         <div className="flex flex-wrap gap-2 mt-4">
//           <button
//             onClick={processVideo}
//             disabled={!isProcessingReady || loading.process}
//             className="w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:text-gray-400"
//           >
//             {loading.process ? '⏳ Processing All...' : '🚀 Process All (Thumbnails, Trailer, Subtitles, Metadata)'}
//           </button>
//           <button
//             onClick={generateThumbnails}
//             disabled={!isProcessingReady || loading.thumbnails}
//             className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
//           >
//             {loading.thumbnails ? '⏳ Generating...' : '🖼️ Generate Thumbnails'}
//           </button>
//           <button
//             onClick={generateTrailer}
//             disabled={!isProcessingReady || loading.trailer}
//             className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
//           >
//             {loading.trailer ? '⏳ Generating...' : '🎥 Generate Trailer'}
//           </button>
//           <button
//             onClick={generateSubtitles}
//             disabled={!isProcessingReady || loading.subtitles}
//             className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
//           >
//             {loading.subtitles ? '⏳ Generating...' : '📝 Generate Subtitles'}
//           </button>
//           <button
//             onClick={generateMetadata}
//             disabled={!isProcessingReady || loading.metadata}
//             className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-400"
//           >
//             {loading.metadata ? '⏳ Generating...' : '📋 Generate Metadata'}
//           </button>
//         </div>
//       </div>

//       {/* Videos Table */}
//       {videos.length > 0 && (
//         <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
//           <h2 className="text-xl font-semibold mb-4 text-white">📊 Generated Videos</h2>
//           <div className="overflow-x-auto">
//             <table className="min-w-full table-auto">
//               <thead>
//                 <tr className="bg-gray-700">
//                   <th className="px-4 py-2 text-left text-gray-300">Source</th>
//                   <th className="px-4 py-2 text-left text-gray-300">Title</th>
//                   <th className="px-4 py-2 text-left text-gray-300">Thumbnails</th>
//                   <th className="px-4 py-2 text-left text-gray-300">Trailer</th>
//                   <th className="px-4 py-2 text-left text-gray-300">Subtitles</th>
//                   <th className="px-4 py-2 text-left text-gray-300">Metadata</th>
//                   <th className="px-4 py-2 text-left text-gray-300">Date</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {videos.map(video => (
//                   <tr key={video._id} className="border-t border-gray-600">
//                     <td className="px-4 py-2">
//                       <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
//                         video.type === 'youtube'
//                           ? 'bg-red-900 text-red-200'
//                           : 'bg-blue-900 text-blue-200'
//                       }`}>
//                         {video.type === 'youtube' ? '📺 YouTube' : '📁 Upload'}
//                       </span>
//                     </td>
//                     <td className="px-4 py-2 text-gray-300">{video.title || '—'}</td>
//                     <td className="px-4 py-2">
//                       {video.generated.thumbnails ? (
//                         <div className="flex items-center space-x-2">
//                           <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900 text-green-200">✓</span>
//                           <button
//                             onClick={() => openThumbnailModal(video)}
//                             className="text-blue-400 hover:text-blue-300 text-sm"
//                           >
//                             View ({video.thumbnails.length})
//                           </button>
//                         </div>
//                       ) : <span className="text-gray-500">—</span>}
//                     </td>
//                     <td className="px-4 py-2">
//                       {video.generated.trailer ? (
//                         <div className="flex items-center space-x-2">
//                           <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900 text-green-200">✓</span>
//                           <button
//                             onClick={() => openTrailerModal(video)}
//                             className="text-blue-400 hover:text-blue-300"
//                           >
//                             ▶️
//                           </button>
//                         </div>
//                       ) : <span className="text-gray-500">—</span>}
//                     </td>
//                     <td className="px-4 py-2">
//                       {video.generated.subtitles ? (
//                         <div className="flex items-center space-x-2">
//                           <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900 text-green-200">✓</span>
//                           <button
//                             onClick={() => openSubtitleModal(video)}
//                             className="text-blue-400 hover:text-blue-300 text-sm"
//                           >
//                             View
//                           </button>
//                         </div>
//                       ) : <span className="text-gray-500">—</span>}
//                     </td>
//                     <td className="px-4 py-2">
//                       {video.generated.metadata ? (
//                         <div className="flex items-center space-x-2">
//                           <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900 text-green-200">✓</span>
//                           <button
//                             onClick={() => openMetadataModal(video)}
//                             className="text-blue-400 hover:text-blue-300"
//                           >
//                             ✏️
//                           </button>
//                         </div>
//                       ) : <span className="text-gray-500">—</span>}
//                     </td>
//                     <td className="px-4 py-2 text-gray-300">{new Date(video.createdAt).toLocaleDateString()}</td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       )}

//       {/* Thumbnails Modal */}
//       {showThumbnailModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
//             <div className="flex justify-between items-center p-6 border-b">
//               <h3 className="text-xl font-semibold">🖼️ Thumbnails</h3>
//               <button
//                 onClick={closeModal}
//                 className="text-gray-400 hover:text-gray-600"
//               >
//                 ✕
//               </button>
//             </div>
//             <div className="p-6">
//               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
//                 {currentModalData?.thumbnails.map((thumb, i) => (
//                   <div key={i} className="bg-gray-50 rounded-lg p-4 text-center">
//                     <img src={thumb.dataUrl} alt={`Thumb ${i+1}`} className="w-full h-auto rounded" />
//                     <p className="text-sm mt-2">#{i + 1}</p>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Trailer Modal */}
//       {showTrailerModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="bg-white rounded-lg max-w-4xl w-full mx-4">
//             <div className="flex justify-between items-center p-6 border-b">
//               <h3 className="text-xl font-semibold">🎬 Trailer</h3>
//               <button
//                 onClick={closeModal}
//                 className="text-gray-400 hover:text-gray-600"
//               >
//                 ✕
//               </button>
//             </div>
//             <div className="p-6">
//               <div className="flex justify-center">
//                 <video controls className="max-w-full h-auto">
//                   <source src={`${API_BASE}/api/videos/trailer/${currentModalData?._id}`} type="video/mp4" />
//                 </video>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Subtitles Modal */}
//       {showSubtitleModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
//             <div className="flex justify-between items-center p-6 border-b">
//               <h3 className="text-xl font-semibold">📝 Subtitles</h3>
//               <button
//                 onClick={closeModal}
//                 className="text-gray-400 hover:text-gray-600"
//               >
//                 ✕
//               </button>
//             </div>
//             <div className="p-6">
//               <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded">
//                 {currentModalData?.subtitles?.content}
//               </pre>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Metadata Modal */}
//       {showMetadataModal && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="bg-white rounded-lg max-w-md w-full mx-4">
//             <div className="flex justify-between items-center p-6 border-b">
//               <h3 className="text-xl font-semibold">📋 Edit Metadata</h3>
//               <button
//                 onClick={closeModal}
//                 className="text-gray-400 hover:text-gray-600"
//               >
//                 ✕
//               </button>
//             </div>
//             <div className="p-6">
//               <div className="space-y-4">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
//                   <input
//                     type="text"
//                     value={editingMetadata?.title || ''}
//                     onChange={(e) => setEditingMetadata({ ...editingMetadata, title: e.target.value })}
//                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
//                   <textarea
//                     value={editingMetadata?.description || ''}
//                     onChange={(e) => setEditingMetadata({ ...editingMetadata, description: e.target.value })}
//                     rows={4}
//                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
//                   <input
//                     type="text"
//                     value={editingMetadata?.genre || ''}
//                     onChange={(e) => setEditingMetadata({ ...editingMetadata, genre: e.target.value })}
//                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                   />
//                 </div>
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
//                   <input
//                     type="text"
//                     value={editingMetadata?.tags?.join(', ') || ''}
//                     onChange={(e) => setEditingMetadata({ ...editingMetadata, tags: e.target.value.split(',').map(t => t.trim()) })}
//                     placeholder="comma separated"
//                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                   />
//                 </div>
//               </div>
//             </div>
//             <div className="flex justify-end p-6 border-t bg-gray-50">
//               <button
//                 onClick={saveMetadata}
//                 className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
//               >
//                 💾 Save Changes
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   )
// }

// export default ContentGeneration
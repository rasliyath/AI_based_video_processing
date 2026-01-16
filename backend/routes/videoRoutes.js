// const express = require("express");
// const router = express.Router();
// const { spawnSync } = require("child_process");
// const Video = require("../models/Video");
// const { upload, uploadErrorHandler } = require("../middleware/upload");
// const path = require("path");
// const fs = require("fs");

// const pythonDir = path.join(__dirname, "../../python_scripts");
// const youtubeScript = path.join(pythonDir, "youtube_downloader.py");
// const thumbnailScript = path.join(pythonDir, "thumbnail_generator.py");
// const trailerScript = path.join(pythonDir, "trailer_generator.py");
// const metadataScript = path.join(pythonDir, "metadata_generator.py");
// const subtitleScript = path.join(pythonDir, "subtitle_generator.py");

// // Temp directories
// const tempThumbDir = path.join(__dirname, "../temp_thumbnails");
// const tempTrailerDir = path.join(__dirname, "../temp_trailers");
// const tempSubtitleDir = path.join(__dirname, "../temp_subtitles");

// // Ensure temp directories exist
// [tempThumbDir, tempTrailerDir, tempSubtitleDir].forEach(dir => {
//   if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
// });

// const TIMEOUTS = {
//   youtube: 60000,
//   thumbnail: 600000,
//   trailer: 180000,
//   metadata: 180000,
//   subtitles: 300000
// };

// function runPython(scriptPath, args, timeoutMs = 120000, allowRetry = true) {
//   const spawnArgs = [scriptPath].concat(args);
//   console.log(`[Python] Running: ${path.basename(scriptPath)} with ${args.length} args (timeout ${timeoutMs/1000}s)`);

//   const res = spawnSync('python', spawnArgs, {
//     encoding: 'utf8',
//     timeout: timeoutMs,
//     maxBuffer: 1024 * 1024 * 50
//   });

//   if (res.error) {
//     console.error(`[Python Error] ${res.error.code}:`, res.error.message);
//     if (res.error.code === 'ETIMEDOUT') {
//       if (allowRetry && timeoutMs < 900000) {
//         const newTimeout = Math.min(timeoutMs * 2, 900000);
//         console.log(`[Python] Timeout after ${timeoutMs/1000}s. Retrying with ${newTimeout/1000}s...`);
//         return runPython(scriptPath, args, newTimeout, false);
//       }
//       throw new Error(`Script timeout after ${timeoutMs / 1000}s`);
//     }
//     throw res.error;
//   }

//   if (res.status !== 0) {
//     console.error(`[Python Exit Code ${res.status}]`);
//     if (res.stderr) console.error('stderr:', res.stderr);
//     if (res.stdout) console.error('stdout:', res.stdout);
//     throw new Error(res.stderr || `Script exited with code ${res.status}`);
//   }

//   if (res.stdout) console.log(res.stdout);
//   return res.stdout || '';
// }

// // ============================================================
// // GET ALL VIDEOS (for table view)
// // ============================================================
// router.get("/", async (req, res) => {
//   try {
//     const videos = await Video.find()
//       .select('url type title thumbnails trailer subtitles metadata generated createdAt')
//       .lean();
    
//     // Convert buffer data to base64 for thumbnails
//     const videosWithData = videos.map(video => ({
//       ...video,
//       thumbnails: video.thumbnails.map(thumb => ({
//         ...thumb,
//         dataUrl: `data:${thumb.contentType};base64,${thumb.data.toString('base64')}`
//       }))
//     }));

//     res.json(videosWithData);
//   } catch (err) {
//     console.error("[GET /] Error:", err.message);
//     res.status(500).json({ error: err.message });
//   }
// });

// // ============================================================
// // GET SINGLE VIDEO BY ID
// // ============================================================
// router.get("/video/:id", async (req, res) => {
//   try {
//     const video = await Video.findById(req.params.id);
//     if (!video) return res.status(404).json({ error: 'Video not found' });

//     // Convert buffers to base64 for display
//     const videoData = video.toObject();
//     if (videoData.thumbnails) {
//       videoData.thumbnails = videoData.thumbnails.map(thumb => ({
//         ...thumb,
//         dataUrl: `data:${thumb.contentType};base64,${thumb.data.toString('base64')}`
//       }));
//     }
//     if (videoData.trailer && videoData.trailer.data) {
//       videoData.trailer.dataUrl = `data:${videoData.trailer.contentType};base64,${videoData.trailer.data.toString('base64')}`;
//     }

//     res.json(videoData);
//   } catch (err) {
//     console.error("[GET /video/:id] Error:", err.message);
//     res.status(500).json({ error: err.message });
//   }
// });

// // ============================================================
// // PROCESS ALL (Thumbnails + Trailer + Subtitles + Metadata)
// // ============================================================
// router.post("/process", upload.single("video"), uploadErrorHandler, async (req, res) => {
//   const { youtubeUrl } = req.body;
//   let videoPath = null;
//   let videoDoc = null;

//   console.log("=== Starting Video Processing ===");

//   try {
//     // Get or create video document
//     if (youtubeUrl) {
//       videoDoc = await Video.findOneAndUpdate(
//         { url: youtubeUrl, type: 'youtube' },
//         { url: youtubeUrl, type: 'youtube' },
//         { upsert: true, new: true }
//       );
//       console.log("YouTube video:", videoDoc._id);
//     } else if (req.file) {
//       videoDoc = await Video.findOneAndUpdate(
//         { uploadedFile: req.file.path, type: 'uploaded' },
//         { 
//           uploadedFile: req.file.path,
//           originalFilename: req.file.originalname,
//           type: 'uploaded',
//           url: req.file.path
//         },
//         { upsert: true, new: true }
//       );
//       console.log("Uploaded video:", videoDoc._id);
//     } else {
//       return res.status(400).json({ error: "Provide YouTube URL or upload video file" });
//     }

//     // Get video path
//     if (youtubeUrl) {
//       const output = runPython(youtubeScript, [youtubeUrl], TIMEOUTS.youtube);
//       let jsonMatch = output.match(/\{[\s\S]*\}/);
//       const result = JSON.parse(jsonMatch[0]);
//       if (!result.success) throw new Error(result.error);
//       videoPath = result.url;
//     } else {
//       videoPath = req.file.path;
//       if (!fs.existsSync(videoPath)) throw new Error(`File not found: ${videoPath}`);
//     }

//     // ===== THUMBNAILS =====
//     console.log("\n[Step 1] Generating thumbnails...");
//     try {
//       runPython(thumbnailScript, [videoPath, tempThumbDir, "20"], TIMEOUTS.thumbnail);
      
//       const thumbFiles = fs.readdirSync(tempThumbDir)
//         .filter(f => f.startsWith('thumb_') && f.endsWith('.jpg'))
//         .sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]));

//       videoDoc.thumbnails = thumbFiles.map(filename => ({
//         filename,
//         data: fs.readFileSync(path.join(tempThumbDir, filename)),
//         contentType: 'image/jpeg',
//         createdAt: new Date()
//       }));
//       videoDoc.generated.thumbnails = true;

//       // Clean temp
//       thumbFiles.forEach(f => fs.unlinkSync(path.join(tempThumbDir, f)));
//       console.log(`✓ Generated ${thumbFiles.length} thumbnails`);
//     } catch (e) {
//       console.log("⚠ Thumbnails failed:", e.message);
//       videoDoc.generated.thumbnails = false;
//     }

//     // ===== TRAILER =====
//     console.log("\n[Step 2] Generating trailer...");
//     try {
//       const trailerPath = path.join(tempTrailerDir, `trailer_${Date.now()}.mp4`);
//       runPython(trailerScript, [videoPath, trailerPath, "highlights"], TIMEOUTS.trailer);
      
//       if (fs.existsSync(trailerPath) && fs.statSync(trailerPath).size > 10000) {
//         const filename = path.basename(trailerPath);
//         videoDoc.trailer = {
//           filename,
//           data: fs.readFileSync(trailerPath),
//           contentType: 'video/mp4',
//           size: fs.statSync(trailerPath).size,
//           createdAt: new Date()
//         };
//         videoDoc.generated.trailer = true;
//         fs.unlinkSync(trailerPath);
//         console.log(`✓ Trailer generated`);
//       }
//     } catch (e) {
//       console.log("⚠ Trailer failed:", e.message);
//       videoDoc.generated.trailer = false;
//     }

//     // ===== SUBTITLES =====
//     console.log("\n[Step 3] Generating subtitles...");
//     try {
//       const subtitlePath = path.join(tempSubtitleDir, `subtitles_${Date.now()}.srt`);
//       runPython(subtitleScript, [videoPath, subtitlePath], TIMEOUTS.subtitles);
      
//       if (fs.existsSync(subtitlePath)) {
//         const content = fs.readFileSync(subtitlePath, 'utf-8');
//         if (content.length > 100) {
//           videoDoc.subtitles = {
//             filename: path.basename(subtitlePath),
//             content,
//             createdAt: new Date()
//           };
//           videoDoc.generated.subtitles = true;
//           fs.unlinkSync(subtitlePath);
//           console.log(`✓ Subtitles generated`);
//         }
//       }
//     } catch (e) {
//       console.log("⚠ Subtitles failed:", e.message);
//       videoDoc.generated.subtitles = false;
//     }

//     // ===== METADATA =====
//     console.log("\n[Step 4] Generating metadata...");
//     try {
//       const args = [videoPath];
//       if (videoDoc.subtitles && videoDoc.subtitles.content) {
//         const tempSubFile = path.join(tempSubtitleDir, 'temp.srt');
//         fs.writeFileSync(tempSubFile, videoDoc.subtitles.content);
//         args.push(tempSubFile);
//       }
      
//       const output = runPython(metadataScript, args, TIMEOUTS.metadata);
//       const metadata = JSON.parse(output.trim());
      
//       videoDoc.metadata = metadata;
//       videoDoc.title = metadata.title;
//       videoDoc.generated.metadata = true;
      
//       console.log(`✓ Metadata generated`);
//     } catch (e) {
//       console.log("⚠ Metadata failed:", e.message);
//       videoDoc.generated.metadata = false;
//     }

//     // Save to MongoDB
//     await videoDoc.save();

//     // Prepare response
//     const response = {
//       success: true,
//       videoId: videoDoc._id,
//       message: "Processing complete!",
//       generated: videoDoc.generated,
//       metadata: videoDoc.metadata,
//       thumbnailCount: videoDoc.thumbnails.length,
//       hasTrailer: !!videoDoc.trailer,
//       hasSubtitles: !!videoDoc.subtitles,
//     };

//     console.log("\n=== Processing Complete ===\n");
//     res.json(response);

//   } catch (err) {
//     console.error("\n[FATAL ERROR]:", err.message);
//     res.status(500).json({ success: false, error: err.message });
//   }
// });

// // ============================================================
// // GENERATE THUMBNAILS ONLY
// // ============================================================
// router.post('/thumbnails', upload.single("video"), uploadErrorHandler, async (req, res) => {
//   const { url, videoId } = req.body;
//   let videoPath = null;
//   let videoDoc = null;

//   try {
//     console.log("[Thumbnails] Request received");

//     // Get existing video or create new
//     if (videoId) {
//       videoDoc = await Video.findById(videoId);
//       if (!videoDoc) return res.status(404).json({ error: 'Video not found' });
//       videoPath = videoDoc.url;
//     } else if (url) {
//       videoDoc = await Video.findOneAndUpdate(
//         { url, type: 'youtube' },
//         { url, type: 'youtube' },
//         { upsert: true, new: true }
//       );
//       videoPath = url;
//     } else if (req.file) {
//       videoDoc = await Video.findOneAndUpdate(
//         { uploadedFile: req.file.path, type: 'uploaded' },
//         { uploadedFile: req.file.path, originalFilename: req.file.originalname, type: 'uploaded', url: req.file.path },
//         { upsert: true, new: true }
//       );
//       videoPath = req.file.path;
//     }

//     if (!videoPath) return res.status(400).json({ error: 'No video source' });

//     // Generate thumbnails
//     runPython(thumbnailScript, [videoPath, tempThumbDir, "20"], TIMEOUTS.thumbnail);

//     const thumbFiles = fs.readdirSync(tempThumbDir)
//       .filter(f => f.startsWith('thumb_') && f.endsWith('.jpg'))
//       .sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]));

//     // Add to existing thumbnails (don't replace)
//     videoDoc.thumbnails.push(...thumbFiles.map(filename => ({
//       filename,
//       data: fs.readFileSync(path.join(tempThumbDir, filename)),
//       contentType: 'image/jpeg',
//       createdAt: new Date()
//     })));

//     videoDoc.generated.thumbnails = true;
//     await videoDoc.save();

//     // Clean temp
//     thumbFiles.forEach(f => fs.unlinkSync(path.join(tempThumbDir, f)));

//     res.json({
//       success: true,
//       videoId: videoDoc._id,
//       thumbnailCount: videoDoc.thumbnails.length,
//       message: `Added ${thumbFiles.length} new thumbnails`
//     });

//   } catch (err) {
//     console.error("[Thumbnails Error]:", err.message);
//     res.status(500).json({ error: err.message });
//   }
// });

// // ============================================================
// // GENERATE TRAILER ONLY
// // ============================================================
// router.post('/trailer', upload.single("video"), uploadErrorHandler, async (req, res) => {
//   const { url, videoId } = req.body;
//   let videoPath = null;
//   let videoDoc = null;

//   try {
//     console.log("[Trailer] Request received");

//     // Get existing video or create new
//     if (videoId) {
//       videoDoc = await Video.findById(videoId);
//       if (!videoDoc) return res.status(404).json({ error: 'Video not found' });
//       videoPath = videoDoc.url;
//     } else if (url) {
//       videoDoc = await Video.findOneAndUpdate(
//         { url, type: 'youtube' },
//         { url, type: 'youtube' },
//         { upsert: true, new: true }
//       );
//       // Download video
//       const output = runPython(youtubeScript, [url], TIMEOUTS.youtube);
//       let jsonMatch = output.match(/\{[\s\S]*\}/);
//       const result = JSON.parse(jsonMatch[0]);
//       if (!result.success) throw new Error(result.error);
//       videoPath = result.url;
//     } else if (req.file) {
//       videoDoc = await Video.findOneAndUpdate(
//         { uploadedFile: req.file.path, type: 'uploaded' },
//         { uploadedFile: req.file.path, originalFilename: req.file.originalname, type: 'uploaded', url: req.file.path },
//         { upsert: true, new: true }
//       );
//       videoPath = req.file.path;
//     }

//     if (!videoPath) return res.status(400).json({ error: 'No video source' });

//     // Generate trailer
//     const trailerPath = path.join(tempTrailerDir, `trailer_${Date.now()}.mp4`);
//     runPython(trailerScript, [videoPath, trailerPath, "highlights"], TIMEOUTS.trailer);

//     if (fs.existsSync(trailerPath) && fs.statSync(trailerPath).size > 10000) {
//       const filename = path.basename(trailerPath);
//       videoDoc.trailer = {
//         filename,
//         data: fs.readFileSync(trailerPath),
//         contentType: 'video/mp4',
//         size: fs.statSync(trailerPath).size,
//         createdAt: new Date()
//       };
//       videoDoc.generated.trailer = true;
//       fs.unlinkSync(trailerPath);
//     } else {
//       throw new Error('Trailer generation failed');
//     }

//     await videoDoc.save();

//     res.json({
//       success: true,
//       videoId: videoDoc._id,
//       message: 'Trailer generated successfully'
//     });

//   } catch (err) {
//     console.error("[Trailer Error]:", err.message);
//     res.status(500).json({ error: err.message });
//   }
// });

// // ============================================================
// // GENERATE SUBTITLES ONLY
// // ============================================================
// router.post('/subtitles', upload.single("video"), uploadErrorHandler, async (req, res) => {
//   const { url, videoId } = req.body;
//   let videoPath = null;
//   let videoDoc = null;

//   try {
//     console.log("[Subtitles] Request received");

//     // Get existing video or create new
//     if (videoId) {
//       videoDoc = await Video.findById(videoId);
//       if (!videoDoc) return res.status(404).json({ error: 'Video not found' });
//       videoPath = videoDoc.url;
//     } else if (url) {
//       videoDoc = await Video.findOneAndUpdate(
//         { url, type: 'youtube' },
//         { url, type: 'youtube' },
//         { upsert: true, new: true }
//       );
//       // Download video
//       const output = runPython(youtubeScript, [url], TIMEOUTS.youtube);
//       let jsonMatch = output.match(/\{[\s\S]*\}/);
//       const result = JSON.parse(jsonMatch[0]);
//       if (!result.success) throw new Error(result.error);
//       videoPath = result.url;
//     } else if (req.file) {
//       videoDoc = await Video.findOneAndUpdate(
//         { uploadedFile: req.file.path, type: 'uploaded' },
//         { uploadedFile: req.file.path, originalFilename: req.file.originalname, type: 'uploaded', url: req.file.path },
//         { upsert: true, new: true }
//       );
//       videoPath = req.file.path;
//     }

//     if (!videoPath) return res.status(400).json({ error: 'No video source' });

//     // Generate subtitles
//     const subtitlePath = path.join(tempSubtitleDir, `subtitles_${Date.now()}.srt`);
//     runPython(subtitleScript, [videoPath, subtitlePath], TIMEOUTS.subtitles);

//     if (fs.existsSync(subtitlePath)) {
//       const content = fs.readFileSync(subtitlePath, 'utf-8');
//       if (content.length > 100) {
//         videoDoc.subtitles = {
//           filename: path.basename(subtitlePath),
//           content,
//           createdAt: new Date()
//         };
//         videoDoc.generated.subtitles = true;
//         fs.unlinkSync(subtitlePath);
//       } else {
//         throw new Error('Subtitles generation failed');
//       }
//     } else {
//       throw new Error('Subtitles file not found');
//     }

//     await videoDoc.save();

//     res.json({
//       success: true,
//       videoId: videoDoc._id,
//       message: 'Subtitles generated successfully'
//     });

//   } catch (err) {
//     console.error("[Subtitles Error]:", err.message);
//     res.status(500).json({ error: err.message });
//   }
// });

// // ============================================================
// // GENERATE METADATA ONLY
// // ============================================================
// router.post('/metadata', upload.single("video"), uploadErrorHandler, async (req, res) => {
//   const { url, videoId } = req.body;
//   let videoPath = null;
//   let videoDoc = null;

//   try {
//     console.log("[Metadata] Request received");

//     // Get existing video or create new
//     if (videoId) {
//       videoDoc = await Video.findById(videoId);
//       if (!videoDoc) return res.status(404).json({ error: 'Video not found' });
//       videoPath = videoDoc.url;
//     } else if (url) {
//       videoDoc = await Video.findOneAndUpdate(
//         { url, type: 'youtube' },
//         { url, type: 'youtube' },
//         { upsert: true, new: true }
//       );
//       // Download video
//       const output = runPython(youtubeScript, [url], TIMEOUTS.youtube);
//       let jsonMatch = output.match(/\{[\s\S]*\}/);
//       const result = JSON.parse(jsonMatch[0]);
//       if (!result.success) throw new Error(result.error);
//       videoPath = result.url;
//     } else if (req.file) {
//       videoDoc = await Video.findOneAndUpdate(
//         { uploadedFile: req.file.path, type: 'uploaded' },
//         { uploadedFile: req.file.path, originalFilename: req.file.originalname, type: 'uploaded', url: req.file.path },
//         { upsert: true, new: true }
//       );
//       videoPath = req.file.path;
//     }

//     if (!videoPath) return res.status(400).json({ error: 'No video source' });

//     // Generate metadata
//     const args = [videoPath];
//     if (videoDoc.subtitles && videoDoc.subtitles.content) {
//       const tempSubFile = path.join(tempSubtitleDir, 'temp.srt');
//       fs.writeFileSync(tempSubFile, videoDoc.subtitles.content);
//       args.push(tempSubFile);
//     }

//     const output = runPython(metadataScript, args, TIMEOUTS.metadata);
//     const metadata = JSON.parse(output.trim());

//     videoDoc.metadata = metadata;
//     videoDoc.title = metadata.title;
//     videoDoc.generated.metadata = true;

//     await videoDoc.save();

//     res.json({
//       success: true,
//       videoId: videoDoc._id,
//       message: 'Metadata generated successfully',
//       metadata
//     });

//   } catch (err) {
//     console.error("[Metadata Error]:", err.message);
//     res.status(500).json({ error: err.message });
//   }
// });

// // ============================================================
// // EDIT METADATA
// // ============================================================
// router.put('/metadata/:id', async (req, res) => {
//   try {
//     const { title, description, tags, genre, category } = req.body;

//     const videoDoc = await Video.findByIdAndUpdate(
//       req.params.id,
//       {
//         metadata: {
//           ...req.body,
//           lastEdited: new Date()
//         },
//         title: title || req.body.title
//       },
//       { new: true }
//     );

//     if (!videoDoc) return res.status(404).json({ error: 'Video not found' });

//     res.json({
//       success: true,
//       metadata: videoDoc.metadata
//     });
//   } catch (err) {
//     console.error("[Metadata Update Error]:", err.message);
//     res.status(500).json({ error: err.message });
//   }
// });

// // ============================================================
// // GET TRAILER (as blob for playback)
// // ============================================================
// router.get('/trailer/:id', async (req, res) => {
//   try {
//     const videoDoc = await Video.findById(req.params.id);
//     if (!videoDoc || !videoDoc.trailer) {
//       return res.status(404).json({ error: 'Trailer not found' });
//     }

//     res.set('Content-Type', videoDoc.trailer.contentType);
//     res.send(videoDoc.trailer.data);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // ============================================================
// // GET SUBTITLES (as text)
// // ============================================================
// router.get('/subtitles/:id', async (req, res) => {
//   try {
//     const videoDoc = await Video.findById(req.params.id);
//     if (!videoDoc || !videoDoc.subtitles) {
//       return res.status(404).json({ error: 'Subtitles not found' });
//     }

//     res.set('Content-Type', 'text/plain');
//     res.send(videoDoc.subtitles.content);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// module.exports = router;
const express = require("express");
const router = express.Router();
const { spawnSync } = require("child_process");
const Video = require("../models/Video");
const upload = require("../middleware/upload");
const path = require("path");
const fs = require("fs");

// Paths
const pythonDir = path.join(__dirname, "../../python_scripts");
const youtubeScript = path.join(pythonDir, "youtube_downloader.py");
const thumbnailScript = path.join(pythonDir, "thumbnail_generator.py");
const trailerScript = path.join(pythonDir, "trailer_generator.py");
const metadataScript = path.join(pythonDir, "metadata_generator.py");
const subtitleScript = path.join(pythonDir, "subtitle_generator.py");

// Timeout configuration (in milliseconds)
const TIMEOUTS = {
  thumbnail: 600000,   // 10 minutes (increased to handle large files)
  trailer: 180000,     // 3 minutes
  metadata: 120000,     // 2 minutes (increased for slow or large files)
  subtitles: 120000    // 2 minutes
};

// Helper function to run Python scripts synchronously with an optional retry on ETIMEDOUT
function runPython(scriptPath, args, timeoutMs = 120000, allowRetry = true) {
  const spawnArgs = [scriptPath].concat(args);
  console.log(`[Python] Running: ${path.basename(scriptPath)} with ${args.length} args (timeout ${timeoutMs/1000}s)`);

  const res = spawnSync('python', spawnArgs, {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 50 // 50MB buffer
  });

  if (res.error) {
    console.error(`[Python Error] ${res.error.code}:`, res.error.message);
    if (res.error.code === 'ETIMEDOUT') {
      if (allowRetry && timeoutMs < 900000) {
        const newTimeout = Math.min(timeoutMs * 2, 900000);
        console.log(`[Python] Timeout after ${timeoutMs/1000}s. Retrying with ${newTimeout/1000}s...`);
        return runPython(scriptPath, args, newTimeout, false);
      }
      throw new Error(`Script timeout after ${timeoutMs / 1000}s - increase timeout or optimize script`);
    }
    throw res.error;
  }

  if (res.status !== 0) {
    console.error(`[Python Exit Code ${res.status}]`);
    if (res.stderr) console.error('stderr:', res.stderr);
    if (res.stdout) console.error('stdout:', res.stdout);
    throw new Error(res.stderr || `Script exited with code ${res.status}`);
  }

  if (res.stdout) console.log(res.stdout);
  return res.stdout || '';
}

// Get all videos
router.get("/", async (req, res) => {
  try {
    const videos = await Video.find();
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Process video
router.post("/process", upload.single("video"), async (req, res) => {
  const { youtubeUrl } = req.body;
  let videoPath = null;
  let tempFiles = [];

  console.log("=== Starting Video Processing ===");
  if (youtubeUrl) console.log("YouTube URL:", youtubeUrl);
  if (req.file) console.log("Uploaded file:", req.file.filename);

  try {
    // Step 1: Get video
    if (youtubeUrl) {
      console.log("\n[Step 1] Downloading from YouTube...");
      
      const downloadDir = path.join(__dirname, "../uploads");
      
      try {
        runPython(youtubeScript, [youtubeUrl, downloadDir], 300000);
      } catch (e) {
        console.log("Download warning:", e.message);
      }
      
      // Find downloaded file
      const files = fs.readdirSync(downloadDir)
        .filter(f => f.endsWith('.mp4'))
        .map(f => ({
          name: f,
          time: fs.statSync(path.join(downloadDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);
      
      if (files.length === 0) {
        return res.status(500).json({ error: "Download failed - no MP4 files found" });
      }
      
      videoPath = path.join(downloadDir, files[0].name);
      tempFiles.push(videoPath);
      console.log("✓ Downloaded:", files[0].name);
    } 
    else if (req.file) {
      videoPath = req.file.path;
      console.log("✓ Using uploaded file:", videoPath);
    } 
    else {
      return res.status(400).json({ error: "Provide YouTube URL or upload video file" });
    }

    // Step 2: Generate Thumbnails
    console.log("\n[Step 2] Generating 10 thumbnails...");
    
    const thumbnailsDir = path.join(__dirname, "../thumbnails");
    // Clean old thumbnails
    if (fs.existsSync(thumbnailsDir)) {
      fs.readdirSync(thumbnailsDir).forEach(f => {
        try { fs.unlinkSync(path.join(thumbnailsDir, f)); } catch(e) {}
      });
    }
    
    runPython(thumbnailScript, [videoPath, thumbnailsDir, "10"], TIMEOUTS.thumbnail);
    
    const thumbnailFiles = fs.readdirSync(thumbnailsDir)
      .filter(f => f.startsWith('thumb_') && f.endsWith('.jpg'))
      .sort((a, b) => {
        const numA = parseInt(a.split('_')[1]);
        const numB = parseInt(b.split('_')[1]);
        return numA - numB;
      });
    
    console.log(`✓ Generated ${thumbnailFiles.length} thumbnails`);
    if (thumbnailFiles.length < 10) {
      console.log(`⚠ Warning: Expected 10, got ${thumbnailFiles.length}`);
    }

    // Step 3: Generate Trailer
    console.log("\n[Step 3] Generating 15s trailer...");
    
    const trailersDir = path.join(__dirname, "../trailers");
    if (!fs.existsSync(trailersDir)) fs.mkdirSync(trailersDir, { recursive: true });
    
    const trailerPath = path.join(trailersDir, `trailer_${Date.now()}.mp4`);
    let trailerGenerated = false;
    
    try {
      runPython(trailerScript, [videoPath, trailerPath, "15"], TIMEOUTS.trailer);
      
      // Verify trailer file exists and has content
      if (fs.existsSync(trailerPath) && fs.statSync(trailerPath).size > 10000) {
        trailerGenerated = true;
        const trailerSize = (fs.statSync(trailerPath).size / 1024 / 1024).toFixed(2);
        console.log(`✓ Trailer generated (${trailerSize} MB)`);
        console.log(`  Path: ${trailerPath}`);
      } else {
        console.log("✗ Trailer file is empty or not created");
      }
    } catch (e) {
      console.log("✗ Trailer generation failed:", e.message);
    }

    // Step 4: Generate Metadata
    console.log("\n[Step 4] Generating metadata...");
    
    let metadata = {};
    try {
      const output = runPython(metadataScript, [videoPath], TIMEOUTS.metadata);
      metadata = JSON.parse(output.trim());
      console.log("✓ Metadata generated");
    } catch (e) {
      console.log("✗ Metadata failed, using defaults:", e.message);
      metadata = { 
        title: "AI Generated Video", 
        description: "Auto-generated metadata", 
        tags: ["ai-generated", "video"], 
        genre: "Entertainment",
        duration: 0
      };
    }

    // Step 5: Generate Subtitles
    console.log("\n[Step 5] Generating subtitles...");
    
    const subtitlePath = path.join(trailersDir, `subtitles_${Date.now()}.srt`);
    let subtitleGenerated = false;
    
    try {
      runPython(subtitleScript, [videoPath, subtitlePath], TIMEOUTS.subtitles);
      if (fs.existsSync(subtitlePath)) {
        subtitleGenerated = true;
        const subSize = fs.statSync(subtitlePath).size;
        console.log(`✓ Subtitles generated (${subSize} bytes)`);
      }
    } catch (e) {
      console.log("✗ Subtitles failed:", e.message);
    }

    // Cleanup
    //console.log("\n[Cleanup] Removing temporary files...");
    // tempFiles.forEach(f => {
    //   try { 
    //     if (fs.existsSync(f)) {
    //       fs.unlinkSync(f);
    //       console.log(`  Deleted: ${f}`);
    //     }
    //   } catch(e) {
    //     console.log(`  Failed to delete: ${f}`);
    //   }
    // });

    // Result
    const result = {
      success: true,
      message: "Processing complete!",
      thumbnails: thumbnailFiles.map(f => `thumbnails/${f}`),
      trailer: trailerGenerated ? `trailers/${path.basename(trailerPath)}` : null,
      subtitles: subtitleGenerated ? `trailers/${path.basename(subtitlePath)}` : null,
      metadata: metadata,
      stats: {
        thumbnail_count: thumbnailFiles.length,
        has_trailer: trailerGenerated,
        has_subtitles: subtitleGenerated
      }
    };

    console.log("\n=== Processing Complete ===");
    console.log(JSON.stringify(result, null, 2));
    res.json(result);

  } catch (err) {
    console.error("\n[FATAL ERROR]:", err.message);
    tempFiles.forEach(f => { 
      try { 
        if (fs.existsSync(f)) fs.unlinkSync(f); 
      } catch(e) {} 
    });
    res.status(500).json({ 
      success: false, 
      error: err.message,
      suggestion: "Check logs for details"
    });
  }
});

// Status endpoint: lists current thumbnails and trailer (useful for frontend polling)
router.get('/status', (req, res) => {
  try {
    const thumbnailsDir = path.join(__dirname, '../thumbnails');
    const trailersDir = path.join(__dirname, '../trailers');

    const thumbnails = fs.existsSync(thumbnailsDir)
      ? fs.readdirSync(thumbnailsDir).filter(f => f.startsWith('thumb_') && f.endsWith('.jpg'))
      : [];

    const trailerFiles = fs.existsSync(trailersDir)
      ? fs.readdirSync(trailersDir).filter(f => f.endsWith('.mp4'))
      : [];

    // pick latest trailer if exists
    let trailer = null;
    if (trailerFiles.length > 0) {
      trailerFiles.sort();
      trailer = `trailers/${trailerFiles[trailerFiles.length - 1]}`;
    }

    // Log status summary for easier debugging
    console.log(`[STATUS] thumbnails=${thumbnails.length}, trailer=${trailer || 'none'}`);

    res.json({
      thumbnails: thumbnails.map(f => `thumbnails/${f}`),
      trailer: trailer
    });
  } catch (err) {
    console.error('[STATUS ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
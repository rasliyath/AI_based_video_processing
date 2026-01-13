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
  youtube: 60000,      // 1 minute for URL extraction (NO DOWNLOAD)
  thumbnail: 600000,   // 10 minutes
  trailer: 120000,     // 2 minutes (fast mode should complete in <2min)
  metadata: 120000,    // 2 minutes
  subtitles: 300000    // 5 minutes for Whisper transcription
};

// Helper function to run Python scripts synchronously
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
      throw new Error(`Script timeout after ${timeoutMs / 1000}s`);
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
    // Step 1: Get video source
    if (youtubeUrl) {
      console.log("\n[Step 1] Extracting streaming URL from YouTube (NO DOWNLOAD)...");
      
      try {
        const output = runPython(youtubeScript, [youtubeUrl], TIMEOUTS.youtube);
        
        // Debug: log raw output
        console.log(`[Debug] Raw output length: ${output.length}`);
        
        // Find and extract JSON from output
        let jsonMatch = output.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error("[Debug] No JSON found in output");
          console.error("[Debug] First 500 chars:", output.substring(0, 500));
          throw new Error("YouTube script returned invalid JSON");
        }
        
        const jsonStr = jsonMatch[0];
        console.log(`[Debug] Extracted JSON length: ${jsonStr.length}`);
        
        const result = JSON.parse(jsonStr);
        
        if (!result.success) {
          throw new Error(result.error || "Failed to get stream URL");
        }
        
        videoPath = result.url;
        console.log("✓ Stream URL extracted successfully");
        console.log(`  Type: ${result.type}`);
        console.log(`  Has audio: ${result.has_audio}`);
        
      } catch (e) {
        console.error("✗ YouTube extraction failed:", e.message);
        return res.status(500).json({ error: "YouTube URL extraction failed: " + e.message });
      }
    } 
    else if (req.file) {
      videoPath = req.file.path;
      console.log("✓ Using uploaded file:", videoPath);
    } 
    else {
      return res.status(400).json({ error: "Provide YouTube URL or upload video file" });
    }

    // Step 2: Generate Thumbnails (Smart Quality Selection)
    console.log("\n[Step 2] Generating smart thumbnails with quality filtering...");
    
    const thumbnailsDir = path.join(__dirname, "../thumbnails");
    // Clean old thumbnails
    if (fs.existsSync(thumbnailsDir)) {
      fs.readdirSync(thumbnailsDir).forEach(f => {
        try { fs.unlinkSync(path.join(thumbnailsDir, f)); } catch(e) {}
      });
    }
    
    // Generate 20+ candidates, select best 10
    runPython(thumbnailScript, [videoPath, thumbnailsDir, "20"], TIMEOUTS.thumbnail);
    
    const thumbnailFiles = fs.readdirSync(thumbnailsDir)
      .filter(f => f.startsWith('thumb_') && f.endsWith('.jpg'))
      .sort((a, b) => {
        const numA = parseInt(a.split('_')[1]);
        const numB = parseInt(b.split('_')[1]);
        return numA - numB;
      });
    
    console.log(`✓ Generated ${thumbnailFiles.length} high-quality thumbnails`);

    // Step 3: Generate Highlight Trailer (Best Moments)
    console.log("\n[Step 3] Generating highlight trailer from best moments...");
    
    const trailersDir = path.join(__dirname, "../trailers");
    if (!fs.existsSync(trailersDir)) fs.mkdirSync(trailersDir, { recursive: true });
    
    const trailerPath = path.join(trailersDir, `trailer_${Date.now()}.mp4`);
    let trailerGenerated = false;
    
    try {
      // Pass "highlights" mode instead of fixed duration
      runPython(trailerScript, [videoPath, trailerPath, "highlights"], TIMEOUTS.trailer);
      
      // Verify trailer file exists and has content
      if (fs.existsSync(trailerPath) && fs.statSync(trailerPath).size > 10000) {
        trailerGenerated = true;
        const trailerSize = (fs.statSync(trailerPath).size / 1024 / 1024).toFixed(2);
        console.log(`✓ Highlight trailer generated (${trailerSize} MB)`);
        console.log(`  Path: ${trailerPath}`);
      } else {
        console.log("✗ Trailer file is empty or not created");
      }
    } catch (e) {
      console.log("✗ Trailer generation failed:", e.message);
    }

    // Step 4: Generate AI Subtitles with Whisper
    console.log("\n[Step 4] Generating subtitles using Whisper AI...");

    const subtitlePath = path.join(trailersDir, `subtitles_${Date.now()}.srt`);
    let subtitleGenerated = false;

    try {
      runPython(subtitleScript, [videoPath, subtitlePath], TIMEOUTS.subtitles);
      if (fs.existsSync(subtitlePath)) {
        const subSize = fs.statSync(subtitlePath).size;
        if (subSize > 100) { // Verify it's not empty
          subtitleGenerated = true;
          console.log(`✓ Subtitles generated (${subSize} bytes)`);
          console.log(`  Path: ${subtitlePath}`);
        } else {
          console.log("✗ Subtitle file is empty");
        }
      }
    } catch (e) {
      console.log("✗ Subtitles failed:", e.message);
    }

    // Step 5: Generate Metadata (using transcript if available)
    console.log("\n[Step 5] Generating AI metadata...");

    let metadata = {};
    try {
      const args = [videoPath];
      if (subtitleGenerated) {
        args.push(subtitlePath);
      }
      const output = runPython(metadataScript, args, TIMEOUTS.metadata);
      metadata = JSON.parse(output.trim());
      console.log("✓ Metadata generated");
      console.log(`  Title: ${metadata.title}`);
      console.log(`  Genre: ${metadata.genre}`);
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
        has_subtitles: subtitleGenerated,
        processing_type: youtubeUrl ? "streaming" : "uploaded"
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

// Status endpoint
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

    let trailer = null;
    if (trailerFiles.length > 0) {
      trailerFiles.sort();
      trailer = `trailers/${trailerFiles[trailerFiles.length - 1]}`;
    }

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
// const mongoose = require("mongoose");

// const videoSchema = new mongoose.Schema(
//   {
//     // Source info
//     url: {
//       type: String,
//       required: true,
//     },
//     type: {
//       type: String,
//       enum: ['youtube', 'uploaded'],
//       required: true,
//     },
//     originalFilename: {
//       type: String, // Original filename for uploaded videos
//     },
//     uploadedFile: {
//       type: String, // Path to uploaded file
//     },

//     // Title (editable)
//     title: {
//       type: String,
//       default: "",
//     },

//     // Thumbnails - store multiple versions
//     thumbnails: [{
//       filename: String,
//       data: Buffer, // Store image data in DB
//       contentType: String,
//       createdAt: {
//         type: Date,
//         default: Date.now,
//       }
//     }],

//     // Trailer - store video file
//     trailer: {
//       filename: String,
//       data: Buffer, // Store video data in DB
//       contentType: String,
//       size: Number,
//       createdAt: {
//         type: Date,
//         default: Date.now,
//       }
//     },

//     // Subtitles - store text
//     subtitles: {
//       filename: String,
//       content: String, // Store SRT text directly
//       createdAt: {
//         type: Date,
//         default: Date.now,
//       }
//     },

//     // Metadata - with edit capability
//     metadata: {
//       title: String,
//       description: String,
//       tags: [String],
//       genre: String,
//       category: String,
//       duration: Number,
//       analysis: Object, // Video analysis data
//       lastEdited: Date,
//     },

//     // Track processing status
//     processing: {
//       thumbnails: { type: Boolean, default: false },
//       trailer: { type: Boolean, default: false },
//       subtitles: { type: Boolean, default: false },
//       metadata: { type: Boolean, default: false },
//     },

//     // Track completion
//     generated: {
//       thumbnails: { type: Boolean, default: false },
//       trailer: { type: Boolean, default: false },
//       subtitles: { type: Boolean, default: false },
//       metadata: { type: Boolean, default: false },
//     },

//     // Generation history (for future auditing)
//     generationHistory: [{
//       type: {
//         type: String,
//         enum: ['thumbnail', 'trailer', 'subtitles', 'metadata']
//       },
//       generatedAt: Date,
//       status: String, // 'success' or 'failed'
//     }],
//   },
//   { timestamps: true }
// );

// // Index for faster queries
// videoSchema.index({ url: 1, type: 1 });

// module.exports = mongoose.model("Video", videoSchema);
const mongoose = require('mongoose');

const qoeEventSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    index: true,
    required: true
  },
  userId: {
    type: String,
    default: 'anonymous'
  },
  videoId: {
    type: String,
    required: true,
    index: true
  },

  // Only store critical event types
  eventType: {
    type: String,
    enum: ['buffering_start', 'buffering_end', 'quality_change', 'error', 'crash', 'session_end'],
    required: true
  },

  // Event-specific data
  eventData: {
    // For buffering
    duration: Number,  // buffering duration in seconds
    quality: String,

    // For quality change
    fromQuality: String,
    toQuality: String,

    // For errors
    errorCode: String,
    errorMessage: String,

    // For crashes
    message: String,
    source: String,
    lineno: Number,
    colno: Number,
    stack: String,
    userAgent: String,

    // Position in video
    videoTime: Number
  },

  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('QoEEvent', qoeEventSchema);
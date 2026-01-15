const mongoose = require('mongoose');

const qoeSessionSchema = new mongoose.Schema({
  // Session Identifiers
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    default: 'anonymous',
    index: true
  },
  videoId: {
    type: String,
    required: true,
    index: true
  },
  videoTitle: String,

  // Timing
  startTime: {
    type: Date,
    default: Date.now,
    index: true
  },
  endTime: Date,

  // Watch Duration (in seconds)
  totalSessionDuration: Number,  // Total time from start to end
  totalWatchDuration: Number,    // Actual time watched (excluding pauses)
  completedPercentage: Number,   // % of video watched (0-100)
  lastPlaybackPosition: Number,  // Where user stopped

  // Buffering Metrics
  bufferingEvents: [
    {
      startTime: Number,  // Position in video
      endTime: Number,
      duration: Number,   // In seconds
      quality: String,    // Quality at time of buffering
      timestamp: Date
    }
  ],
  totalBufferingTime: {
    type: Number,
    default: 0
  },
  totalBufferingCount: {
    type: Number,
    default: 0
  },
  bufferingPercentage: Number,  // (totalBufferingTime / totalSessionDuration) * 100

  // Quality Changes
  qualityChanges: [
    {
      timestamp: Date,
      fromQuality: String,
      toQuality: String,
      atVideoTime: Number,  // Position in video where change happened
      reason: {
        type: String,
        enum: ['auto', 'manual', 'buffering'],
        default: 'auto'
      }
    }
  ],
  totalQualityChanges: {
    type: Number,
    default: 0
  },
  qualityDistribution: {
    // e.g., { "hd1080": 120, "hd720": 80, "hd480": 45 }
    type: Map,
    of: Number
  },
  finalQuality: String,  // Last quality used

  // Playback Errors
  playbackErrors: [
    {
      code: String,
      message: String,
      timestamp: Date,
      atVideoTime: Number
    }
  ],
  totalErrors: {
    type: Number,
    default: 0
  },
  errorRate: Number,  // (totalErrors / totalSessionDuration) * 100

  // Device & Network Info
  deviceType: {
    type: String,
    enum: ['mobile', 'tablet', 'desktop'],
    default: 'desktop'
  },
  osInfo: String,
  networkType: {
    type: String,
    enum: ['2g', '3g', '4g', '5g', 'wifi', 'unknown'],
    default: 'unknown'
  },
  userAgent: String,

  // QoE Score (0-100)
  qoeScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  // Calculation: 100 - (bufferingPercentage * 0.5) - (errorRate * 1) - (qualityDropPercentage * 0.3)

  // Session Status
  status: {
    type: String,
    enum: ['active', 'completed', 'abandoned', 'error'],
    default: 'active'
  },

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('QoESession', qoeSessionSchema);
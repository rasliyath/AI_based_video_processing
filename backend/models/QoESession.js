// ==================== FIXED QoE SESSION SCHEMA ====================
const mongoose = require('mongoose');

const qoeSessionSchema = new mongoose.Schema({
  // Session identification
  sessionId: {
    type: String,
    unique: true,
    index: true,
    required: true
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

  // Device & Network info
  deviceType: {
    type: String,
    enum: ['mobile', 'tablet', 'desktop'],
    default: 'desktop'
  },
  osInfo: String,
  appVersion: String,
  networkType: {
    type: String,
    enum: ['wifi', '2g', '3g', '4g', '5g', 'unknown'],
    default: 'unknown'
  },
  userAgent: String,

  // CDN info
  cdnEndpoint: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // ==================== TIMING ====================
  startTime: {
    type: Date,
    default: Date.now,
    index: true
  },
  endTime: Date,
  totalSessionDuration: Number, // in seconds

  // ==================== PLAYBACK METRICS ====================
  totalWatchDuration: {
    type: Number,
    default: 0
  },
  completedPercentage: Number,
  lastPlaybackPosition: Number,

  // ==================== BUFFERING METRICS ====================
  bufferingEvents: [{
    startTime: Number,
    endTime: Number,
    duration: Number,
    quality: String,
    timestamp: Date,
    videoTime: Number
  }],
  totalBufferingTime: {
    type: Number,
    default: 0
  },
  totalBufferingCount: {
    type: Number,
    default: 0
  },
  bufferingPercentage: {
    type: Number,
    default: 0
  },

  // ==================== QUALITY METRICS ====================
  qualityChanges: [{
    timestamp: Date,
    fromQuality: String,
    toQuality: String,
    atVideoTime: Number
  }],
  totalQualityChanges: {
    type: Number,
    default: 0
  },
  finalQuality: String,

  // ==================== PLAYBACK ERRORS ====================
  playbackErrors: [{
    code: String,
    message: String,
    timestamp: Date,
    atVideoTime: Number
  }],
  totalErrors: {
    type: Number,
    default: 0
  },
  errorRate: {
    type: Number,
    default: 0
  },

  // ==================== RECORDED ERRORS (NEW) ====================
  // These are errors captured by event recording (network, crashes, etc.)
  recordedErrors: [{
    type: {
      type: String,
      enum: ['network_error', 'loading_error', 'initialization_error', 'playback_error'],
      required: true
    },
    message: String,
    code: String,
    videoTime: Number,
    timestamp: {
      type: Date,
      default: Date.now
    },
    severity: {
      type: String,
      enum: ['low', 'normal', 'critical'],
      default: 'normal'
    }
  }],
  recordedErrorCount: {
    type: Number,
    default: 0
  },

  // ==================== RECORDED CRASHES (NEW) ====================
  recordedCrashes: [{
    type: {
      type: String,
      required: true
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    severity: {
      type: String,
      enum: ['low', 'normal', 'critical'],
      default: 'critical'
    }
  }],
  recordedCrashCount: {
    type: Number,
    default: 0
  },

  // ==================== QoE SCORE ====================
  qoeScore: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },

  // ==================== SESSION STATUS ====================
  status: {
    type: String,
    enum: ['active', 'paused', 'completed', 'abandoned', 'error'],
    default: 'active',
    index: true
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
}, {
  timestamps: true,
  collection: 'qoe_sessions'
});

// ==================== INDEXES ====================
qoeSessionSchema.index({ videoId: 1, startTime: -1 });
qoeSessionSchema.index({ userId: 1, startTime: -1 });
qoeSessionSchema.index({ 'recordedErrors.type': 1 });
qoeSessionSchema.index({ 'recordedCrashes.type': 1 });

// ==================== VIRTUALS ====================
qoeSessionSchema.virtual('totalRecordedIssues').get(function() {
  return (this.recordedErrors?.length || 0) + (this.recordedCrashes?.length || 0);
});

// ==================== METHODS ====================
qoeSessionSchema.methods.addRecordedError = function(errorType, message, code, videoTime, severity = 'normal') {
  this.recordedErrors.push({
    type: errorType,
    message,
    code,
    videoTime,
    severity,
    timestamp: new Date()
  });
  this.recordedErrorCount = this.recordedErrors.length;
};

qoeSessionSchema.methods.addRecordedCrash = function(crashType, message, severity = 'critical') {
  this.recordedCrashes.push({
    type: crashType,
    message,
    severity,
    timestamp: new Date()
  });
  this.recordedCrashCount = this.recordedCrashes.length;
};

module.exports = mongoose.model('QoESession', qoeSessionSchema);
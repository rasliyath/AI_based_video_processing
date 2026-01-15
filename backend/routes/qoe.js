const express = require('express');
const router = express.Router();
const QoESession = require('../models/QoESession');
const QoEEvent = require('../models/QoEEvent');

// ✅ POST - Start new session
router.post('/session/start', async (req, res) => {
  try {
    const { sessionId, userId, videoId, videoTitle, deviceInfo, networkType } = req.body;

    const newSession = new QoESession({
      sessionId,
      userId: userId || 'anonymous',
      videoId,
      videoTitle,
      deviceType: deviceInfo?.type || 'desktop',
      osInfo: deviceInfo?.os,
      networkType: networkType || 'unknown',
      userAgent: req.get('user-agent'),
      status: 'active'
    });

    const savedSession = await newSession.save();

    console.log(`✅ Session started: ${sessionId}`);

    res.status(201).json({
      success: true,
      sessionId: sessionId,
      data: savedSession
    });

  } catch (error) {
    console.error('❌ Error starting session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ POST - Record critical event
router.post('/session/:sessionId/event', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userId, videoId, eventType, eventData } = req.body;

    // Only store critical events
    const criticalEvents = ['buffering_start', 'buffering_end', 'quality_change', 'error'];
    
    if (!criticalEvents.includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event type. Only critical events are stored.'
      });
    }

    const newEvent = new QoEEvent({
      sessionId,
      userId: userId || 'anonymous',
      videoId,
      eventType,
      eventData
    });

    await newEvent.save();

    console.log(`✅ Event recorded: ${eventType} for session ${sessionId}`);

    res.status(201).json({
      success: true,
      data: newEvent
    });

  } catch (error) {
    console.error('❌ Error recording event:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ POST - End session and calculate metrics
router.post('/session/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      totalWatchDuration,
      completedPercentage,
      lastPlaybackPosition,
      bufferingEvents,
      qualityChanges,
      playbackErrors,
      finalQuality
    } = req.body;

    // Fetch session
    const session = await QoESession.findOne({ sessionId });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Calculate metrics
    const endTime = new Date();
    const totalSessionDuration = Math.round((endTime - session.startTime) / 1000); // in seconds
    
    const totalBufferingTime = bufferingEvents.reduce((sum, e) => sum + (e.duration || 0), 0);
    const totalBufferingCount = bufferingEvents.length;
    const bufferingPercentage = totalSessionDuration > 0 
      ? parseFloat(((totalBufferingTime / totalSessionDuration) * 100).toFixed(2))
      : 0;

    const totalErrorCount = playbackErrors.length;
    const errorRate = totalSessionDuration > 0
      ? parseFloat(((totalErrorCount / totalSessionDuration) * 100).toFixed(2))
      : 0;

    // Calculate QoE Score
    const qualityDropPenalty = qualityChanges.length > 3 ? 10 : qualityChanges.length * 3;
    const qoeScore = Math.max(0, Math.round(
      100 - (bufferingPercentage * 0.5) - (errorRate * 1) - qualityDropPenalty
    ));

    // Update session
    const updatedSession = await QoESession.findOneAndUpdate(
      { sessionId },
      {
        endTime,
        totalSessionDuration,
        totalWatchDuration,
        completedPercentage,
        lastPlaybackPosition,
        bufferingEvents,
        totalBufferingTime,
        totalBufferingCount,
        bufferingPercentage,
        qualityChanges,
        totalQualityChanges: qualityChanges.length,
        playbackErrors,
        totalErrors: totalErrorCount,
        errorRate,
        finalQuality,
        qoeScore,
        status: completedPercentage >= 90 ? 'completed' : 'abandoned',
        updatedAt: new Date()
      },
      { new: true }
    );

    console.log(`✅ Session ended: ${sessionId}, QoE Score: ${qoeScore}`);

    res.json({
      success: true,
      data: updatedSession
    });

  } catch (error) {
    console.error('❌ Error ending session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ GET - Get session details
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await QoESession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      data: session
    });

  } catch (error) {
    console.error('❌ Error fetching session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ GET - Get video analytics
router.get('/video/:videoId/analytics', async (req, res) => {
  try {
    const { videoId } = req.params;

    const sessions = await QoESession.find({ 
      videoId,
      status: { $in: ['completed', 'abandoned'] }
    });

    if (sessions.length === 0) {
      return res.json({
        success: true,
        data: { message: 'No sessions found' }
      });
    }

    // Aggregate metrics
    const totalSessions = sessions.length;
    const avgWatchDuration = (sessions.reduce((sum, s) => sum + (s.totalWatchDuration || 0), 0) / totalSessions).toFixed(2);
    const avgCompletedPercentage = (sessions.reduce((sum, s) => sum + (s.completedPercentage || 0), 0) / totalSessions).toFixed(2);
    const avgBufferingPercentage = (sessions.reduce((sum, s) => sum + (s.bufferingPercentage || 0), 0) / totalSessions).toFixed(2);
    const avgErrorRate = (sessions.reduce((sum, s) => sum + (s.errorRate || 0), 0) / totalSessions).toFixed(2);
    const avgQoEScore = (sessions.reduce((sum, s) => sum + (s.qoeScore || 0), 0) / totalSessions).toFixed(2);

    // Device breakdown
    const deviceBreakdown = {};
    sessions.forEach(s => {
      deviceBreakdown[s.deviceType] = (deviceBreakdown[s.deviceType] || 0) + 1;
    });

    // Network breakdown
    const networkBreakdown = {};
    sessions.forEach(s => {
      networkBreakdown[s.networkType] = (networkBreakdown[s.networkType] || 0) + 1;
    });

    // Error breakdown
    const errorBreakdown = {};
    sessions.forEach(s => {
      s.playbackErrors.forEach(e => {
        errorBreakdown[e.code] = (errorBreakdown[e.code] || 0) + 1;
      });
    });

    const analytics = {
      videoId,
      totalSessions,
      completionRate: ((sessions.filter(s => s.status === 'completed').length / totalSessions) * 100).toFixed(2),
      avgWatchDuration,
      avgCompletedPercentage,
      avgBufferingPercentage,
      avgErrorRate,
      avgQoEScore,
      deviceBreakdown,
      networkBreakdown,
      errorBreakdown
    };

    console.log(`✅ Analytics generated for video ${videoId}:`, analytics);

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('❌ Error generating analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ GET - Get overall analytics
router.get('/analytics', async (req, res) => {
  try {
    const sessions = await QoESession.find({
      status: { $in: ['completed', 'abandoned'] }
    });

    if (sessions.length === 0) {
      return res.json({
        success: true,
        data: {
          totalEvents: 0,
          totalBufferingEvents: 0,
          bufferingPercentage: 0,
          totalErrors: 0,
          errorPercentage: 0,
          userCount: 0,
          videoCount: 0,
          totalQualityChanges: 0,
          deviceBreakdown: {},
          networkTypeBreakdown: {},
          topErrorCodes: {}
        }
      });
    }

    // Calculate totals
    const totalEvents = sessions.length;
    const totalBufferingEvents = sessions.reduce((sum, s) => sum + (s.totalBufferingCount || 0), 0);
    const totalBufferingTime = sessions.reduce((sum, s) => sum + (s.totalBufferingTime || 0), 0);
    const totalErrors = sessions.reduce((sum, s) => sum + (s.totalErrors || 0), 0);
    const totalQualityChanges = sessions.reduce((sum, s) => sum + (s.totalQualityChanges || 0), 0);

    // Calculate percentages
    const totalSessionDuration = sessions.reduce((sum, s) => sum + (s.totalSessionDuration || 0), 0);
    const bufferingPercentage = totalSessionDuration > 0 ? ((totalBufferingTime / totalSessionDuration) * 100).toFixed(2) : 0;
    const errorPercentage = totalSessionDuration > 0 ? ((totalErrors / totalSessionDuration) * 100).toFixed(2) : 0;

    // Unique users and videos
    const uniqueUsers = new Set(sessions.map(s => s.userId));
    const uniqueVideos = new Set(sessions.map(s => s.videoId));

    // Device breakdown
    const deviceBreakdown = {};
    sessions.forEach(s => {
      deviceBreakdown[s.deviceType] = (deviceBreakdown[s.deviceType] || 0) + 1;
    });

    // Network breakdown
    const networkBreakdown = {};
    sessions.forEach(s => {
      networkBreakdown[s.networkType] = (networkBreakdown[s.networkType] || 0) + 1;
    });

    // Error breakdown
    const errorBreakdown = {};
    sessions.forEach(s => {
      if (s.playbackErrors) {
        s.playbackErrors.forEach(e => {
          errorBreakdown[e.code] = (errorBreakdown[e.code] || 0) + 1;
        });
      }
    });

    const analytics = {
      totalEvents,
      totalBufferingEvents,
      bufferingPercentage: parseFloat(bufferingPercentage),
      totalErrors,
      errorPercentage: parseFloat(errorPercentage),
      userCount: uniqueUsers.size,
      videoCount: uniqueVideos.size,
      totalQualityChanges,
      deviceBreakdown,
      networkTypeBreakdown: networkBreakdown,
      topErrorCodes: errorBreakdown
    };

    console.log(`✅ Overall analytics generated:`, analytics);

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('❌ Error generating overall analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
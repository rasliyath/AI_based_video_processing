// pages/VideoPlayer.jsx
import React from 'react';
import QoETrackerDemo from '../components/qoe/QoETrackerDemo';

const VideoPlayerPage = () => {
  return (
    <div style={{ 
      width: '100%', 
      minHeight: '100vh',
      margin: 0,
      padding: 0,
      background: 'linear-gradient(to bottom right, #0f172a, #1e293b)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <QoETrackerDemo />
    </div>
  );
};

export default VideoPlayerPage;
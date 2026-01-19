// components/qoe/QoETrackerDemo.jsx - FULLY UPDATED WITH ERROR TRACKING
import React, { useEffect, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const QoETrackerDemo = () => {
  const playerRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState(
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  );
  const [videoId, setVideoId] = useState("dQw4w9WgXcQ");
  const [sessionId, setSessionId] = useState(null);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({
    bufferingCount: 0,
    errorCount: 0,
    qualityChanges: [],
    currentQuality: "unknown",
    totalWatchTime: 0,
    videoTime: 0,
    qoe: 100,
  });
  const [syncStatus, setSyncStatus] = useState("idle");
  const [dbEvents, setDbEvents] = useState(0);
  const [networkErrors, setNetworkErrors] = useState([]);
  const [offlineQueuedEvents, setOfflineQueuedEvents] = useState(0);

  // Sample users for selection
  const users = [
    { id: 'user_1', name: 'User 1' },
    { id: 'user_2', name: 'User 2' },
    { id: 'user_3', name: 'User 3' },
    { id: 'user_4', name: 'User 4' },
    { id: 'user_5', name: 'User 5' },
    { id: 'user_6', name: 'User 6' },
    { id: 'user_7', name: 'User 7' },
    { id: 'user_8', name: 'User 8' },
    { id: 'user_9', name: 'User 9' },
    { id: 'user_10', name: 'User 10' },
  ];

  const [selectedUserId, setSelectedUserId] = useState('user_1');

  // Tracking refs
  const eventCountRef = useRef({});
  const bufferingStartRef = useRef(null);
  const bufferingEventsRef = useRef([]);
  const qualityChangesRef = useRef([]);
  const errorsRef = useRef([]);
  const timerRef = useRef(null);
  const sessionStartTimeRef = useRef(null);
  const lastQualityRef = useRef(null);
  const isStartingSessionRef = useRef(false);
  const sessionIdRef = useRef(null);
  const videoIdRef = useRef("dQw4w9WgXcQ");
  const totalWatchTimeRef = useRef(0);

  const apiUrl = `${import.meta.env.VITE_API_BASE}/api/qoe`;

  // ============= OFFLINE EVENT QUEUE MANAGEMENT =============
  const storeEventOffline = async (sessionId, payload) => {
    try {
      const offlineEvents = JSON.parse(
        localStorage.getItem(`offline_events_${sessionId}`) || "[]"
      );
      offlineEvents.push({
        ...payload,
        queuedAt: new Date().toISOString(),
        status: "pending",
      });
      localStorage.setItem(
        `offline_events_${sessionId}`,
        JSON.stringify(offlineEvents)
      );
      console.log(`📦 Event queued offline: ${payload.eventType}`);
      setOfflineQueuedEvents((prev) => prev + 1);
    } catch (err) {
      console.error("❌ Failed to queue offline:", err);
    }
  };

  const syncOfflineEvents = async (sessionId) => {
    try {
      const offlineEvents = JSON.parse(
        localStorage.getItem(`offline_events_${sessionId}`) || "[]"
      );

      if (offlineEvents.length === 0) {
        console.log("✅ No offline events to sync");
        return;
      }

      console.log(`🔄 Syncing ${offlineEvents.length} offline events...`);

      let successCount = 0;
      const failedEvents = [];

      for (const event of offlineEvents) {
        try {
          const response = await fetch(
            `${apiUrl}/session/${sessionId}/event`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(event),
            }
          );

          if (response.ok) {
            successCount++;
            setDbEvents((prev) => prev + 1);
          } else {
            failedEvents.push(event);
          }
        } catch (err) {
          console.error("❌ Failed to sync event:", err);
          failedEvents.push(event);
        }
      }

      // Clear successfully synced events
      if (failedEvents.length === 0) {
        localStorage.removeItem(`offline_events_${sessionId}`);
        setOfflineQueuedEvents(0);
      } else {
        localStorage.setItem(
          `offline_events_${sessionId}`,
          JSON.stringify(failedEvents)
        );
        setOfflineQueuedEvents(failedEvents.length);
      }

      console.log(`✅ Synced ${successCount}/${offlineEvents.length} events`);

      addUIEvent({
        type: "syncComplete",
        label: `✅ SYNCED ${successCount} OFFLINE EVENTS`,
        color: "#10b981",
      });
    } catch (error) {
      console.error("❌ Sync error:", error);
    }
  };

  // ============= RECORD CRITICAL EVENTS WITH OFFLINE SUPPORT =============
  const recordCriticalEvent = async (eventType, eventData) => {
    if (!sessionIdRef.current) {
      console.warn("⚠️ No active session - event not recorded");
      return;
    }

    try {
      const payload = {
        userId: selectedUserId,
        videoId: videoIdRef.current,
        eventType: eventType,
        eventData: {
          ...eventData,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
        },
      };

      console.log(`📤 Recording ${eventType}:`, eventData);

      // ATTEMPT 1: Try immediate send
      try {
        const response = await fetch(
          `${apiUrl}/session/${sessionIdRef.current}/event`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );

        if (response.ok) {
          setDbEvents((prev) => prev + 1);
          console.log(`✅ Event sent: ${eventType}`);
          return; // Success
        }
      } catch (fetchError) {
        console.warn(
          `⚠️ Initial send failed for ${eventType}:`,
          fetchError.message
        );
      }

      // ATTEMPT 2: Store in offline queue if network is down
      console.log("🔄 Network may be down, queuing event for later...");
      await storeEventOffline(sessionIdRef.current, payload);
    } catch (error) {
      console.error(`❌ Failed to record ${eventType}:`, error);
    }
  };

  // ============= SESSION MANAGEMENT =============
  const startSession = async () => {
    if (sessionIdRef.current || isStartingSessionRef.current) {
      console.warn("⚠️ Session already exists or starting");
      return;
    }

    isStartingSessionRef.current = true;

    try {
      setSyncStatus("syncing");
      const newSessionId = `session_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      const payload = {
        sessionId: newSessionId,
        userId: selectedUserId,
        videoId: videoIdRef.current,
        videoTitle: "YouTube Video",
        deviceInfo: {
          type: navigator.userAgent.includes("Mobile") ? "mobile" : "desktop",
          os: getOS(),
          appVersion: getBrowserVersion(),
        },
        networkType: getNetworkType(),
        cdnEndpoint: await getCDNEndpoint(),
      };

      console.log("🎬 Starting Session:", {
        sessionId: newSessionId,
        ...payload,
      });

      const response = await fetch(`${apiUrl}/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        sessionIdRef.current = newSessionId;
        setSessionId(newSessionId);
        sessionStartTimeRef.current = Date.now();

        bufferingEventsRef.current = [];
        qualityChangesRef.current = [];
        errorsRef.current = [];
        lastQualityRef.current = null;

        console.log("✅ Session started:", newSessionId);
        setSyncStatus("success");
        setTimeout(() => setSyncStatus("idle"), 2000);

        // Sync any pending offline events
        syncOfflineEvents(newSessionId);
      } else {
        console.error("❌ Failed to start session:", response.status);
        setSessionId(null);
        setSyncStatus("error");
        setTimeout(() => setSyncStatus("idle"), 2000);
      }
    } catch (error) {
      console.error("❌ Session start error:", error);
      setSessionId(null);
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 2000);
    } finally {
      isStartingSessionRef.current = false;
    }
  };

  // ============= END SESSION AND CALCULATE METRICS =============
  const endSession = async (sessionIdToEnd) => {
    if (!sessionIdToEnd || !sessionStartTimeRef.current) {
      console.warn("⚠️ Cannot end session: missing sessionId or startTime");
      return;
    }

    try {
      setSyncStatus("syncing");

      const currentTime = window.player?.getCurrentTime() || 0;
      const videoDuration = window.player?.getDuration() || 1;
      const totalSessionDuration = Math.round(
        (Date.now() - sessionStartTimeRef.current) / 1000
      );
      const completedPercentage = Math.round(
        (currentTime / videoDuration) * 100
      );

      const payload = {
        totalWatchDuration: totalWatchTimeRef.current,
        completedPercentage: completedPercentage,
        lastPlaybackPosition: currentTime,
        bufferingEvents: bufferingEventsRef.current,
        qualityChanges: qualityChangesRef.current,
        playbackErrors: errorsRef.current,
        finalQuality: stats.currentQuality,
      };

      console.log("🏁 Ending Session:", {
        sessionId: sessionIdToEnd,
        ...payload,
      });

      const response = await fetch(
        `${apiUrl}/session/${sessionIdToEnd}/end`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Session ended with QoE Score:", data.data.qoeScore);
        console.log("📊 Recorded Errors:", data.data.recordedErrorCount);
        console.log("🚨 Recorded Crashes:", data.data.recordedCrashCount);
        setSyncStatus("success");
        setTimeout(() => setSyncStatus("idle"), 2000);

        // Clear session
        sessionIdRef.current = null;
        setSessionId(null);
        sessionStartTimeRef.current = null;
        bufferingStartRef.current = null;
        lastQualityRef.current = null;
      } else {
        console.error("❌ Failed to end session:", response.status);
        setSyncStatus("error");
        setTimeout(() => setSyncStatus("idle"), 2000);
      }
    } catch (error) {
      console.error("❌ Session end error:", error);
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 2000);
    }
  };

  // ============= UTILITY FUNCTIONS =============
  const extractVideoId = (url) => {
    try {
      let id = null;
      if (url.includes("youtube.com/watch")) {
        const urlParams = new URLSearchParams(new URL(url).search);
        id = urlParams.get("v");
      } else if (url.includes("youtu.be/")) {
        id = url.split("youtu.be/")[1].split("?")[0];
      } else if (url.includes("youtube.com/shorts/")) {
        id = url.split("youtube.com/shorts/")[1].split("?")[0];
      } else if (url.length === 11 && !url.includes("/")) {
        id = url;
      }
      return id;
    } catch (error) {
      console.error("❌ Invalid URL:", error);
      return null;
    }
  };

  const getOS = () => {
    if (navigator.userAgent.includes("Windows")) return "Windows";
    if (navigator.userAgent.includes("Mac")) return "MacOS";
    if (navigator.userAgent.includes("Linux")) return "Linux";
    if (navigator.userAgent.includes("Android")) return "Android";
    if (navigator.userAgent.includes("iPhone")) return "iOS";
    return "Unknown";
  };

  const getNetworkType = () => {
    if (navigator.connection) {
      const type = navigator.connection.effectiveType;
      if (type === "4g") return "4g";
      if (type === "5g") return "5g";
      if (type === "3g" || type === "2g") return "3g";
    }
    return navigator.onLine ? "wifi" : "unknown";
  };

  const getBrowserVersion = () => {
    const ua = navigator.userAgent;
    let version = "Unknown";
    if (ua.includes("Chrome")) {
      const match = ua.match(/Chrome\/(\d+)/);
      version = match ? `Chrome ${match[1]}` : "Chrome";
    } else if (ua.includes("Firefox")) {
      const match = ua.match(/Firefox\/(\d+)/);
      version = match ? `Firefox ${match[1]}` : "Firefox";
    } else if (ua.includes("Safari") && !ua.includes("Chrome")) {
      const match = ua.match(/Version\/(\d+)/);
      version = match ? `Safari ${match[1]}` : "Safari";
    } else if (ua.includes("Edge")) {
      const match = ua.match(/Edge\/(\d+)/);
      version = match ? `Edge ${match[1]}` : "Edge";
    }
    return version;
  };

  const captureYouTubeCDN = async (videoId) => {
    console.log("📡 Capturing YouTube CDN info...");
    try {
      const cdnInfo = {
        primary: "googleapis.com/youtubei",
        fallback: null,
        detectedHostname: null,
        detectionMethod: "performance_api",
        timestamp: new Date().toISOString(),
      };

      const resources = performance.getEntriesByType("resource");

      resources.forEach((resource) => {
        const name = resource.name.toLowerCase();
        if (
          name.includes("googlevideo") ||
          (name.includes("youtube") && name.includes("googleapis"))
        ) {
          try {
            const hostname = new URL(resource.name).hostname;
            cdnInfo.detectedHostname = hostname;
            cdnInfo.detectionMethod = "performance_api";
          } catch (e) {}
        }
      });

      if (!cdnInfo.detectedHostname) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const updatedResources = performance.getEntriesByType("resource");
        updatedResources.forEach((resource) => {
          const name = resource.name.toLowerCase();
          if (
            name.includes("googlevideo") ||
            (name.includes("youtube") && name.includes("googleapis"))
          ) {
            try {
              const hostname = new URL(resource.name).hostname;
              cdnInfo.detectedHostname = hostname;
            } catch (e) {}
          }
        });
      }

      return cdnInfo;
    } catch (error) {
      console.error("❌ CDN capture error:", error);
      return {
        primary: "googleapis.com/youtubei",
        fallback: null,
        detectedHostname: null,
        detectionMethod: "error",
        error: error.message,
      };
    }
  };

  const getCDNEndpoint = async () => {
    const cdnInfo = await captureYouTubeCDN(videoIdRef.current);
    return cdnInfo;
  };

  const handleLoadVideo = () => {
    const extractedId = extractVideoId(videoUrl);
    if (extractedId) {
      videoIdRef.current = extractedId;
      setVideoId(extractedId);
      setSessionId(null);
      setEvents([]);
      setStats({
        bufferingCount: 0,
        errorCount: 0,
        qualityChanges: [],
        currentQuality: "unknown",
        totalWatchTime: 0,
        videoTime: 0,
        qoe: 100,
      });
      eventCountRef.current = {};
      setDbEvents(0);
      setOfflineQueuedEvents(0);
      sessionIdRef.current = null;
      sessionStartTimeRef.current = null;
      setSessionId(null);
      isStartingSessionRef.current = false;
      totalWatchTimeRef.current = 0;

      console.log("🎬 Loading Video:", { videoId: extractedId, url: videoUrl });

      if (window.YT && window.YT.Player) {
        initPlayer(extractedId);
      } else {
        const checkAPI = () => {
          if (window.YT && window.YT.Player) {
            initPlayer(extractedId);
          } else {
            setTimeout(checkAPI, 100);
          }
        };
        checkAPI();
      }
    } else {
      alert("❌ Invalid YouTube URL or Video ID. Please check and try again.");
    }
  };

  // ============= YOUTUBE PLAYER SETUP =============
  useEffect(() => {
    if (window.YT) {
      initPlayer(videoId);
    } else {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = () => initPlayer(videoId);
    }

    // Global crash tracking
    const handleError = (message, source, lineno, colno, error) => {
      console.error("🚨 App Crash Detected:", {
        message,
        source,
        lineno,
        colno,
        error,
      });

      let errorType = "javascript_error";
      if (message && String(message).toLowerCase().includes("invalid video id")) {
        errorType = "invalid_video_id";
      } else if (message && String(message).includes("ERR_INTERNET_DISCONNECTED")) {
        errorType = "network_error";
      } else if (message && String(message).includes("cross-origin")) {
        errorType = "cross_origin_error";
      }

      const videoTime = Math.floor(window.player?.getCurrentTime() || 0);

      errorsRef.current.push({
        code: errorType,
        message: String(message),
        timestamp: new Date().toISOString(),
        atVideoTime: videoTime,
        severity: "critical",
        source,
        lineno,
        colno,
      });

      recordCriticalEvent("crash", {
        type: errorType,
        message: String(message),
        source,
        lineno,
        colno,
        stack: error?.stack,
        userAgent: navigator.userAgent,
        severity: "critical",
      });

      setStats((prev) => ({
        ...prev,
        errorCount: prev.errorCount + 1,
      }));

      addUIEvent({
        type: "crash",
        label: `🚨 CRASH: ${errorType}`,
        color: "#991b1b",
      });
    };

    // Network status tracking
    const handleOnline = () => {
      console.log("🌐 Network restored");
      recordCriticalEvent("network_recovery", {
        previousErrors: networkErrors.length,
        timestamp: new Date().toISOString(),
      });

      if (sessionIdRef.current) {
        syncOfflineEvents(sessionIdRef.current);
      }

      setNetworkErrors([]);

      addUIEvent({
        type: "networkRecovery",
        label: "🌐 NETWORK RESTORED",
        color: "#10b981",
      });
    };

    const handleOffline = () => {
      console.warn("🌐 Network offline detected");
      const currentTime = Math.floor(window.player?.getCurrentTime() || 0);

      errorsRef.current.push({
        code: "NETWORK_OFFLINE",
        message: "Network connection lost during playback",
        timestamp: new Date().toISOString(),
        atVideoTime: currentTime,
        severity: "critical",
      });

      recordCriticalEvent("network_error", {
        type: "offline",
        videoTime: currentTime,
        severity: "critical",
        timestamp: new Date().toISOString(),
      });

      setNetworkErrors((prev) => [
        ...prev,
        {
          type: "offline",
          timestamp: new Date().toISOString(),
          videoTime: currentTime,
        },
      ]);

      setStats((prev) => ({
        ...prev,
        errorCount: prev.errorCount + 1,
      }));

      addUIEvent({
        type: "networkError",
        label: "🌐 NETWORK OFFLINE",
        color: "#dc2626",
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener("error", handleError);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [networkErrors]);

  const initPlayer = (id = videoId) => {
    if (playerRef.current && window.YT) {
      try {
        if (window.player && typeof window.player.destroy === "function") {
          window.player.destroy();
        }

        window.player = new window.YT.Player(playerRef.current, {
          height: "500",
          width: "100%",
          videoId: id,
          playerVars: {
            autoplay: 0,
            controls: 1,
            modestbranding: 0,
            rel: 0,
          },
          events: {
            onReady: handlePlayerReady,
            onStateChange: handleStateChange,
            onPlaybackQualityChange: handleQualityChange,
            onError: handlePlayerError,
            onPlaybackRateChange: handleRateChange,
          },
        });

        setTimeout(() => {
          if (window.player && window.player.getPlayerState() === -1) {
            console.error("🎮 Video failed to load - possibly invalid ID");
            errorsRef.current.push({
              code: "LOADING_FAILED",
              message: "Video failed to load - possibly invalid ID",
              timestamp: new Date().toISOString(),
              atVideoTime: 0,
            });

            recordCriticalEvent("loading_error", {
              type: "invalid_video_id",
              videoId: id,
              error: "Video failed to load - possibly invalid ID",
              severity: "critical",
            });

            setStats((prev) => ({
              ...prev,
              errorCount: prev.errorCount + 1,
            }));

            addUIEvent({
              type: "loadingError",
              label: "❌ VIDEO LOAD FAILED",
              color: "#dc2626",
            });
          }
        }, 3000);
      } catch (error) {
        console.error("🎮 Player initialization error:", error);
        errorsRef.current.push({
          code: "INIT_FAILED",
          message: `Player initialization failed: ${error.message}`,
          timestamp: new Date().toISOString(),
          atVideoTime: 0,
        });

        recordCriticalEvent("initialization_error", {
          error: error.message,
          videoId: id,
          severity: "critical",
        });

        setStats((prev) => ({
          ...prev,
          errorCount: prev.errorCount + 1,
        }));

        addUIEvent({
          type: "initError",
          label: "❌ PLAYER INIT FAILED",
          color: "#dc2626",
        });
      }
    }
  };

  const handlePlayerReady = () => {
    console.log("🎮 YouTube Event: PLAYER READY");
    addUIEvent({
      type: "ready",
      label: "✓ Player Ready",
      color: "#10b981",
    });
  };

  const handleStateChange = (event) => {
    const stateMap = {
      [-1]: "UNSTARTED",
      [0]: "ENDED",
      [1]: "PLAYING",
      [2]: "PAUSED",
      [3]: "BUFFERING",
      [5]: "CUED",
    };

    const state = stateMap[event.data];
    console.log("🎮 YouTube Event: STATE CHANGE", {
      state,
      rawState: event.data,
    });

    if (event.data === 3) {
      // BUFFERING START
      console.warn("⚠️ BUFFERING DETECTED");
      bufferingStartRef.current = Date.now();
      setStats((prev) => ({
        ...prev,
        bufferingCount: prev.bufferingCount + 1,
      }));
      addUIEvent({
        type: "stateChange",
        label: "⏳ BUFFERING STARTED",
        color: "#ef4444",
      });
    } else if (event.data === 1) {
      // PLAYING
      if (bufferingStartRef.current) {
        const duration = (Date.now() - bufferingStartRef.current) / 1000;
        console.log(`⏱️ Buffering Duration: ${duration.toFixed(2)}s`);

        bufferingEventsRef.current.push({
          startTime: Math.floor(window.player.getCurrentTime()),
          endTime: Math.floor(window.player.getCurrentTime()),
          duration: Number(duration.toFixed(2)),
          quality: stats.currentQuality,
          timestamp: new Date().toISOString(),
        });

        recordCriticalEvent("buffering_end", {
          duration: Number(duration.toFixed(2)),
          quality: stats.currentQuality,
          videoTime: Math.floor(window.player.getCurrentTime()),
        });

        bufferingStartRef.current = null;
      }

      addUIEvent({
        type: "stateChange",
        label: "▶️ PLAYING",
        color: "#10b981",
      });

      if (!sessionIdRef.current && !isStartingSessionRef.current) {
        console.log("🎯 First PLAY detected → starting session");
        startSession();
      }

      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          if (window.player && window.player.getPlayerState() === 1) {
            totalWatchTimeRef.current += 1;
            setStats((prev) => ({
              ...prev,
              totalWatchTime: totalWatchTimeRef.current,
              videoTime: Math.floor(window.player.getCurrentTime()),
            }));
          }
        }, 1000);
      }
    } else if (event.data === 2) {
      // PAUSED
      console.log("⏸️ Video paused");
      addUIEvent({
        type: "stateChange",
        label: "⏸️ PAUSED",
        color: "#f59e0b",
      });

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } else if (event.data === 0) {
      // ENDED
      console.log("⏹️ Video ended");
      addUIEvent({
        type: "stateChange",
        label: "⏹️ VIDEO ENDED",
        color: "#8b5cf6",
      });

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const activeSessionId = sessionIdRef.current;

      if (activeSessionId) {
        console.log("🏁 Ending session:", activeSessionId);
        endSession(activeSessionId);
      } else {
        console.warn("⚠️ No active session to end");
      }
    }

    updateQoEScore();
  };

  const handleQualityChange = (event) => {
    const quality = event.data;
    console.log("🎮 YouTube Event: QUALITY CHANGE", {
      quality,
      currentQuality: stats.currentQuality,
    });

    if (lastQualityRef.current) {
      qualityChangesRef.current.push({
        timestamp: new Date().toISOString(),
        fromQuality: lastQualityRef.current,
        toQuality: quality,
        atVideoTime: Math.floor(window.player.getCurrentTime()),
      });

      recordCriticalEvent("quality_change", {
        fromQuality: lastQualityRef.current,
        toQuality: quality,
        videoTime: Math.floor(window.player.getCurrentTime()),
      });
    }

    lastQualityRef.current = quality;

    setStats((prev) => ({
      ...prev,
      qualityChanges: [...prev.qualityChanges, quality],
      currentQuality: quality,
    }));

    addUIEvent({
      type: "qualityChange",
      label: `📺 Quality Changed: ${quality}`,
      color: "#3b82f6",
    });
  };

  const handlePlayerError = (event) => {
    const errorMap = {
      2: "Invalid Parameter",
      5: "HTML5 Player Error",
      100: "Video Not Found",
      101: "Video Not Embeddable",
      150: "Video Not Embeddable",
    };

    const errorMsg = errorMap[event.data] || `Unknown Error (${event.data})`;
    const videoTime = Math.floor(window.player?.getCurrentTime() || 0);

    console.error("🎮 YouTube Event: ERROR", {
      errorCode: event.data,
      errorMessage: errorMsg,
      videoTime,
    });

    const errorObject = {
      code: String(event.data),
      message: errorMsg,
      timestamp: new Date().toISOString(),
      atVideoTime: videoTime,
      severity: "critical",
      type: "youtube_player_error",
    };

    errorsRef.current.push(errorObject);

    recordCriticalEvent("playback_error", {
      errorCode: String(event.data),
      errorMessage: errorMsg,
      videoTime: videoTime,
      severity: "critical",
    });

    setStats((prev) => ({
      ...prev,
      errorCount: prev.errorCount + 1,
    }));

    addUIEvent({
      type: "error",
      label: `❌ Error ${event.data}: ${errorMsg}`,
      color: "#ef4444",
    });

    updateQoEScore();
  };

  const handleRateChange = (event) => {
    console.log("🎮 YouTube Event: PLAYBACK RATE CHANGE", { rate: event.data });
    addUIEvent({
      type: "rateChange",
      label: `⚡ Playback Speed: ${event.data}x`,
      color: "#8b5cf6",
    });
  };

  // ============= UI HELPERS =============
  const addUIEvent = (eventData) => {
    const timestamp = new Date().toLocaleTimeString();
    const fullEvent = { ...eventData, timestamp };
    setEvents((prev) => [fullEvent, ...prev].slice(0, 100));
    eventCountRef.current[eventData.type] =
      (eventCountRef.current[eventData.type] || 0) + 1;
  };

  const updateQoEScore = () => {
    const score = Math.max(
      0,
      100 - stats.bufferingCount * 8 - stats.errorCount * 15
    );
    setStats((prev) => ({
      ...prev,
      qoe: Math.round(score),
    }));
  };

  const resetStats = () => {
    console.log("🔄 Resetting all statistics");
    setEvents([]);
    setStats({
      bufferingCount: 0,
      errorCount: 0,
      qualityChanges: [],
      currentQuality: "unknown",
      totalWatchTime: 0,
      videoTime: 0,
      qoe: 100,
    });
    eventCountRef.current = {};
    setSessionId(null);
    setDbEvents(0);
    setOfflineQueuedEvents(0);
    setNetworkErrors([]);
    isStartingSessionRef.current = false;
    sessionIdRef.current = null;
    videoIdRef.current = "dQw4w9WgXcQ";
    totalWatchTimeRef.current = 0;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // ============= FETCH DATA FROM DATABASE =============
  const fetchSessionDetails = async () => {
    if (!sessionId) {
      alert("❌ No active session. Start by playing a video.");
      return;
    }

    try {
      setSyncStatus("syncing");
      console.log("📥 Fetching session details from database...");

      const response = await fetch(`${apiUrl}/session/${sessionId}`);
      const data = await response.json();

      console.log("📊 Session Details:", data);
      console.log("📋 Recorded Errors:", data.data.recordedErrors);
      console.log("🚨 Recorded Crashes:", data.data.recordedCrashes);
      setSyncStatus("success");
      setTimeout(() => setSyncStatus("idle"), 2000);

      addUIEvent({
        type: "fetchSession",
        label: "📥 SESSION DETAILS FETCHED",
        color: "#3b82f6",
      });
    } catch (error) {
      console.error("❌ Failed to fetch session:", error);
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 2000);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setSyncStatus("syncing");
      console.log("📊 Fetching analytics from database...");

      const response = await fetch(`${apiUrl}/analytics`);
      const data = await response.json();

      console.log("📈 Video Analytics:", data);
      console.log("🔴 Recorded Errors:", data.data.recordedErrors);
      console.log("🚨 Recorded Crashes:", data.data.recordedCrashes);
      console.log("📊 Error Types:", data.data.topErrorTypes);
      setSyncStatus("success");
      setTimeout(() => setSyncStatus("idle"), 2000);

      addUIEvent({
        type: "fetchAnalytics",
        label: "📊 ANALYTICS FETCHED",
        color: "#10b981",
      });
    } catch (error) {
      console.error("❌ Failed to fetch analytics:", error);
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 2000);
    }
  };

  // ============= RENDER LOGIC =============
  const eventCountData = Object.entries(eventCountRef.current).map(
    ([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value,
    })
  );

  const qualityCounts = {};
  stats.qualityChanges.forEach((q) => {
    qualityCounts[q] = (qualityCounts[q] || 0) + 1;
  });

  const qualityData = Object.entries(qualityCounts).map(([quality, count]) => ({
    name: quality || "Unknown",
    value: count,
  }));

  const getQoEColor = () => {
    if (stats.qoe >= 85)
      return {
        background: "linear-gradient(135deg, #16a34a, #15803d)",
        border: "2px solid #22c55e",
      };
    if (stats.qoe >= 70)
      return {
        background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
        border: "2px solid #3b82f6",
      };
    if (stats.qoe >= 50)
      return {
        background: "linear-gradient(135deg, #eab308, #ca8a04)",
        border: "2px solid #facc15",
      };
    if (stats.qoe >= 30)
      return {
        background: "linear-gradient(135deg, #ea580c, #c2410c)",
        border: "2px solid #fb923c",
      };
    return {
      background: "linear-gradient(135deg, #dc2626, #991b1b)",
      border: "2px solid #ef4444",
    };
  };

  const getQoERating = () => {
    if (stats.qoe >= 85) return "Excellent 🌟";
    if (stats.qoe >= 70) return "Very Good ✅";
    if (stats.qoe >= 50) return "Good 👍";
    if (stats.qoe >= 30) return "Fair ⚠️";
    return "Poor 😞";
  };

  const colors = [
    "#3b82f6",
    "#ef4444",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#06b6d4",
    "#ec4899",
  ];

  const mainStyle = {
    width: "100%",
    minHeight: "100vh",
    background: "linear-gradient(to bottom right, #0f172a, #1e293b)",
    padding: "24px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#fff",
  };

  const containerStyle = {
    maxWidth: "1280px",
    margin: "0 auto",
  };

  const titleStyle = {
    fontSize: "32px",
    fontWeight: "bold",
    color: "#fff",
    marginBottom: "8px",
  };

  const inputSectionStyle = {
    background: "#475569",
    padding: "24px",
    borderRadius: "8px",
    marginBottom: "32px",
    border: "2px solid #3b82f6",
  };

  const buttonStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    background: "#2563eb",
    color: "#fff",
    padding: "12px 24px",
    borderRadius: "6px",
    fontWeight: "600",
    cursor: "pointer",
    border: "none",
    fontSize: "14px",
    whiteSpace: "nowrap",
  };

  const inputStyle = {
    flex: 1,
    padding: "12px 16px",
    background: "#334155",
    border: "1px solid #475569",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "14px",
  };

  return (
    <div style={mainStyle}>
      <div style={containerStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <h1 style={titleStyle}>🎬 YouTube QoE Tracker (Session-Based)</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ color: "#94a3b8", fontSize: "14px" }}>
              User:
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              style={{
                padding: "8px 12px",
                background: "#334155",
                border: "1px solid #475569",
                borderRadius: "6px",
                color: "#fff",
                fontSize: "14px",
              }}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p style={{ color: "#94a3b8", marginBottom: "8px" }}>
          Real-time Quality of Experience - Session Tracking with Error Detection
        </p>

        {/* Database Sync Status */}
        <div
          style={{
            background:
              syncStatus === "success"
                ? "#065f46"
                : syncStatus === "error"
                ? "#7f1d1d"
                : "transparent",
            border: `2px solid ${
              syncStatus === "success"
                ? "#10b981"
                : syncStatus === "error"
                ? "#ef4444"
                : "transparent"
            }`,
            padding: "8px 12px",
            borderRadius: "6px",
            marginBottom: "12px",
            fontSize: "12px",
            display: syncStatus !== "idle" ? "block" : "none",
          }}
        >
          {syncStatus === "syncing" && "⏳ Syncing..."}
          {syncStatus === "success" &&
            `✅ Synced! (Session: ${sessionId?.substr(0, 20)}...)`}
          {syncStatus === "error" && "❌ Sync failed - Check console"}
        </div>

        {/* Offline Queue Status */}
        {offlineQueuedEvents > 0 && (
          <div
            style={{
              background: "#7c2d12",
              border: "2px solid #ea580c",
              padding: "8px 12px",
              borderRadius: "6px",
              marginBottom: "12px",
              fontSize: "12px",
            }}
          >
            📦 {offlineQueuedEvents} event(s) queued offline - waiting to sync...
          </div>
        )}

        {/* URL Input */}
        <div style={inputSectionStyle}>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              marginBottom: "16px",
            }}
          >
            Load YouTube Video
          </h2>
          <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Enter YouTube URL or Video ID"
              style={inputStyle}
            />
            <button onClick={handleLoadVideo} style={buttonStyle}>
              Load Video
            </button>
          </div>
          <p style={{ color: "#94a3b8", fontSize: "12px" }}>
            Supports: Full URLs, Short URLs (youtu.be), Shorts, or Video IDs
          </p>
          {sessionId && (
            <p style={{ color: "#10b981", fontSize: "11px", marginTop: "8px" }}>
              ✅ Session Active: {sessionId.substr(0, 30)}...
            </p>
          )}
        </div>

        {/* Main Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: "24px",
            marginBottom: "32px",
          }}
        >
          <div>
            <div
              style={{
                background: "#000",
                borderRadius: "8px",
                overflow: "hidden",
                marginBottom: "24px",
                minHeight: "400px",
              }}
            >
              <div ref={playerRef} style={{ width: "100%" }}></div>
            </div>

            {videoId && (
              <div style={inputSectionStyle}>
                <p>
                  <strong>Video ID:</strong>{" "}
                  <code style={{ background: "#1e293b", padding: "4px 8px" }}>
                    {videoId}
                  </code>
                </p>
                <p>
                  <strong>Current Time:</strong> {Math.floor(stats.videoTime)}s
                </p>
                <p>
                  <strong>Total Watch Time:</strong> {stats.totalWatchTime}s
                </p>
                <p
                  style={{
                    color: "#10b981",
                    fontSize: "12px",
                    marginTop: "8px",
                  }}
                >
                  ✅ Events Recorded: {dbEvents}
                </p>
                {offlineQueuedEvents > 0 && (
                  <p
                    style={{
                      color: "#ea580c",
                      fontSize: "12px",
                      marginTop: "4px",
                    }}
                  >
                    📦 Offline Queue: {offlineQueuedEvents}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* QoE Score */}
          <div
            style={{
              ...getQoEColor(),
              padding: "32px",
              borderRadius: "8px",
              height: "fit-content",
              position: "sticky",
              top: "24px",
            }}
          >
            <h2
              style={{
                fontSize: "18px",
                fontWeight: "600",
                marginBottom: "8px",
              }}
            >
              Quality Score
            </h2>
            <div
              style={{
                fontSize: "48px",
                fontWeight: "bold",
                marginBottom: "8px",
              }}
            >
              {stats.qoe}
            </div>
            <div
              style={{
                fontSize: "12px",
                opacity: 0.8,
                marginBottom: "24px",
              }}
            >
              /100
            </div>

            <div
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                padding: "12px",
                background: "rgba(0,0,0,0.3)",
                borderRadius: "6px",
                marginBottom: "24px",
              }}
            >
              {getQoERating()}
            </div>

            <div
              style={{
                fontSize: "14px",
                opacity: 0.95,
                borderTop: "1px solid rgba(255,255,255,0.2)",
                paddingTop: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <span>🔴 Buffering:</span>
                <span style={{ fontWeight: "bold", fontSize: "18px" }}>
                  {stats.bufferingCount}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <span>❌ Errors:</span>
                <span style={{ fontWeight: "bold", fontSize: "18px" }}>
                  {stats.errorCount}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "12px",
                }}
              >
                <span>📺 Quality Changes:</span>
                <span style={{ fontWeight: "bold", fontSize: "18px" }}>
                  {stats.qualityChanges.length}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderTop: "1px solid rgba(255,255,255,0.2)",
                  paddingTop: "12px",
                  marginTop: "12px",
                }}
              >
                <span>Current:</span>
                <span style={{ fontWeight: "bold" }}>
                  {stats.currentQuality || "Auto"}
                </span>
              </div>
            </div>

            <button
              onClick={resetStats}
              style={{
                width: "100%",
                marginTop: "24px",
                background: "#475569",
                color: "#fff",
                padding: "12px",
                borderRadius: "6px",
                fontWeight: "600",
                fontSize: "12px",
                border: "none",
                cursor: "pointer",
                marginBottom: "8px",
              }}
            >
              Reset Stats
            </button>

            <button
              onClick={fetchSessionDetails}
              style={{
                width: "100%",
                background: "#10b981",
                color: "#fff",
                padding: "12px",
                borderRadius: "6px",
                fontWeight: "600",
                fontSize: "12px",
                border: "none",
                cursor: "pointer",
                marginBottom: "8px",
              }}
            >
              📥 Session Details
            </button>

            <button
              onClick={fetchAnalytics}
              style={{
                width: "100%",
                background: "#3b82f6",
                color: "#fff",
                padding: "12px",
                borderRadius: "6px",
                fontWeight: "600",
                fontSize: "12px",
                border: "none",
                cursor: "pointer",
              }}
            >
              📊 Analytics
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #7f1d1d, #991b1b)",
              borderRadius: "8px",
              padding: "16px",
              borderLeft: "4px solid #dc2626",
            }}
          >
            <p
              style={{
                color: "#fca5a5",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              Buffering Events
            </p>
            <p style={{ fontSize: "24px", fontWeight: "bold", color: "#fff" }}>
              {stats.bufferingCount}
            </p>
          </div>
          <div
            style={{
              background: "linear-gradient(135deg, #7c2d12, #92400e)",
              borderRadius: "8px",
              padding: "16px",
              borderLeft: "4px solid #ea580c",
            }}
          >
            <p
              style={{
                color: "#fed7aa",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              Playback Errors
            </p>
            <p style={{ fontSize: "24px", fontWeight: "bold", color: "#fff" }}>
              {stats.errorCount}
            </p>
          </div>
          <div
            style={{
              background: "linear-gradient(135deg, #1e3a8a, #1e40af)",
              borderRadius: "8px",
              padding: "16px",
              borderLeft: "4px solid #3b82f6",
            }}
          >
            <p
              style={{
                color: "#93c5fd",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              Quality Changes
            </p>
            <p style={{ fontSize: "24px", fontWeight: "bold", color: "#fff" }}>
              {stats.qualityChanges.length}
            </p>
          </div>
          <div
            style={{
              background: "linear-gradient(135deg, #15803d, #166534)",
              borderRadius: "8px",
              padding: "16px",
              borderLeft: "4px solid #22c55e",
            }}
          >
            <p
              style={{
                color: "#86efac",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              Watch Duration
            </p>
            <p style={{ fontSize: "24px", fontWeight: "bold", color: "#fff" }}>
              {stats.totalWatchTime}s
            </p>
          </div>
        </div>

        {/* Charts */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "32px",
            marginBottom: "32px",
          }}
        >
          <div style={inputSectionStyle}>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                marginBottom: "16px",
              }}
            >
              📊 Event Distribution
            </h2>
            {eventCountData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={eventCountData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      color: "#fff",
                    }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p
                style={{
                  color: "#94a3b8",
                  textAlign: "center",
                  padding: "48px 0",
                }}
              >
                Play video to see events...
              </p>
            )}
          </div>

          {qualityData.length > 0 && (
            <div style={inputSectionStyle}>
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  marginBottom: "16px",
                }}
              >
                📺 Quality Breakdown
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={qualityData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {qualityData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={colors[index % colors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      color: "#fff",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Event Log */}
        <div style={inputSectionStyle}>
          <h2
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              marginBottom: "16px",
            }}
          >
            📝 Real-Time Event Log
          </h2>
          <div
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              background: "#1e293b",
              padding: "16px",
              borderRadius: "6px",
            }}
          >
            {events.length === 0 ? (
              <p
                style={{
                  color: "#94a3b8",
                  textAlign: "center",
                  padding: "32px 0",
                }}
              >
                Events will appear here as you play the video...
              </p>
            ) : (
              events.map((event, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "#334155",
                    padding: "12px",
                    borderRadius: "6px",
                    marginBottom: "8px",
                    borderLeft: `4px solid ${event.color || "#3b82f6"}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: "600", color: "#fff" }}>
                      {event.label}
                    </span>
                    <span style={{ color: "#94a3b8", fontSize: "11px" }}>
                      {event.timestamp}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Instructions */}
        <div
          style={{
            background: "#1e3a8a",
            border: "2px solid #3b82f6",
            padding: "24px",
            borderRadius: "8px",
            marginTop: "32px",
          }}
        >
          <h3
            style={{
              color: "#fff",
              fontWeight: "bold",
              marginBottom: "12px",
            }}
          >
            📋 Session-Based Tracking Guide with Error Detection:
          </h3>
          <ol
            style={{
              color: "#dbeafe",
              fontSize: "12px",
              listStylePosition: "inside",
              lineHeight: 1.8,
            }}
          >
            <li>
              <strong>Open Browser Console:</strong> Press F12 → Console tab
            </li>
            <li>
              <strong>Load Video:</strong> Paste YouTube URL and click "Load
              Video"
            </li>
            <li>
              <strong>Play Video:</strong> Session automatically starts when you
              play
            </li>
            <li>
              <strong>Error Tracking:</strong> ALL errors are now captured
              (network, crashes, loading)
            </li>
            <li>
              <strong>Watch Console:</strong> See real-time event logs with
              session ID and offline queue status
            </li>
            <li>
              <strong>Offline Support:</strong> Events queue locally and sync
              when network returns
            </li>
            <li>
              <strong>End Session:</strong> Automatically ends when video
              finishes
            </li>
            <li>
              <strong>View Details:</strong> Click "Session Details" to see all
              recorded errors
            </li>
            <li>
              <strong>View Analytics:</strong> Click "Analytics" to see error
              types and counts
            </li>
          </ol>

          <div
            style={{
              background: "rgba(0,0,0,0.2)",
              padding: "12px",
              borderRadius: "6px",
              marginTop: "12px",
              fontSize: "11px",
            }}
          >
            <strong>✅ Error Tracking Features:</strong>
            <div style={{ marginTop: "8px", color: "#93c5fd" }}>
              ✅ Network offline detection + offline queue<br />
              ✅ Invalid video ID error capture<br />
              ✅ JavaScript crash detection<br />
              ✅ YouTube player error handling<br />
              ✅ Automatic sync when network returns<br />
              ✅ All errors visible in Session Details & Analytics
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QoETrackerDemo;
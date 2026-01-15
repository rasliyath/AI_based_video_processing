// ==================== QoE CMS Dashboard ====================
// components/QoEDashboard.jsx

import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, AlertTriangle, Zap, Download, RefreshCw } from 'lucide-react';

const QoEDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedVideo, setSelectedVideo] = useState('all');
  const API_BASE_URL =  import.meta.env.VITE_API_BASE || ''

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateRange.start) params.append('startDate', dateRange.start);
      if (dateRange.end) params.append('endDate', dateRange.end);

      const response = await fetch(`${API_BASE_URL}/api/qoe/analytics?${params}`);
      const result = await response.json();

      if (result.success) {
        setDashboardData(result.data);
      } else {
        setError('Failed to fetch dashboard data');
      }
    } catch (err) {
      setError('Error connecting to API: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleExport = () => {
    const dataStr = JSON.stringify(dashboardData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qoe-report-${new Date().toISOString()}.json`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-white text-lg">Loading Dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-red-400 text-lg">{error}</div>
      </div>
    );
  }

  if (!dashboardData) return null;

  // Prepare chart data
  const deviceData = Object.entries(dashboardData.deviceBreakdown || {}).map(([device, count]) => ({
    name: device.charAt(0).toUpperCase() + device.slice(1),
    value: count
  }));

  const networkData = Object.entries(dashboardData.networkTypeBreakdown || {}).map(([network, count]) => ({
    name: network.toUpperCase(),
    value: count
  }));

  const errorData = Object.entries(dashboardData.topErrorCodes || {}).map(([code, count]) => ({
    name: `Error ${code}`,
    value: count
  }));

  const timelineData = [
    { time: '00:00', events: Math.floor(dashboardData.totalEvents * 0.05) },
    { time: '06:00', events: Math.floor(dashboardData.totalEvents * 0.12) },
    { time: '12:00', events: Math.floor(dashboardData.totalEvents * 0.25) },
    { time: '18:00', events: Math.floor(dashboardData.totalEvents * 0.35) },
    { time: '23:59', events: Math.floor(dashboardData.totalEvents * 0.23) }
  ];

  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">QoE Analytics Dashboard</h1>
            <p className="text-slate-400">Video platform quality monitoring</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={fetchDashboardData}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              <RefreshCw size={18} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
            >
              <Download size={18} />
              Export
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-700 p-4 rounded-lg mb-8 flex gap-4">
          <div className="flex-1">
            <label className="block text-sm text-slate-300 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-slate-300 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
            />
          </div>
          <button
            onClick={fetchDashboardData}
            className="self-end bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded"
          >
            Apply
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-700 p-6 rounded-lg border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Events</p>
                <p className="text-3xl font-bold text-white">{dashboardData.totalEvents.toLocaleString()}</p>
              </div>
              <Zap className="text-blue-400" size={40} />
            </div>
          </div>

          <div className="bg-slate-700 p-6 rounded-lg border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Buffering Events</p>
                <p className="text-3xl font-bold text-white">{dashboardData.totalBufferingEvents}</p>
                <p className="text-xs text-slate-400 mt-1">{dashboardData.bufferingPercentage}% of total</p>
              </div>
              <AlertTriangle className="text-red-400" size={40} />
            </div>
          </div>

          <div className="bg-slate-700 p-6 rounded-lg border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Playback Errors</p>
                <p className="text-3xl font-bold text-white">{dashboardData.totalErrors}</p>
                <p className="text-xs text-slate-400 mt-1">{dashboardData.errorPercentage}% of total</p>
              </div>
              <AlertTriangle className="text-orange-400" size={40} />
            </div>
          </div>

          <div className="bg-slate-700 p-6 rounded-lg border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Unique Users</p>
                <p className="text-3xl font-bold text-white">{dashboardData.userCount}</p>
                <p className="text-xs text-slate-400 mt-1">{dashboardData.videoCount} videos</p>
              </div>
              <Users className="text-green-400" size={40} />
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Device Distribution */}
          <div className="bg-slate-700 p-6 rounded-lg">
            <h2 className="text-xl font-bold text-white mb-4">Device Distribution</h2>
            {deviceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={deviceData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value">
                    {deviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400">No data available</p>
            )}
          </div>

          {/* Network Type Distribution */}
          <div className="bg-slate-700 p-6 rounded-lg">
            <h2 className="text-xl font-bold text-white mb-4">Network Type Distribution</h2>
            {networkData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={networkData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400">No data available</p>
            )}
          </div>

          {/* Event Timeline */}
          <div className="bg-slate-700 p-6 rounded-lg">
            <h2 className="text-xl font-bold text-white mb-4">Events by Time of Day</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="time" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                <Line type="monotone" dataKey="events" stroke="#3b82f6" dot={{ fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Quality Changes */}
          <div className="bg-slate-700 p-6 rounded-lg">
            <h2 className="text-xl font-bold text-white mb-4">Quality Changes</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-white">
                <span>Total Quality Changes:</span>
                <span className="font-bold">{dashboardData.totalQualityChanges}</span>
              </div>
              <div className="bg-slate-600 p-3 rounded mt-4">
                <p className="text-slate-300 text-sm">
                  Quality adaptations help users with varying network conditions watch videos seamlessly. Higher numbers indicate more dynamic adjustments.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Analysis */}
        {errorData.length > 0 && (
          <div className="bg-slate-700 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Error Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={errorData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                <Bar dataKey="value" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Insights */}
        <div className="bg-slate-700 p-6 rounded-lg">
          <h2 className="text-xl font-bold text-white mb-4">Performance Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-600 p-4 rounded">
              <p className="text-blue-300 font-semibold mb-2">✓ Buffering Analysis</p>
              <p className="text-slate-300 text-sm">
                {dashboardData.bufferingPercentage}% of events are buffering. Consider optimizing CDN and encoding.
              </p>
            </div>
            <div className="bg-slate-600 p-4 rounded">
              <p className="text-orange-300 font-semibold mb-2">⚠ Error Rate</p>
              <p className="text-slate-300 text-sm">
                {dashboardData.errorPercentage}% error rate detected. Review error logs for patterns.
              </p>
            </div>
            <div className="bg-slate-600 p-4 rounded">
              <p className="text-green-300 font-semibold mb-2">✓ User Engagement</p>
              <p className="text-slate-300 text-sm">
                {dashboardData.userCount} unique users across {dashboardData.videoCount} videos.
              </p>
            </div>
            <div className="bg-slate-600 p-4 rounded">
              <p className="text-indigo-300 font-semibold mb-2">ℹ Recommendation</p>
              <p className="text-slate-300 text-sm">
                Focus on reducing buffering events to improve overall QoE score.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QoEDashboard;
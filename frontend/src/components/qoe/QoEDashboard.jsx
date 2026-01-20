// ==================== FIXED QoE DASHBOARD WITH DATE FILTERING ====================
// components/QoEDashboard.jsx

import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, AlertTriangle, Zap, Download, RefreshCw, Calendar } from 'lucide-react';

const QoEDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    start: '',
    end: ''
  });
  const [appliedDateRange, setAppliedDateRange] = useState({
    start: '',
    end: ''
  });
  const [selectedVideo, setSelectedVideo] = useState('all');
  const API_BASE_URL = import.meta.env.VITE_API_BASE || '';

  // ==================== FETCH ANALYTICS WITH DATE FILTER ====================
  const fetchDashboardData = async (startDate = '', endDate = '') => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams();

      // Validate and add dates
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          params.append('startDate', startDate);
        } else {
          console.warn('⚠️ Invalid start date:', startDate);
        }
      }

      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          params.append('endDate', endDate);
        } else {
          console.warn('⚠️ Invalid end date:', endDate);
        }
      }

      const queryString = params.toString();
      const url = queryString
        ? `${API_BASE_URL}/api/qoe/analytics?${queryString}`
        : `${API_BASE_URL}/api/qoe/analytics`;

      console.log('📊 Fetching analytics from:', url);
      console.log('📅 Date Range:', { startDate, endDate });

      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        setDashboardData(result.data);
        setAppliedDateRange({ start: startDate, end: endDate });
        console.log('✅ Analytics fetched:', result.data);
        console.log('📊 Date range in response:', result.data.dateRange);
      } else {
        setError('Failed to fetch dashboard data: ' + result.error);
      }
    } catch (err) {
      setError('Error connecting to API: ' + err.message);
      console.error('❌ API Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch initial data on component mount
  useEffect(() => {
    fetchDashboardData();
    document.title = "Consolidated QoE Dashboard";
  }, []);

  // ==================== HANDLE APPLY FILTERS ====================
  const handleApplyFilters = () => {
    if (!dateRange.start && !dateRange.end) {
      alert('⚠️ Please select at least one date');
      return;
    }

    if (dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      if (start > end) {
        alert('❌ Start date cannot be after end date');
        return;
      }
    }

    console.log('✅ Applying filters:', dateRange);
    fetchDashboardData(dateRange.start, dateRange.end);
  };

  // ==================== HANDLE CLEAR FILTERS ====================
  const handleClearFilters = () => {
    setDateRange({ start: '', end: '' });
    setAppliedDateRange({ start: '', end: '' });
    fetchDashboardData('', '');
  };

  // ==================== HANDLE EXPORT ====================
  const handleExport = () => {
    const exportData = {
      ...dashboardData,
      exportedAt: new Date().toISOString(),
      appliedFilters: appliedDateRange
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qoe-report-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    console.log('✅ Report exported');
  };

  // ==================== GET DATE RANGE DISPLAY TEXT ====================
  const getDateRangeText = () => {
    if (appliedDateRange.start && appliedDateRange.end) {
      return `${appliedDateRange.start} to ${appliedDateRange.end}`;
    } else if (appliedDateRange.start) {
      return `From ${appliedDateRange.start}`;
    } else if (appliedDateRange.end) {
      return `Until ${appliedDateRange.end}`;
    }
    return 'All Time';
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

  // ==================== PREPARE CHART DATA ====================
  const deviceData = Object.entries(dashboardData.deviceBreakdown || {}).map(([device, count]) => ({
    name: device.charAt(0).toUpperCase() + device.slice(1),
    value: count
  }));

  const networkData = Object.entries(dashboardData.networkTypeBreakdown || {}).map(([network, count]) => ({
    name: network.toUpperCase(),
    value: count
  }));

  const errorData = Object.entries(dashboardData.topErrorTypes || {}).map(([type, count]) => ({
    name: type.replace(/_/g, ' ').charAt(0).toUpperCase() + type.replace(/_/g, ' ').slice(1),
    value: count
  }));

  const errorMessageData = Object.entries(dashboardData.topErrorMessages || {}).map(([msg, count]) => ({
    name: msg,
    value: count
  }));

  const timelineData = [
    { time: '00:00', events: Math.floor(dashboardData.totalEvents * 0.05) },
    { time: '06:00', events: Math.floor(dashboardData.totalEvents * 0.12) },
    { time: '12:00', events: Math.floor(dashboardData.totalEvents * 0.25) },
    { time: '18:00', events: Math.floor(dashboardData.totalEvents * 0.35) },
    { time: '23:59', events: Math.floor(dashboardData.totalEvents * 0.23) }
  ];

  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">📊 Consolidated QoE Dashboard</h1>
            <p className="text-slate-400">Video platform quality monitoring</p>
            <p className="text-sm text-slate-500 mt-1">
              <Calendar className="inline mr-1" size={14} />
              Period: <strong>{getDateRangeText()}</strong>
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => fetchDashboardData(appliedDateRange.start, appliedDateRange.end)}
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

        {/* Date Range Filters */}
        <div className="bg-slate-700 p-6 rounded-lg mb-8">
          <h2 className="text-lg font-bold text-white mb-4">📅 Filter by Date Range</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-slate-300 mb-2">Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
              />
              {dateRange.start && (
                <p className="text-xs text-slate-400 mt-1">{new Date(dateRange.start).toLocaleDateString()}</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-2">End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white"
              />
              {dateRange.end && (
                <p className="text-xs text-slate-400 mt-1">{new Date(dateRange.end).toLocaleDateString()}</p>
              )}
            </div>

            <div className="flex gap-2 items-end">
              <button
                onClick={handleApplyFilters}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-semibold"
              >
                ✅ Apply
              </button>
            </div>

            <div className="flex gap-2 items-end">
              <button
                onClick={handleClearFilters}
                className="flex-1 bg-slate-600 hover:bg-slate-500 text-white px-6 py-2 rounded font-semibold"
              >
                🔄 Clear
              </button>
            </div>
          </div>

          {appliedDateRange.start || appliedDateRange.end ? (
            <div className="mt-4 p-3 bg-blue-900 border border-blue-500 rounded">
              <p className="text-sm text-blue-200">
                ✅ Filters applied: <strong>{getDateRangeText()}</strong> | Sessions found: <strong>{dashboardData.totalEvents || 0}</strong>
              </p>
            </div>
          ) : (
            <div className="mt-4 p-3 bg-slate-600 border border-slate-500 rounded">
              <p className="text-sm text-slate-300">
                📊 Showing all-time data - Select dates to filter
              </p>
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-slate-700 p-6 rounded-lg border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Events</p>
                <p className="text-3xl font-bold text-white">{dashboardData.totalEvents?.toLocaleString()}</p>
              </div>
              <Zap className="text-blue-400" size={40} />
            </div>
          </div>

          <div className="bg-slate-700 p-6 rounded-lg border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Buffering Events</p>
                <p className="text-3xl font-bold text-white">{dashboardData.totalBufferingEvents}</p>
                <p className="text-xs text-slate-400 mt-1">{dashboardData.bufferingPercentage}%</p>
              </div>
              <AlertTriangle className="text-red-400" size={40} />
            </div>
          </div>

          <div className="bg-slate-700 p-6 rounded-lg border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Playback Errors</p>
                <p className="text-3xl font-bold text-white">{dashboardData.totalErrors}</p>
                <p className="text-xs text-slate-400 mt-1">Recorded: {dashboardData.recordedErrors}</p>
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

          <div className="bg-slate-700 p-6 rounded-lg border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Avg Watch Duration</p>
                <p className="text-3xl font-bold text-white">{Math.floor(dashboardData.avgWatchDuration / 60)}:{(dashboardData.avgWatchDuration % 60).toFixed(0).padStart(2, '0')}</p>
                <p className="text-xs text-slate-400 mt-1">{dashboardData.avgWatchDuration}s</p>
              </div>
              <TrendingUp className="text-purple-400" size={40} />
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
                  <Tooltip
                    formatter={(value, name) => [`Total: ${value} users on ${name}`, "Device Usage"]}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400">No data available for this period</p>
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
                  <Tooltip
                    formatter={(value, name, props) => [`Total: ${value} users on ${props.payload.name} network`, "Network Coverage"]}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff' }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400">No data available for this period</p>
            )}
          </div>

          {/* Error Types */}
          {errorData.length > 0 && (
            <div className="bg-slate-700 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-white mb-4">Error Types Distribution</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={errorData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="name" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    formatter={(value, name, props) => [`Detected ${value} cases of ${props.payload.name}`, "Problem Areas"]}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff' }}
                  />
                  <Bar dataKey="value" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Common Error Messages */}
          {errorMessageData.length > 0 && (
            <div className="bg-slate-700 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-white mb-4">Common Error Messages</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={errorMessageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    formatter={(value, name, props) => [`Occurred ${value} times: ${props.payload.name}`, "Frequency"]}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff' }}
                  />
                  <Bar dataKey="value" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

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
                  Quality adaptations help users with varying network conditions watch videos seamlessly.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="bg-slate-700 p-6 rounded-lg">
          <h2 className="text-xl font-bold text-white mb-4">Performance Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-600 p-4 rounded">
              <p className="text-blue-300 font-semibold mb-2">✓ Buffering Analysis</p>
              <p className="text-slate-300 text-sm">
                {dashboardData.bufferingPercentage}% of events are buffering. {dashboardData.bufferingPercentage > 5 ? '⚠️ Consider optimizing CDN' : '✅ Good performance'}
              </p>
            </div>
            <div className="bg-slate-600 p-4 rounded">
              <p className="text-orange-300 font-semibold mb-2">⚠ Error Rate</p>
              <p className="text-slate-300 text-sm">
                {dashboardData.errorPercentage}% error rate with {dashboardData.recordedErrors} recorded errors and {dashboardData.recordedCrashes} crashes.
              </p>
            </div>
            <div className="bg-slate-600 p-4 rounded">
              <p className="text-green-300 font-semibold mb-2">✓ User Engagement</p>
              <p className="text-slate-300 text-sm">
                {dashboardData.userCount} unique users across {dashboardData.videoCount} videos with {dashboardData.avgWatchDuration}s average watch time.
              </p>
            </div>
            <div className="bg-slate-600 p-4 rounded">
              <p className="text-indigo-300 font-semibold mb-2">ℹ Recommendation</p>
              <p className="text-slate-300 text-sm">
                Focus on reducing {dashboardData.recordedErrors > 0 ? 'recorded errors' : 'buffering events'} to improve overall QoE score.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QoEDashboard;
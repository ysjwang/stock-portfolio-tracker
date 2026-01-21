import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceArea,
} from 'recharts';
import { portfolioApi } from '../services/api';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const PerformanceChart = () => {
  const [rawData, setRawData] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [allocationData, setAllocationData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tickInterval, setTickInterval] = useState('day');
  const [activeChart, setActiveChart] = useState('performance');
  const [dateRange, setDateRange] = useState({ preset: 'all', start: null, end: null });
  const [refAreaLeft, setRefAreaLeft] = useState('');
  const [refAreaRight, setRefAreaRight] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [performanceRes, allocationRes] = await Promise.all([
          portfolioApi.getPerformance(),
          portfolioApi.getAllocation(),
        ]);

        const performanceWithTimestamp = performanceRes.data.data.map(d => ({
          ...d,
          timestamp: new Date(d.date).getTime()
        }));

        setRawData(performanceWithTimestamp);
        setAllocationData(allocationRes.data.data);
        setError('');
      } catch (err) {
        setError('Failed to load chart data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (rawData.length === 0) {
      setChartData([]);
      return;
    }

    const processData = () => {
      const timestamps = rawData.map(d => d.timestamp);
      // Min/Max from ALL data
      const dataMinTimestamp = Math.min(...timestamps);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      let startDateObj, endDateObj;

      // Determine Start/End Date objects based on range
      if (dateRange.preset === 'custom' && dateRange.start && dateRange.end) {
        const [startYear, startMonth, startDay] = dateRange.start.split('-').map(Number);
        startDateObj = new Date(startYear, startMonth - 1, startDay);
        startDateObj.setHours(0, 0, 0, 0);

        const [endYear, endMonth, endDay] = dateRange.end.split('-').map(Number);
        endDateObj = new Date(endYear, endMonth - 1, endDay);
        endDateObj.setHours(23, 59, 59, 999);
      } else {
        endDateObj = new Date(today);

        switch (dateRange.preset) {
          case '1m':
            startDateObj = new Date(today);
            startDateObj.setMonth(today.getMonth() - 1);
            break;
          case '6m':
            startDateObj = new Date(today);
            startDateObj.setMonth(today.getMonth() - 6);
            break;
          case 'ytd':
            startDateObj = new Date(today.getFullYear(), 0, 1);
            break;
          case '1y':
            startDateObj = new Date(today);
            startDateObj.setFullYear(today.getFullYear() - 1);
            break;
          case 'all':
          default:
            startDateObj = new Date(dataMinTimestamp);
            break;
        }
        startDateObj.setHours(0, 0, 0, 0);
      }

      if (startDateObj > endDateObj) {
        startDateObj = new Date(endDateObj);
        startDateObj.setHours(0, 0, 0, 0);
      }

      // Sort rawData to be sure
      const sortedData = [...rawData].sort((a, b) => a.timestamp - b.timestamp);

      // Helper for Step Interpolation (Invested Amount, etc.)
      const getLastKnownValue = (timestamp) => {
        let lastKnown = null;
        for (let i = 0; i < sortedData.length; i++) {
          if (sortedData[i].timestamp <= timestamp) {
            lastKnown = sortedData[i];
          } else {
            break;
          }
        }
        if (!lastKnown && sortedData.length > 0) {
          // Before first data point
          return { ...sortedData[0], value: 0, invested: 0 };
          // Or return null? If we return sortedData[0], we get flat line before start.
          // Returning 0 makes more sense for "invested".
        }
        return lastKnown;
      };

      // Helper for Linear Interpolation (Portfolio Value)
      const getInterpolatedValue = (timestamp) => {
        if (sortedData.length === 0) return 0;

        // Find Prev and Next
        let prev = null;
        let next = null;

        for (let i = 0; i < sortedData.length; i++) {
          if (sortedData[i].timestamp <= timestamp) {
            prev = sortedData[i];
          }
          if (sortedData[i].timestamp > timestamp) {
            next = sortedData[i];
            break;
          }
        }

        if (!prev) {
          // Before all data
          return 0; // Or sortedData[0].value if we assume flat start?
        }
        if (!next) {
          // After all data (or exactly at last point)
          return prev.value;
        }

        // Interpolate
        const timeDiff = next.timestamp - prev.timestamp;
        if (timeDiff === 0) return prev.value;

        const progress = (timestamp - prev.timestamp) / timeDiff;
        const valueDiff = next.value - prev.value;

        return prev.value + (progress * valueDiff);
      };


      const resampled = [];
      const current = new Date(startDateObj);

      // Setup loop start based on interval to align nicely
      if (tickInterval === 'year') {
        current.setMonth(0, 1);
        // If adjusting to start of year moved us BEFORE startDate, we catch up in loop or just accept it?
        // We should ensure we don't emit points before startDate for the chart cleanly?
        // Actually, Resampling usually means "Give me points at these intervals".
      } else if (tickInterval === 'month') {
        current.setDate(1);
      } else {
        // day, align to midnight (already done)
      }

      const endTs = endDateObj.getTime();

      // Ensure we include the start range boundary if it's not aligned?
      // Recharts lines starting midway might be fine.

      // Loop
      while (current.getTime() <= endTs) {
        const ts = current.getTime();

        // Only add if >= startDate (handling the alignment offset)
        if (ts >= startDateObj.getTime()) {
          const lastKnown = getLastKnownValue(ts); // For meta/invested
          const interpolatedVal = getInterpolatedValue(ts); // For value

          if (lastKnown) {
            resampled.push({
              timestamp: ts,
              date: current.toISOString(),
              invested: lastKnown.invested, // Step
              value: interpolatedVal,       // Linear
              // Keep other props from lastKnown if needed for tooltip? 
              // Note: other props might be stale if we linearly interpolate 'value'.
              // But 'invested' is correct.
            });
          }
        }

        // Increment
        if (tickInterval === 'year') {
          current.setFullYear(current.getFullYear() + 1);
        } else if (tickInterval === 'month') {
          current.setMonth(current.getMonth() + 1);
        } else {
          current.setDate(current.getDate() + 1);
        }
      }

      // Explicitly add "Today" / EndDate point if missing?
      // This ensures the graph reaches the right edge.
      const lastResampled = resampled[resampled.length - 1];
      if (!lastResampled || lastResampled.timestamp < endTs) {
        const ts = endTs;
        const lastKnown = getLastKnownValue(ts);
        const interpolatedVal = getInterpolatedValue(ts);
        if (lastKnown) {
          resampled.push({
            timestamp: ts,
            date: new Date(ts).toISOString(),
            invested: lastKnown.invested,
            value: interpolatedVal,
          });
        }
      }

      setChartData(resampled);
    };

    processData();
  }, [rawData, tickInterval, dateRange]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    if (tickInterval === 'year') {
      return date.getFullYear().toString();
    } else if (tickInterval === 'month') {
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } else {
      // day
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  const getTicks = () => {
    return chartData.map(d => d.timestamp);
  };

  const getDomain = () => {
    if (chartData.length === 0) return ['auto', 'auto'];
    // Extend domain to end of day if it's "today"
    // To ensures the graph assumes the full time range even if data stops earlier (though we added start point).
    // Let's stick to data extent to keep lines clean.
    return [chartData[0].timestamp, chartData[chartData.length - 1].timestamp];
  };

  const handleDateRangeChange = (e) => {
    const val = e.target.value;
    setDateRange(prev => ({ ...prev, preset: val }));
  };

  const handleCustomDateChange = (type, val) => {
    setDateRange(prev => ({ ...prev, [type]: val }));
  };

  const zoom = () => {
    let left = refAreaLeft;
    let right = refAreaRight;

    if (left === right || right === '') {
      setRefAreaLeft('');
      setRefAreaRight('');
      return;
    }

    // Ensure left < right
    if (left > right) [left, right] = [right, left];

    // Convert timestamps to YYYY-MM-DD
    const startDate = new Date(left).toISOString().split('T')[0];
    const endDate = new Date(right).toISOString().split('T')[0];

    setDateRange({ preset: 'custom', start: startDate, end: endDate });
    setRefAreaLeft('');
    setRefAreaRight('');
  };

  if (loading) {
    return (
      <div className="card">
        <div className="text-center py-8 text-gray-500">Loading charts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (rawData.length === 0 && allocationData.length === 0) {
    return (
      <div className="card">
        <h2 className="text-2xl font-bold mb-4">Performance</h2>
        <div className="text-center py-8 text-gray-500">
          No data available yet. Add transactions to see your portfolio performance!
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Performance</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveChart('performance')}
              className={`btn ${activeChart === 'performance' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Timeline
            </button>
            <button
              onClick={() => setActiveChart('allocation')}
              className={`btn ${activeChart === 'allocation' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Allocation
            </button>
          </div>
        </div>

        {activeChart === 'performance' && (
          <div className="flex flex-wrap items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
            {/* Interval Toggles */}
            <div className="flex bg-white rounded-md border border-gray-200 shadow-sm p-1">
              <button
                onClick={() => setTickInterval('day')}
                className={`px-3 py-1 text-sm rounded transition-colors ${tickInterval === 'day' ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Day
              </button>
              <button
                onClick={() => setTickInterval('month')}
                className={`px-3 py-1 text-sm rounded transition-colors ${tickInterval === 'month' ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Month
              </button>
              <button
                onClick={() => setTickInterval('year')}
                className={`px-3 py-1 text-sm rounded transition-colors ${tickInterval === 'year' ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Year
              </button>
            </div>

            <div className="h-6 w-px bg-gray-300 mx-2 hidden sm:block"></div>

            {/* Date Range Select */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Range:</span>
              <select
                className="form-select text-sm py-1 px-2 border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500"
                value={dateRange.preset}
                onChange={handleDateRangeChange}
              >
                <option value="all">All Time</option>
                <option value="1m">Last Month</option>
                <option value="6m">Last 6 Months</option>
                <option value="ytd">Year to Date (YTD)</option>
                <option value="1y">Last Year</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {dateRange.preset === 'custom' && (
              <div className="flex items-center gap-2 animate-fadeIn">
                <input
                  type="date"
                  className="form-input text-sm py-1 px-2 border-gray-300 rounded-md shadow-sm"
                  onChange={(e) => handleCustomDateChange('start', e.target.value)}
                  value={dateRange.start || ''}
                />
                <span className="text-gray-400">-</span>
                <input
                  type="date"
                  className="form-input text-sm py-1 px-2 border-gray-300 rounded-md shadow-sm"
                  onChange={(e) => handleCustomDateChange('end', e.target.value)}
                  value={dateRange.end || ''}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {activeChart === 'performance' && chartData.length > 0 && (
        <div>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={chartData}
              onMouseDown={(e) => e && setRefAreaLeft(e.activeLabel)}
              onMouseMove={(e) => refAreaLeft && e && setRefAreaRight(e.activeLabel)}
              onMouseUp={zoom}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={getDomain()}
                ticks={getTicks()}
                tickFormatter={formatDate}
                interval={0}
                minTickGap={0}
                allowDataOverflow
              />
              <YAxis tickFormatter={formatCurrency} domain={['auto', 'auto']} allowDataOverflow />
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString()}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0ea5e9"
                strokeWidth={2}
                name="Portfolio Value"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls={true}
                isAnimationActive={false} // Disable animation for smoother drags
              />
              <Line
                type="monotone"
                dataKey="invested"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Total Invested"
                dot={{ r: 4 }}
                connectNulls={true}
                isAnimationActive={false}
              />
              {refAreaLeft && refAreaRight ? (
                <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} />
              ) : null}
            </LineChart>
          </ResponsiveContainer>

          <div className="mt-4 text-sm text-gray-600">
            <p>
              This chart shows your portfolio value over time compared to the total amount invested.
            </p>
          </div>
        </div>
      )}

      {activeChart === 'allocation' && allocationData.length > 0 && (
        <div>
          <div className="flex flex-col md:flex-row gap-8 items-center">
            {/* Pie Chart */}
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={allocationData}
                    dataKey="percentage"
                    nameKey="ticker"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={({ ticker, percentage }) => `${ticker} (${percentage.toFixed(1)}%)`}
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, props) => [
                      `${value.toFixed(2)}% (${formatCurrency(props.payload.marketValue)})`,
                      props.payload.ticker,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend Table */}
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-4">Portfolio Allocation</h3>
              <div className="space-y-2">
                {allocationData.map((holding, index) => (
                  <div
                    key={holding.ticker}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-semibold">{holding.ticker}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{holding.percentage.toFixed(2)}%</div>
                      <div className="text-sm text-gray-600">
                        {formatCurrency(holding.marketValue)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            <p>This chart shows how your portfolio is distributed across different stocks.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceChart;

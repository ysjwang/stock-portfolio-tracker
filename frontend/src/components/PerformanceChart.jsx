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

    const resampleData = () => {
      const timestamps = rawData.map(d => d.timestamp);
      const minTimestamp = Math.min(...timestamps);
      const maxTimestamp = new Date().setHours(0, 0, 0, 0); // Today at midnight

      // Ensure we at least cover the range
      const startDate = new Date(minTimestamp);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(maxTimestamp);

      const resampled = [];
      const current = new Date(startDate);

      // Helper to find last known value
      const getLastKnownValue = (timestamp) => {
        // Find the latest data point that is <= timestamp
        // Since rawData is likely sorted by date (API usually returns sorted), we can search.
        // If not sorted, we should sort rawData first. Assuming sorted ascending.
        let lastKnown = null;
        for (let i = 0; i < rawData.length; i++) {
          if (rawData[i].timestamp <= timestamp) {
            lastKnown = rawData[i];
          } else {
            break;
          }
        }

        // If before first transaction, technically 0 investment and value.
        // But we are starting from minTimestamp, so at least one point (the first transaction) should match.
        if (!lastKnown && rawData.length > 0) {
          // Fallback to the very first point if somehow we query before it (shouldn't happen with startDate=min)
          return rawData[0];
        }
        return lastKnown;
      };

      if (tickInterval === 'year') {
        // Set to Jan 1st of the start year
        current.setMonth(0, 1);
        while (current <= endDate) {
          if (current >= startDate) {
            const lastKnown = getLastKnownValue(current.getTime());
            if (lastKnown) {
              resampled.push({
                ...lastKnown, // value, invested
                timestamp: current.getTime(),
                date: current.toISOString() // consistent format just in case
              });
            }
          }
          current.setFullYear(current.getFullYear() + 1);
        }
      } else if (tickInterval === 'month') {
        // Set to 1st of the start month
        current.setDate(1);
        while (current <= endDate) {
          if (current >= startDate) {
            const lastKnown = getLastKnownValue(current.getTime());
            if (lastKnown) {
              resampled.push({
                ...lastKnown,
                timestamp: current.getTime(),
                date: current.toISOString()
              });
            }
          }
          current.setMonth(current.getMonth() + 1);
        }
      } else {
        // Day
        while (current <= endDate) {
          const lastKnown = getLastKnownValue(current.getTime());
          if (lastKnown) {
            resampled.push({
              ...lastKnown,
              timestamp: current.getTime(),
              date: current.toISOString()
            });
          }
          current.setDate(current.getDate() + 1);
        }
      }

      // Ensure the very last point (Today) is included?
      // User requested "end date should be today".
      // Our loops go <= endDate. 
      // If today is not a "tick" in year/month mode (e.g. today is Mar 15, tick is Mar 1), do we show Mar 15?
      // "the ticks that exist on the graph... the number of ticks should be determined by the picker"
      // If user picks "Month", ticks are months. 
      // But if we only show ticks, the line ends at the last tick.
      // If Today is May 15, and last tick is May 1. 
      // User requirement: "end date should be today".
      // This implies the axis ends today.
      // If we only provide data up to May 1, the line stops short.
      // If we provide data for May 15, but it's not a "month tick", Recharts will show the point but maybe not the label.
      // Let's add specific logic: Always add a point for "Today" if the last tick wasn't today?
      // Or maybe the user strictly wants "ticks" to determine data points.
      // "number of ticks should be determined by Day/Month/Year picker".
      // If I pick Year, I get 2023, 2024, 2025. 
      // If today is 2026-01-21. I should see ticks for 2023, 2024, 2025, 2026.
      // My loop generates ticks.
      // If today is midway through a year/month?
      // Generally for "Month" view, you expect monthly points. If you are halfway through the month, do you show the partial month? Yes usually.
      // The loop generates 1st of month.
      // If today is Jan 21. 
      // Jan 1 is generated. 
      // Next is Feb 1 (future).
      // So line stops at Jan 1. 
      // The axis domain goes to Today (Jan 21).
      // So there is a gap at the end.
      // Let's explicitly add "Today" as a data point effectively? 
      // Or does "ticks determined by picker" mean "only show these specific points"?
      // "show the accurate price per tick though".
      // This implies: For every TICK shown on the axis, show the price.
      // It does NOT explicitly demand a point at "Today" if "Today" is not a tick.
      // But "end date should be today" (Requirement 2).
      // If end date is today, and last tick is 20 days ago, it looks weird.
      // I will stick to generated ticks for now.

      setChartData(resampled);
    };

    resampleData();
  }, [rawData, tickInterval]);

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

  // Ticks are now simply the timestamps of our data points!
  // Since we constructed chartData EXACTLY based on intended ticks.
  const getTicks = () => {
    return chartData.map(d => d.timestamp);
  };

  const getDomain = () => {
    if (chartData.length === 0) return ['auto', 'auto'];
    const minTimestamp = chartData[0].timestamp; // Start date
    const maxTimestamp = new Date().getTime(); // Today
    // Or simply match data? 
    // "start date should be date of earliest transaction" -> minTimestamp matches this (approx)
    // "end date should be today".
    // If we force domain to Today, but last data point is Jan 1 (and today is Jan 21), we have a gap.
    // I will extend domain to today to be safe.
    return [minTimestamp, maxTimestamp];
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Performance</h2>
        <div className="flex gap-2">
          {activeChart === 'performance' && (
            <div className="flex bg-gray-100 rounded-lg p-1 mr-4">
              <button
                onClick={() => setTickInterval('day')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${tickInterval === 'day' ? 'bg-white shadow text-primary-600 font-medium' : 'text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Day
              </button>
              <button
                onClick={() => setTickInterval('month')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${tickInterval === 'month' ? 'bg-white shadow text-primary-600 font-medium' : 'text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Month
              </button>
              <button
                onClick={() => setTickInterval('year')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${tickInterval === 'year' ? 'bg-white shadow text-primary-600 font-medium' : 'text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Year
              </button>
            </div>
          )}
          <button
            onClick={() => setActiveChart('performance')}
            className={`btn ${activeChart === 'performance' ? 'btn-primary' : 'btn-secondary'
              }`}
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

      {activeChart === 'performance' && chartData.length > 0 && (
        <div>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={getDomain()}
                ticks={getTicks()}
                tickFormatter={formatDate}
                interval={0} // Force show all ticks we generated
                minTickGap={0} // We want our specific ticks
              />
              <YAxis tickFormatter={formatCurrency} domain={['auto', 'auto']} />
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
              />
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

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
  const [performanceData, setPerformanceData] = useState([]);
  const [allocationData, setAllocationData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeChart, setActiveChart] = useState('performance');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [performanceRes, allocationRes] = await Promise.all([
          portfolioApi.getPerformance(),
          portfolioApi.getAllocation(),
        ]);

        setPerformanceData(performanceRes.data.data);
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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
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

  if (performanceData.length === 0 && allocationData.length === 0) {
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
          <button
            onClick={() => setActiveChart('performance')}
            className={`btn ${
              activeChart === 'performance' ? 'btn-primary' : 'btn-secondary'
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

      {activeChart === 'performance' && performanceData.length > 0 && (
        <div>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={formatDate} />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                labelFormatter={(label) => `Date: ${label}`}
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
              />
              <Line
                type="monotone"
                dataKey="invested"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Total Invested"
                dot={{ r: 4 }}
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

import { useState, useEffect } from 'react';
import { portfolioApi } from '../services/api';

const PortfolioSummary = () => {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      const response = await portfolioApi.getSummary();
      setPortfolio(response.data.data);
      setError('');
    } catch (err) {
      setError('Failed to load portfolio data');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPortfolio();
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercent = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="card">
        <div className="text-center py-8 text-gray-500">Loading portfolio...</div>
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

  if (!portfolio || portfolio.holdings.length === 0) {
    return (
      <div className="card">
        <h2 className="text-2xl font-bold mb-4">Portfolio Summary</h2>
        <div className="text-center py-8 text-gray-500">
          No holdings yet. Add your first transaction to see your portfolio!
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Summary */}
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Portfolio Summary</h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary text-sm"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Prices'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Total Value */}
          <div className="bg-primary-50 p-4 rounded-lg">
            <div className="text-sm text-primary-600 font-medium mb-1">Total Value</div>
            <div className="text-2xl font-bold text-primary-900">
              {formatCurrency(portfolio.totalValue)}
            </div>
          </div>

          {/* Total Cost */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 font-medium mb-1">Total Cost</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(portfolio.totalCost)}
            </div>
          </div>

          {/* Total Gain/Loss */}
          <div
            className={`p-4 rounded-lg ${
              portfolio.totalGainLoss >= 0 ? 'bg-green-50' : 'bg-red-50'
            }`}
          >
            <div
              className={`text-sm font-medium mb-1 ${
                portfolio.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              Total Gain/Loss
            </div>
            <div
              className={`text-2xl font-bold ${
                portfolio.totalGainLoss >= 0 ? 'text-green-900' : 'text-red-900'
              }`}
            >
              {formatCurrency(portfolio.totalGainLoss)}
            </div>
          </div>

          {/* Gain/Loss Percent */}
          <div
            className={`p-4 rounded-lg ${
              portfolio.totalGainLossPercent >= 0 ? 'bg-green-50' : 'bg-red-50'
            }`}
          >
            <div
              className={`text-sm font-medium mb-1 ${
                portfolio.totalGainLossPercent >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              Return
            </div>
            <div
              className={`text-2xl font-bold ${
                portfolio.totalGainLossPercent >= 0 ? 'text-green-900' : 'text-red-900'
              }`}
            >
              {formatPercent(portfolio.totalGainLossPercent)}
            </div>
          </div>
        </div>

        {portfolio.priceErrors && (
          <div className="mt-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded text-sm">
            Warning: Could not fetch prices for some stocks. Check your API configuration.
          </div>
        )}

        {portfolio.timestamp && (
          <div className="mt-4 text-sm text-gray-500">
            Last updated: {new Date(portfolio.timestamp).toLocaleString()}
          </div>
        )}
      </div>

      {/* Holdings Detail */}
      <div className="card">
        <h3 className="text-xl font-bold mb-4">Holdings</h3>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="table-header">Ticker</th>
                <th className="table-header text-right">Shares</th>
                <th className="table-header text-right">Avg Cost</th>
                <th className="table-header text-right">Current Price</th>
                <th className="table-header text-right">Market Value</th>
                <th className="table-header text-right">Gain/Loss</th>
                <th className="table-header text-right">Return %</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {portfolio.holdings.map((holding) => (
                <tr key={holding.ticker} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <span className="font-bold text-lg">{holding.ticker}</span>
                  </td>
                  <td className="table-cell text-right">{holding.quantity.toFixed(4)}</td>
                  <td className="table-cell text-right">
                    {formatCurrency(holding.avgCostBasis)}
                  </td>
                  <td className="table-cell text-right">
                    {formatCurrency(holding.currentPrice)}
                  </td>
                  <td className="table-cell text-right font-semibold">
                    {formatCurrency(holding.marketValue)}
                  </td>
                  <td
                    className={`table-cell text-right font-semibold ${
                      holding.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(holding.gainLoss)}
                  </td>
                  <td
                    className={`table-cell text-right font-semibold ${
                      holding.gainLossPercent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {formatPercent(holding.gainLossPercent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PortfolioSummary;

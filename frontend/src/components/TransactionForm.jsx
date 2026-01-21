import { useState, useEffect } from 'react';
import { transactionApi, stockApi } from '../services/api';

const TransactionForm = ({ onTransactionAdded, editTransaction, onCancel }) => {
  const [formData, setFormData] = useState(
    editTransaction || {
      ticker: '',
      transaction_type: 'BUY',
      transaction_date: new Date().toISOString().split('T')[0],
      quantity: '',
      price_per_share: '',
    }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoSetPrice, setAutoSetPrice] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);

  // Fetch historical price when auto-set is enabled and we have ticker and date
  useEffect(() => {
    const fetchHistoricalPrice = async () => {
      if (!autoSetPrice || !formData.ticker || !formData.transaction_date) {
        return;
      }

      setFetchingPrice(true);
      setError('');

      try {
        const response = await stockApi.getHistoricalPrice(
          formData.ticker.toUpperCase(),
          formData.transaction_date
        );

        setFormData((prev) => ({
          ...prev,
          price_per_share: response.data.data.price.toFixed(2),
        }));
      } catch (err) {
        const errorMsg = err.response?.data?.error || 'Failed to fetch historical price';
        setError(errorMsg + '. Please enter the price manually or try a different date.');
        setAutoSetPrice(false);
      } finally {
        setFetchingPrice(false);
      }
    };

    fetchHistoricalPrice();
  }, [autoSetPrice, formData.ticker, formData.transaction_date]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAutoSetPriceChange = (e) => {
    setAutoSetPrice(e.target.checked);
    if (!e.target.checked) {
      // Clear the price when unchecking
      setFormData((prev) => ({
        ...prev,
        price_per_share: '',
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = {
        ticker: formData.ticker.toUpperCase(),
        transaction_type: formData.transaction_type,
        transaction_date: formData.transaction_date,
        quantity: parseFloat(formData.quantity),
        price_per_share: parseFloat(formData.price_per_share),
      };

      if (editTransaction) {
        await transactionApi.update(editTransaction.id, data);
      } else {
        await transactionApi.create(data);
      }

      // Reset form
      if (!editTransaction) {
        setFormData({
          ticker: '',
          transaction_type: 'BUY',
          transaction_date: new Date().toISOString().split('T')[0],
          quantity: '',
          price_per_share: '',
        });
      }

      // Notify parent component
      if (onTransactionAdded) {
        onTransactionAdded();
      }

      if (onCancel) {
        onCancel();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-2xl font-bold mb-6">
        {editTransaction ? 'Edit Transaction' : 'Add New Transaction'}
      </h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ticker */}
          <div>
            <label htmlFor="ticker" className="label">
              Ticker Symbol
            </label>
            <input
              type="text"
              id="ticker"
              name="ticker"
              value={formData.ticker}
              onChange={handleChange}
              className="input uppercase"
              placeholder="e.g., AAPL"
              required
            />
          </div>

          {/* Transaction Type */}
          <div>
            <label htmlFor="transaction_type" className="label">
              Transaction Type
            </label>
            <select
              id="transaction_type"
              name="transaction_type"
              value={formData.transaction_type}
              onChange={handleChange}
              className="input"
              required
            >
              <option value="BUY">Buy</option>
              <option value="SELL">Sell</option>
            </select>
          </div>

          {/* Date */}
          <div>
            <label htmlFor="transaction_date" className="label">
              Date
            </label>
            <input
              type="date"
              id="transaction_date"
              name="transaction_date"
              value={formData.transaction_date}
              onChange={handleChange}
              className="input"
              required
            />
          </div>

          {/* Quantity */}
          <div>
            <label htmlFor="quantity" className="label">
              Quantity
            </label>
            <input
              type="number"
              id="quantity"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              className="input"
              placeholder="0"
              step="0.0001"
              min="0.0001"
              required
            />
          </div>

          {/* Price Per Share */}
          <div>
            <label htmlFor="price_per_share" className="label">
              Price Per Share ($)
            </label>
            <input
              type="number"
              id="price_per_share"
              name="price_per_share"
              value={formData.price_per_share}
              onChange={handleChange}
              className="input"
              placeholder="0.00"
              step="0.01"
              min="0.01"
              required
              disabled={autoSetPrice || fetchingPrice}
            />
            <div className="mt-2">
              <label className="flex items-center text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSetPrice}
                  onChange={handleAutoSetPriceChange}
                  className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  disabled={fetchingPrice}
                />
                <span>
                  Auto-set price based on transaction date
                  {fetchingPrice && ' (fetching...)'}
                </span>
              </label>
            </div>
          </div>

          {/* Total Value (calculated) */}
          <div>
            <label className="label">Total Value</label>
            <div className="input bg-gray-100">
              $
              {formData.quantity && formData.price_per_share
                ? (parseFloat(formData.quantity) * parseFloat(formData.price_per_share)).toFixed(2)
                : '0.00'}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary flex-1"
          >
            {loading ? 'Saving...' : editTransaction ? 'Update Transaction' : 'Add Transaction'}
          </button>

          {editTransaction && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default TransactionForm;

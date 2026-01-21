import { useState, useEffect } from 'react';
import { transactionApi } from '../services/api';
import TransactionForm from './TransactionForm';

const TransactionList = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterTicker, setFilterTicker] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortBy, setSortBy] = useState('transaction_date');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [editingTransaction, setEditingTransaction] = useState(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = {
        sort_by: sortBy,
        order: sortOrder,
      };

      if (filterTicker) {
        params.ticker = filterTicker;
      }
      if (filterType) {
        params.type = filterType;
      }

      const response = await transactionApi.getAll(params);
      setTransactions(response.data.data);
      setError('');
    } catch (err) {
      setError('Failed to load transactions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [filterTicker, filterType, sortBy, sortOrder]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    try {
      await transactionApi.delete(id);
      fetchTransactions();
    } catch (err) {
      alert('Failed to delete transaction');
      console.error(err);
    }
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
  };

  const handleCancelEdit = () => {
    setEditingTransaction(null);
  };

  const handleTransactionUpdated = () => {
    setEditingTransaction(null);
    fetchTransactions();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  if (editingTransaction) {
    return (
      <div>
        <TransactionForm
          editTransaction={editingTransaction}
          onTransactionAdded={handleTransactionUpdated}
          onCancel={handleCancelEdit}
        />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Transaction History</h2>
        <div className="text-sm text-gray-600">
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="label">Filter by Ticker</label>
          <input
            type="text"
            value={filterTicker}
            onChange={(e) => setFilterTicker(e.target.value.toUpperCase())}
            className="input"
            placeholder="e.g., AAPL"
          />
        </div>

        <div>
          <label className="label">Filter by Type</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input"
          >
            <option value="">All</option>
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
          </select>
        </div>

        <div>
          <label className="label">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input"
          >
            <option value="transaction_date">Date</option>
            <option value="ticker">Ticker</option>
            <option value="quantity">Quantity</option>
            <option value="price_per_share">Price</option>
          </select>
        </div>

        <div>
          <label className="label">Order</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="input"
          >
            <option value="DESC">Descending</option>
            <option value="ASC">Ascending</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading transactions...</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No transactions found. Add your first transaction to get started!
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="table-header">Date</th>
                <th className="table-header">Ticker</th>
                <th className="table-header">Type</th>
                <th className="table-header text-right">Quantity</th>
                <th className="table-header text-right">Price/Share</th>
                <th className="table-header text-right">Total</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="table-cell">{formatDate(transaction.transaction_date)}</td>
                  <td className="table-cell">
                    <span className="font-semibold">{transaction.ticker}</span>
                  </td>
                  <td className="table-cell">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        transaction.transaction_type === 'BUY'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {transaction.transaction_type}
                    </span>
                  </td>
                  <td className="table-cell text-right">{parseFloat(transaction.quantity).toFixed(4)}</td>
                  <td className="table-cell text-right">
                    {formatCurrency(parseFloat(transaction.price_per_share))}
                  </td>
                  <td className="table-cell text-right font-semibold">
                    {formatCurrency(
                      parseFloat(transaction.quantity) * parseFloat(transaction.price_per_share)
                    )}
                  </td>
                  <td className="table-cell text-right">
                    <button
                      onClick={() => handleEdit(transaction)}
                      className="text-primary-600 hover:text-primary-800 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(transaction.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TransactionList;

import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import TransactionForm from './components/TransactionForm';
import TransactionList from './components/TransactionList';
import PortfolioSummary from './components/PortfolioSummary';
import PerformanceChart from './components/PerformanceChart';

const Navigation = () => {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path;
  };

  const navLinkClass = (path) => {
    return `px-4 py-2 rounded-lg font-medium transition-colors ${
      isActive(path)
        ? 'bg-primary-600 text-white'
        : 'text-gray-700 hover:bg-gray-200'
    }`;
  };

  return (
    <nav className="bg-white shadow-md mb-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-bold text-primary-600">
              Stock Portfolio Tracker
            </Link>
          </div>
          <div className="flex space-x-2">
            <Link to="/" className={navLinkClass('/')}>
              Dashboard
            </Link>
            <Link to="/transactions" className={navLinkClass('/transactions')}>
              Transactions
            </Link>
            <Link to="/add-transaction" className={navLinkClass('/add-transaction')}>
              Add Transaction
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

const Dashboard = () => {
  return (
    <div className="space-y-8">
      <PortfolioSummary />
      <PerformanceChart />
    </div>
  );
};

const AddTransaction = () => {
  return (
    <div>
      <TransactionForm
        onTransactionAdded={() => {
          window.location.href = '/';
        }}
      />
    </div>
  );
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<TransactionList />} />
            <Route path="/add-transaction" element={<AddTransaction />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t mt-16">
          <div className="container mx-auto px-4 py-6 text-center text-gray-600 text-sm">
            <p>Stock Portfolio Tracker - Track your investments and monitor performance</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;

# Stock Portfolio Tracker

A full-stack web application to track stock purchases/sales and monitor portfolio performance over time with real-time price data.

## Features

- Add, edit, and delete stock transactions (buy/sell)
- Automatic calculation of holdings and cost basis
- Real-time stock price integration with caching
- Portfolio performance tracking over time
- Visual charts for performance and allocation
- Gains/losses calculation (unrealized)
- Responsive design for mobile and desktop

## Tech Stack

- **Frontend**: React with Vite, Tailwind CSS, Recharts
- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Stock API**: Alpha Vantage or Polygon.io
- **Deployment**: Render.com

## Project Structure

```
stock-learner/
├── backend/
│   ├── routes/
│   │   ├── transactions.js    # Transaction CRUD endpoints
│   │   ├── portfolio.js       # Portfolio calculation endpoints
│   │   └── stocks.js          # Stock price endpoints
│   ├── services/
│   │   └── stockPriceService.js  # Stock API integration
│   ├── db.js                  # PostgreSQL connection
│   ├── server.js              # Express server setup
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── TransactionForm.jsx
│   │   │   ├── TransactionList.jsx
│   │   │   ├── PortfolioSummary.jsx
│   │   │   └── PerformanceChart.jsx
│   │   ├── services/
│   │   │   └── api.js         # API client utility
│   │   ├── App.jsx            # Main app with routing
│   │   ├── main.jsx           # React entry point
│   │   └── index.css          # Tailwind CSS
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── database/
│   ├── schema.sql             # Database schema
│   └── seed.sql               # Sample data
└── README.md
```

## Local Development Setup

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Stock API key (Alpha Vantage or Polygon.io)

### 1. Database Setup

Install and start PostgreSQL, then create a database:

```bash
# Create database
createdb stock_portfolio

# Run schema migration
psql stock_portfolio < database/schema.sql

# Optional: Load sample data
psql stock_portfolio < database/seed.sql
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env and add your configuration:
# DATABASE_URL=postgresql://username:password@localhost:5432/stock_portfolio
# PORT=3001
# POLYGON_API_KEY=your_api_key_here
# STOCK_API_PROVIDER=polygon
# PRICE_CACHE_EXPIRATION=15

# Start the backend server
npm start

# Or use nodemon for development
npm run dev
```

The backend API will be available at `http://localhost:3001`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file (optional, uses proxy in development)
cp .env.example .env

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:3000`

### 4. Get a Stock API Key

#### Option 1: Polygon.io (Recommended)
1. Visit https://polygon.io/
2. Sign up for a free API key (5 calls/minute, more generous rate limits)
3. Add to your backend `.env` file:
   ```
   POLYGON_API_KEY=your_key_here
   STOCK_API_PROVIDER=polygon
   ```

#### Option 2: Alpha Vantage
1. Visit https://www.alphavantage.co/support/#api-key
2. Sign up for a free API key (25 requests/day)
3. Add to your backend `.env` file:
   ```
   ALPHA_VANTAGE_API_KEY=your_key_here
   STOCK_API_PROVIDER=alphavantage
   ```

## API Endpoints

### Transactions
- `GET /api/transactions` - Get all transactions
- `GET /api/transactions/:id` - Get single transaction
- `POST /api/transactions` - Create new transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Portfolio
- `GET /api/portfolio/summary` - Get current holdings and performance
- `GET /api/portfolio/performance` - Get historical performance data
- `GET /api/portfolio/allocation` - Get portfolio allocation by ticker

### Stock Prices
- `GET /api/stocks/:ticker/price` - Get current price for a ticker
- `POST /api/stocks/prices` - Get batch prices for multiple tickers

## Deployment to Render.com

### Prerequisites
1. Create a Render.com account
2. Have your code in a Git repository (GitHub, GitLab, or Bitbucket)

### Deployment Steps

#### Option 1: Using render.yaml (Recommended)

1. Push your code to a Git repository
2. Go to Render.com dashboard
3. Click "New" → "Blueprint"
4. Connect your repository
5. Render will automatically detect `render.yaml` and create all services
6. Add your `POLYGON_API_KEY` environment variable in the API service settings

#### Option 2: Manual Setup

**Database:**
1. Create a new PostgreSQL database on Render
2. Note the internal database URL

**Backend:**
1. Create a new Web Service
2. Connect your repository
3. Build command: `cd backend && npm install`
4. Start command: `cd backend && npm start`
5. Add environment variables:
   - `DATABASE_URL` (from your PostgreSQL database)
   - `POLYGON_API_KEY`
   - `STOCK_API_PROVIDER=polygon`
6. After deployment, run the schema:
   ```bash
   # Connect to your database and run:
   psql <your-database-url> < database/schema.sql
   ```

**Frontend:**
1. Create a new Static Site
2. Build command: `cd frontend && npm install && npm run build`
3. Publish directory: `frontend/dist`
4. Add environment variable:
   - `VITE_API_URL=https://your-backend-url.onrender.com/api`

## Usage Guide

### Adding Transactions
1. Navigate to "Add Transaction" in the navigation
2. Fill in the form:
   - Ticker symbol (e.g., AAPL)
   - Transaction type (Buy or Sell)
   - Date of transaction
   - Quantity of shares
   - Price per share
3. Click "Add Transaction"

### Viewing Portfolio
1. The Dashboard shows your current portfolio summary:
   - Total value
   - Total cost
   - Total gain/loss
   - Return percentage
2. Holdings table shows each stock with:
   - Current shares owned
   - Average cost basis
   - Current market price
   - Unrealized gain/loss

### Performance Charts
1. Timeline chart shows portfolio value over time
2. Allocation chart shows distribution across stocks
3. Toggle between views using the buttons

### Managing Transactions
1. Go to "Transactions" page
2. Use filters to find specific transactions
3. Edit or delete transactions as needed

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `pg_isready`
- Check your DATABASE_URL in `.env`
- Ensure database exists: `psql -l | grep stock_portfolio`

### API Rate Limits
- The app caches prices for 15 minutes to reduce API calls
- Free Polygon.io tier allows 5 calls/minute (generous for most use cases)
- Free Alpha Vantage tier allows 25 requests/day (more restrictive)
- Consider upgrading if you need more requests

### Frontend Not Connecting to Backend
- Verify backend is running on port 3001
- Check CORS settings in `backend/server.js`
- Ensure proxy is configured in `frontend/vite.config.js`

## Development Tips

- Use `npm run dev` in both frontend and backend for auto-reload
- Backend logs all API requests for debugging
- Check browser console for frontend errors
- Use sample data for testing: `psql stock_portfolio < database/seed.sql`

## Future Enhancements

- User authentication for multi-user support
- CSV import/export for transactions
- Dividend tracking
- Tax reporting (cost basis for capital gains)
- Portfolio diversification analysis
- Price alerts and notifications
- Support for cryptocurrency tracking

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Support

For issues and questions:
- Check the troubleshooting section above
- Review the API documentation
- Check backend logs for error messages
- Verify your stock API key is valid and has remaining quota

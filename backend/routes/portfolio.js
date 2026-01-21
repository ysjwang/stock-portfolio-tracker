const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { getBatchStockPrices } = require('../services/stockPriceService');

/**
 * Calculate holdings from transactions
 * Returns: { ticker: { quantity, totalCost, avgCostBasis } }
 */
const calculateHoldings = async () => {
  const result = await query(
    `SELECT ticker, transaction_type, quantity, price_per_share
     FROM transactions
     ORDER BY transaction_date ASC`
  );

  const holdings = {};

  for (const tx of result.rows) {
    const { ticker, transaction_type, quantity, price_per_share } = tx;
    const qty = parseFloat(quantity);
    const price = parseFloat(price_per_share);

    if (!holdings[ticker]) {
      holdings[ticker] = {
        quantity: 0,
        totalCost: 0,
        avgCostBasis: 0
      };
    }

    if (transaction_type === 'BUY') {
      holdings[ticker].totalCost += qty * price;
      holdings[ticker].quantity += qty;
    } else if (transaction_type === 'SELL') {
      // For sells, we reduce quantity but also reduce cost proportionally
      const costBasis = holdings[ticker].quantity > 0
        ? holdings[ticker].totalCost / holdings[ticker].quantity
        : 0;
      holdings[ticker].totalCost -= qty * costBasis;
      holdings[ticker].quantity -= qty;
    }

    // Calculate average cost basis
    if (holdings[ticker].quantity > 0) {
      holdings[ticker].avgCostBasis = holdings[ticker].totalCost / holdings[ticker].quantity;
    } else {
      holdings[ticker].avgCostBasis = 0;
    }
  }

  // Remove tickers with zero or negative quantity
  Object.keys(holdings).forEach(ticker => {
    if (holdings[ticker].quantity <= 0) {
      delete holdings[ticker];
    }
  });

  return holdings;
};

/**
 * Calculate portfolio performance over time
 */
const calculatePortfolioPerformance = async () => {
  // Get all transactions ordered by date
  const result = await query(
    `SELECT transaction_date, ticker, transaction_type, quantity, price_per_share
     FROM transactions
     ORDER BY transaction_date ASC`
  );

  const performanceData = [];
  const holdings = {};
  let totalInvested = 0;

  for (const tx of result.rows) {
    const { transaction_date, ticker, transaction_type, quantity, price_per_share } = tx;
    const qty = parseFloat(quantity);
    const price = parseFloat(price_per_share);

    if (!holdings[ticker]) {
      holdings[ticker] = { quantity: 0, avgCost: 0, totalCost: 0 };
    }

    if (transaction_type === 'BUY') {
      holdings[ticker].totalCost += qty * price;
      holdings[ticker].quantity += qty;
      totalInvested += qty * price;
    } else if (transaction_type === 'SELL') {
      const costBasis = holdings[ticker].quantity > 0
        ? holdings[ticker].totalCost / holdings[ticker].quantity
        : 0;
      holdings[ticker].totalCost -= qty * costBasis;
      holdings[ticker].quantity -= qty;
      totalInvested -= qty * costBasis;
    }

    // Recalculate average cost
    if (holdings[ticker].quantity > 0) {
      holdings[ticker].avgCost = holdings[ticker].totalCost / holdings[ticker].quantity;
    }

    // Calculate portfolio value at this point using cost basis
    let portfolioValue = 0;
    Object.keys(holdings).forEach(t => {
      if (holdings[t].quantity > 0) {
        portfolioValue += holdings[t].quantity * holdings[t].avgCost;
      }
    });

    performanceData.push({
      date: transaction_date,
      value: portfolioValue,
      invested: totalInvested
    });
  }

  return performanceData;
};

// GET /api/portfolio/summary - Get current portfolio summary
router.get('/summary', async (req, res, next) => {
  try {
    const holdings = await calculateHoldings();
    const tickers = Object.keys(holdings);

    if (tickers.length === 0) {
      return res.json({
        success: true,
        data: {
          holdings: [],
          totalValue: 0,
          totalCost: 0,
          totalGainLoss: 0,
          totalGainLossPercent: 0
        }
      });
    }

    // Fetch current prices
    const { prices, errors } = await getBatchStockPrices(tickers);

    // Calculate portfolio summary
    const holdingsSummary = [];
    let totalValue = 0;
    let totalCost = 0;

    for (const ticker of tickers) {
      const holding = holdings[ticker];
      const currentPrice = prices[ticker];

      if (!currentPrice) {
        console.warn(`No price available for ${ticker}, skipping`);
        continue;
      }

      const marketValue = holding.quantity * currentPrice;
      const gainLoss = marketValue - holding.totalCost;
      const gainLossPercent = (gainLoss / holding.totalCost) * 100;

      holdingsSummary.push({
        ticker,
        quantity: holding.quantity,
        avgCostBasis: holding.avgCostBasis,
        currentPrice: currentPrice,
        marketValue: marketValue,
        totalCost: holding.totalCost,
        gainLoss: gainLoss,
        gainLossPercent: gainLossPercent
      });

      totalValue += marketValue;
      totalCost += holding.totalCost;
    }

    const totalGainLoss = totalValue - totalCost;
    const totalGainLossPercent = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

    res.json({
      success: true,
      data: {
        holdings: holdingsSummary,
        totalValue: totalValue,
        totalCost: totalCost,
        totalGainLoss: totalGainLoss,
        totalGainLossPercent: totalGainLossPercent,
        priceErrors: Object.keys(errors).length > 0 ? errors : undefined,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/portfolio/performance - Get historical portfolio performance
router.get('/performance', async (req, res, next) => {
  try {
    const performanceData = await calculatePortfolioPerformance();

    // If we have current holdings, add current value as latest data point
    const holdings = await calculateHoldings();
    const tickers = Object.keys(holdings);

    if (tickers.length > 0) {
      const { prices } = await getBatchStockPrices(tickers);

      let currentValue = 0;
      let currentInvested = 0;

      Object.keys(holdings).forEach(ticker => {
        const holding = holdings[ticker];
        if (prices[ticker]) {
          currentValue += holding.quantity * prices[ticker];
          currentInvested += holding.totalCost;
        }
      });

      // Add current date with current values
      performanceData.push({
        date: new Date().toISOString().split('T')[0],
        value: currentValue,
        invested: currentInvested
      });
    }

    res.json({
      success: true,
      data: performanceData
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/portfolio/allocation - Get portfolio allocation by ticker
router.get('/allocation', async (req, res, next) => {
  try {
    const holdings = await calculateHoldings();
    const tickers = Object.keys(holdings);

    if (tickers.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Fetch current prices
    const { prices } = await getBatchStockPrices(tickers);

    // Calculate total portfolio value
    let totalValue = 0;
    const allocation = [];

    for (const ticker of tickers) {
      const holding = holdings[ticker];
      const currentPrice = prices[ticker];

      if (!currentPrice) continue;

      const marketValue = holding.quantity * currentPrice;
      totalValue += marketValue;

      allocation.push({
        ticker,
        marketValue,
        quantity: holding.quantity
      });
    }

    // Calculate percentages
    allocation.forEach(item => {
      item.percentage = totalValue > 0 ? (item.marketValue / totalValue) * 100 : 0;
    });

    // Sort by market value descending
    allocation.sort((a, b) => b.marketValue - a.marketValue);

    res.json({
      success: true,
      data: allocation
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

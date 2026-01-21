const express = require('express');
const router = express.Router();
const { getStockPrice, getBatchStockPrices } = require('../services/stockPriceService');

// GET /api/stocks/:ticker/price - Get current price for a single stock
router.get('/:ticker/price', async (req, res, next) => {
  try {
    const { ticker } = req.params;
    const { refresh } = req.query;

    const forceRefresh = refresh === 'true';
    const price = await getStockPrice(ticker, forceRefresh);

    res.json({
      success: true,
      data: {
        ticker: ticker.toUpperCase(),
        price: price,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/stocks/prices - Get prices for multiple stocks
router.post('/prices', async (req, res, next) => {
  try {
    const { tickers } = req.body;

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'tickers array is required'
      });
    }

    if (tickers.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 20 tickers allowed per request'
      });
    }

    const { prices, errors } = await getBatchStockPrices(tickers);

    res.json({
      success: true,
      data: {
        prices,
        errors: Object.keys(errors).length > 0 ? errors : undefined,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

const axios = require('axios');
const { query } = require('../db');

// Cache expiration in minutes (default: 15 minutes)
const CACHE_EXPIRATION_MINUTES = parseInt(process.env.PRICE_CACHE_EXPIRATION) || 15;

/**
 * Fetch stock price from Alpha Vantage API
 */
const fetchFromAlphaVantage = async (ticker) => {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error('ALPHA_VANTAGE_API_KEY not configured');
  }

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${apiKey}`;

  try {
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;

    // Check for API error messages
    if (data['Error Message']) {
      throw new Error(`Invalid ticker symbol: ${ticker}`);
    }

    if (data['Note']) {
      throw new Error('API rate limit reached. Please try again later.');
    }

    const quote = data['Global Quote'];
    if (!quote || !quote['05. price']) {
      throw new Error(`No price data available for ${ticker}`);
    }

    return parseFloat(quote['05. price']);
  } catch (error) {
    if (error.response) {
      throw new Error(`API error: ${error.response.status}`);
    }
    throw error;
  }
};

/**
 * Fetch stock price from Polygon.io API
 */
const fetchFromPolygon = async (ticker) => {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    throw new Error('POLYGON_API_KEY not configured');
  }

  // Get previous trading day's close price
  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${apiKey}`;

  try {
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;

    if (data.status === 'ERROR' || !data.results || data.results.length === 0) {
      throw new Error(`No price data available for ${ticker}`);
    }

    // Return the close price
    return parseFloat(data.results[0].c);
  } catch (error) {
    if (error.response) {
      throw new Error(`API error: ${error.response.status}`);
    }
    throw error;
  }
};

/**
 * Fetch historical stock price from Polygon.io API by date
 * If the exact date is not available (weekend/holiday), fall back to the nearest previous trading day
 */
const fetchHistoricalFromPolygon = async (ticker, date) => {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    throw new Error('POLYGON_API_KEY not configured');
  }

  // Format date as YYYY-MM-DD
  const dateStr = date.split('T')[0];
  let currentDate = new Date(dateStr);

  // Try up to 10 days back to find a trading day
  for (let i = 0; i < 10; i++) {
    const tryDateStr = currentDate.toISOString().split('T')[0];
    const url = `https://api.polygon.io/v1/open-close/${ticker}/${tryDateStr}?adjusted=true&apiKey=${apiKey}`;

    try {
      const response = await axios.get(url, { timeout: 10000 });
      const data = response.data;

      if (data.status !== 'ERROR' && data.status !== 'NOT_FOUND' && data.close) {
        // Log if we had to fall back to a different date
        if (i > 0) {
          console.log(`No data for ${ticker} on ${dateStr}, using ${tryDateStr} instead`);
        }
        // Return the close price
        return parseFloat(data.close);
      }
    } catch (error) {
      // If 404, try previous day; otherwise throw
      if (!error.response || error.response.status !== 404) {
        throw new Error(`API error: ${error.response?.status || error.message}`);
      }
    }

    // Move to previous day
    currentDate.setDate(currentDate.getDate() - 1);
  }

  throw new Error(`No price data available for ${ticker} around ${dateStr} (checked 10 days back)`);
};

/**
 * Fetch historical stock price from Alpha Vantage API by date
 * If the exact date is not available (weekend/holiday), fall back to the nearest previous trading day
 */
const fetchHistoricalFromAlphaVantage = async (ticker, date) => {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error('ALPHA_VANTAGE_API_KEY not configured');
  }

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${apiKey}`;

  try {
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;

    // Check for API error messages
    if (data['Error Message']) {
      throw new Error(`Invalid ticker symbol: ${ticker}`);
    }

    if (data['Note']) {
      throw new Error('API rate limit reached. Please try again later.');
    }

    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) {
      throw new Error(`No historical data available for ${ticker}`);
    }

    // Format date as YYYY-MM-DD and try to find nearest previous trading day
    const dateStr = date.split('T')[0];
    let currentDate = new Date(dateStr);

    // Try up to 10 days back to find a trading day
    for (let i = 0; i < 10; i++) {
      const tryDateStr = currentDate.toISOString().split('T')[0];
      const dayData = timeSeries[tryDateStr];

      if (dayData && dayData['4. close']) {
        // Log if we had to fall back to a different date
        if (i > 0) {
          console.log(`No data for ${ticker} on ${dateStr}, using ${tryDateStr} instead`);
        }
        return parseFloat(dayData['4. close']);
      }

      // Move to previous day
      currentDate.setDate(currentDate.getDate() - 1);
    }

    throw new Error(`No price data available for ${ticker} around ${dateStr} (checked 10 days back)`);
  } catch (error) {
    if (error.response) {
      throw new Error(`API error: ${error.response.status}`);
    }
    throw error;
  }
};

/**
 * Get cached price from database
 */
const getCachedPrice = async (ticker) => {
  try {
    const result = await query(
      `SELECT current_price, last_updated
       FROM price_cache
       WHERE ticker = $1`,
      [ticker.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const { current_price, last_updated } = result.rows[0];
    const cacheAge = (Date.now() - new Date(last_updated).getTime()) / 1000 / 60; // in minutes

    // Return cached price if it's fresh enough
    if (cacheAge < CACHE_EXPIRATION_MINUTES) {
      console.log(`Cache hit for ${ticker} (age: ${cacheAge.toFixed(1)} minutes)`);
      return parseFloat(current_price);
    }

    console.log(`Cache expired for ${ticker} (age: ${cacheAge.toFixed(1)} minutes)`);
    return null;
  } catch (error) {
    console.error('Error reading price cache:', error);
    return null;
  }
};

/**
 * Update price cache in database
 */
const updatePriceCache = async (ticker, price) => {
  try {
    await query(
      `INSERT INTO price_cache (ticker, current_price, last_updated)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (ticker)
       DO UPDATE SET current_price = $2, last_updated = CURRENT_TIMESTAMP`,
      [ticker.toUpperCase(), price]
    );
    console.log(`Updated cache for ${ticker}: $${price}`);
  } catch (error) {
    console.error('Error updating price cache:', error);
  }
};

/**
 * Get stock price (with caching)
 * @param {string} ticker - Stock ticker symbol
 * @param {boolean} forceRefresh - Force refresh even if cached
 * @returns {Promise<number>} Current stock price
 */
const getStockPrice = async (ticker, forceRefresh = false) => {
  const upperTicker = ticker.toUpperCase();

  // Check cache first unless force refresh
  if (!forceRefresh) {
    const cachedPrice = await getCachedPrice(upperTicker);
    if (cachedPrice !== null) {
      return cachedPrice;
    }
  }

  // Fetch fresh price from API
  const provider = process.env.STOCK_API_PROVIDER || 'alphavantage';
  let price;

  try {
    if (provider === 'polygon') {
      price = await fetchFromPolygon(upperTicker);
    } else {
      price = await fetchFromAlphaVantage(upperTicker);
    }

    // Update cache
    await updatePriceCache(upperTicker, price);

    return price;
  } catch (error) {
    console.error(`Error fetching price for ${upperTicker}:`, error.message);

    // Try to return cached price as fallback, even if expired
    const fallbackPrice = await getCachedPrice(upperTicker);
    if (fallbackPrice !== null) {
      console.log(`Using expired cache for ${upperTicker} as fallback`);
      return fallbackPrice;
    }

    throw error;
  }
};

/**
 * Get multiple stock prices in batch
 * @param {string[]} tickers - Array of stock ticker symbols
 * @returns {Promise<Object>} Object with ticker: price mappings
 */
const getBatchStockPrices = async (tickers) => {
  const uniqueTickers = [...new Set(tickers.map(t => t.toUpperCase()))];
  const prices = {};
  const errors = {};

  // Fetch prices sequentially to respect rate limits
  for (const ticker of uniqueTickers) {
    try {
      prices[ticker] = await getStockPrice(ticker);
      // Add a small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Failed to fetch price for ${ticker}:`, error.message);
      errors[ticker] = error.message;
    }
  }

  return { prices, errors };
};

/**
 * Get historical stock price for a specific date
 * @param {string} ticker - Stock ticker symbol
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<number>} Historical closing price
 */
const getHistoricalPrice = async (ticker, date) => {
  const upperTicker = ticker.toUpperCase();
  const provider = process.env.STOCK_API_PROVIDER || 'alphavantage';

  try {
    if (provider === 'polygon') {
      return await fetchHistoricalFromPolygon(upperTicker, date);
    } else {
      return await fetchHistoricalFromAlphaVantage(upperTicker, date);
    }
  } catch (error) {
    console.error(`Error fetching historical price for ${upperTicker} on ${date}:`, error.message);
    throw error;
  }
};

module.exports = {
  getStockPrice,
  getBatchStockPrices,
  getCachedPrice,
  updatePriceCache,
  getHistoricalPrice
};

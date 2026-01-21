const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/transactions - Get all transactions
router.get('/', async (req, res, next) => {
  try {
    const { ticker, type, sort_by = 'transaction_date', order = 'DESC' } = req.query;

    let queryText = 'SELECT * FROM transactions WHERE 1=1';
    const queryParams = [];
    let paramCounter = 1;

    // Filter by ticker if provided
    if (ticker) {
      queryText += ` AND ticker = $${paramCounter}`;
      queryParams.push(ticker.toUpperCase());
      paramCounter++;
    }

    // Filter by transaction type if provided
    if (type) {
      queryText += ` AND transaction_type = $${paramCounter}`;
      queryParams.push(type.toUpperCase());
      paramCounter++;
    }

    // Add sorting
    const validSortColumns = ['transaction_date', 'ticker', 'quantity', 'price_per_share', 'created_at'];
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'transaction_date';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    queryText += ` ORDER BY ${sortColumn} ${sortOrder}`;

    const result = await query(queryText, queryParams);
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/transactions/:id - Get single transaction
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM transactions WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/transactions - Create new transaction
router.post('/', async (req, res, next) => {
  try {
    const { ticker, transaction_type, transaction_date, quantity, price_per_share } = req.body;

    // Validation
    if (!ticker || !transaction_type || !transaction_date || !quantity || !price_per_share) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: ticker, transaction_type, transaction_date, quantity, price_per_share'
      });
    }

    if (!['BUY', 'SELL'].includes(transaction_type.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'transaction_type must be either BUY or SELL'
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'quantity must be greater than 0'
      });
    }

    if (price_per_share <= 0) {
      return res.status(400).json({
        success: false,
        error: 'price_per_share must be greater than 0'
      });
    }

    const result = await query(
      `INSERT INTO transactions (ticker, transaction_type, transaction_date, quantity, price_per_share)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [ticker.toUpperCase(), transaction_type.toUpperCase(), transaction_date, quantity, price_per_share]
    );

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/transactions/:id - Update transaction
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { ticker, transaction_type, transaction_date, quantity, price_per_share } = req.body;

    // Check if transaction exists
    const checkResult = await query('SELECT * FROM transactions WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    // Validation
    if (transaction_type && !['BUY', 'SELL'].includes(transaction_type.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'transaction_type must be either BUY or SELL'
      });
    }

    if (quantity !== undefined && quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'quantity must be greater than 0'
      });
    }

    if (price_per_share !== undefined && price_per_share <= 0) {
      return res.status(400).json({
        success: false,
        error: 'price_per_share must be greater than 0'
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCounter = 1;

    if (ticker) {
      updates.push(`ticker = $${paramCounter}`);
      values.push(ticker.toUpperCase());
      paramCounter++;
    }
    if (transaction_type) {
      updates.push(`transaction_type = $${paramCounter}`);
      values.push(transaction_type.toUpperCase());
      paramCounter++;
    }
    if (transaction_date) {
      updates.push(`transaction_date = $${paramCounter}`);
      values.push(transaction_date);
      paramCounter++;
    }
    if (quantity) {
      updates.push(`quantity = $${paramCounter}`);
      values.push(quantity);
      paramCounter++;
    }
    if (price_per_share) {
      updates.push(`price_per_share = $${paramCounter}`);
      values.push(price_per_share);
      paramCounter++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    values.push(id);
    const updateQuery = `UPDATE transactions SET ${updates.join(', ')} WHERE id = $${paramCounter} RETURNING *`;

    const result = await query(updateQuery, values);

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/transactions/:id - Delete transaction
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM transactions WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

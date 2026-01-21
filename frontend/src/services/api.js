import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Transaction API
export const transactionApi = {
  getAll: (params = {}) => api.get('/transactions', { params }),
  getById: (id) => api.get(`/transactions/${id}`),
  create: (data) => api.post('/transactions', data),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  delete: (id) => api.delete(`/transactions/${id}`),
};

// Portfolio API
export const portfolioApi = {
  getSummary: () => api.get('/portfolio/summary'),
  getPerformance: () => api.get('/portfolio/performance'),
  getAllocation: () => api.get('/portfolio/allocation'),
};

// Stock API
export const stockApi = {
  getPrice: (ticker, refresh = false) =>
    api.get(`/stocks/${ticker}/price`, { params: { refresh } }),
  getBatchPrices: (tickers) =>
    api.post('/stocks/prices', { tickers }),
  getHistoricalPrice: (ticker, date) =>
    api.get(`/stocks/${ticker}/historical/${date}`),
};

export default api;

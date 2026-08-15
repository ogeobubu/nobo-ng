import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { checkout, listOrders } from './services/orders.js';
import { listProducts } from './services/products.js';

export const createApp = () => {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/products', async (_req, res, next) => {
    try {
      const products = await listProducts();
      res.json({ products });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/checkout', async (req, res, next) => {
    try {
      const result = await checkout(req.body);

      if (result.error) {
        return res.status(result.status || 400).json(result.payload || {
          success: false,
          message: result.error
        });
      }

      return res.status(201).json(result.payload);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/orders', async (_req, res, next) => {
    try {
      const orders = await listOrders();
      res.json({ orders });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  });

  return app;
};

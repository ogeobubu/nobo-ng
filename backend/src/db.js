import mysql from 'mysql2/promise';
import { config } from './config.js';
import { initialProducts } from './catalog.js';

let pool;

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const createSchema = async (connection) => {
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.changeUser({ database: config.dbName });

  await connection.query(`
    CREATE TABLE IF NOT EXISTS products (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price INT NOT NULL,
      stock INT NOT NULL,
      image LONGTEXT NOT NULL,
      description TEXT NOT NULL,
      eta VARCHAR(64) NOT NULL,
      category VARCHAR(64) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      order_number VARCHAR(32) NOT NULL UNIQUE,
      customer_name VARCHAR(255) NOT NULL,
      customer_email VARCHAR(255) NOT NULL,
      customer_address VARCHAR(255) NOT NULL,
      customer_phone VARCHAR(32) NOT NULL,
      subtotal INT NOT NULL,
      shipping_cost INT NOT NULL,
      total INT NOT NULL,
      amount_paid INT NOT NULL,
      payment_status ENUM('success', 'failed') NOT NULL DEFAULT 'success',
      status VARCHAR(32) NOT NULL DEFAULT 'Processing',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      order_id BIGINT UNSIGNED NOT NULL,
      product_id VARCHAR(64) NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      quantity INT NOT NULL,
      unit_price INT NOT NULL,
      line_total INT NOT NULL,
      image LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE
    )
  `);

  const [productCountRows] = await connection.query('SELECT COUNT(*) AS count FROM products');
  if (productCountRows[0].count === 0) {
    for (const product of initialProducts) {
      await connection.query(
        `
          INSERT INTO products (id, name, price, stock, image, description, eta, category)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          product.id,
          product.name,
          product.price,
          product.stock,
          product.image,
          product.description,
          product.eta,
          product.category
        ]
      );
    }
  }
};

export const initializeDatabase = async ({ retries = 10, retryDelayMs = 2000 } = {}) => {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const bootstrapConnection = await mysql.createConnection({
        host: config.dbHost,
        port: config.dbPort,
        user: config.dbUser,
        password: config.dbPassword
      });

      try {
        await createSchema(bootstrapConnection);
      } finally {
        await bootstrapConnection.end();
      }

      pool = mysql.createPool({
        host: config.dbHost,
        port: config.dbPort,
        user: config.dbUser,
        password: config.dbPassword,
        database: config.dbName,
        connectionLimit: config.dbConnectionLimit,
        waitForConnections: true,
        namedPlaceholders: true
      });

      return;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await delay(retryDelayMs);
      }
    }
  }

  throw lastError;
};

export const getPool = () => {
  if (!pool) {
    throw new Error('Database has not been initialized.');
  }

  return pool;
};

export const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
};

import { getPool } from '../db.js';

export const listProducts = async () => {
  const pool = getPool();
  const [rows] = await pool.query(`
    SELECT
      id,
      name,
      price,
      stock,
      image,
      description,
      eta,
      category
    FROM products
    ORDER BY name ASC
  `);

  return rows;
};

export const getProductsByIds = async (productIds) => {
  if (productIds.length === 0) return [];

  const pool = getPool();
  const placeholders = productIds.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `
      SELECT
        id,
        name,
        price,
        stock,
        image,
        description,
        eta,
        category
      FROM products
      WHERE id IN (${placeholders})
    `,
    productIds
  );

  return rows;
};

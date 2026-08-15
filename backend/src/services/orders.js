import { getPool } from '../db.js';
import { getProductsByIds } from './products.js';

const shippingThreshold = 60000;
const shippingCost = 3200;

const sanitizePhone = (value) => String(value || '').replace(/\D/g, '').slice(0, 11);

const validateCheckoutRequest = (body) => {
  if (!body || typeof body !== 'object') {
    return 'Request body is required.';
  }

  const { customer, items, paymentStatus } = body;

  if (!customer || !customer.name || !customer.email || !customer.address || !customer.phone) {
    return 'Customer details are incomplete.';
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(customer.email)) {
    return 'A valid email address is required.';
  }

  if (!customer.name.trim() || customer.name.trim().length < 2) {
    return 'Customer name must be at least 2 characters long.';
  }

  if (sanitizePhone(customer.phone).length < 11) {
    return 'A valid Nigerian phone number is required.';
  }

  if (!Array.isArray(items) || items.length === 0) {
    return 'At least one cart item is required.';
  }

  if (!['success', 'failed'].includes(paymentStatus)) {
    return 'Payment status must be success or failed.';
  }

  return null;
};

const calculateShipping = (subtotal) => (subtotal >= shippingThreshold ? 0 : shippingCost);

export const checkout = async (body) => {
  const validationError = validateCheckoutRequest(body);
  if (validationError) {
    return { error: validationError, status: 400 };
  }

  const customer = {
    name: String(body.customer.name).trim(),
    email: String(body.customer.email).trim(),
    address: String(body.customer.address).trim(),
    phone: sanitizePhone(body.customer.phone)
  };

  const requestedItems = body.items.map((item) => ({
    id: String(item.id || ''),
    quantity: Number(item.quantity || 0)
  }));

  const productIds = requestedItems.map((item) => item.id);
  const catalogItems = await getProductsByIds(productIds);
  const productsById = new Map(catalogItems.map((product) => [product.id, product]));

  const cartItems = [];
  let subtotal = 0;

  for (const item of requestedItems) {
    const product = productsById.get(item.id);
    if (!product) {
      return { error: `Product not found: ${item.id}`, status: 400 };
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      return { error: `Invalid quantity for ${product.name}`, status: 400 };
    }

    if (item.quantity > product.stock) {
      return {
        error: `Only ${product.stock} units of ${product.name} are available.`,
        status: 400
      };
    }

    const lineTotal = product.price * item.quantity;
    subtotal += lineTotal;
    cartItems.push({
      id: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPrice: product.price,
      lineTotal,
      image: product.image
    });
  }

  const shipping = calculateShipping(subtotal);
  const total = subtotal + shipping;

  if (body.paymentStatus === 'failed') {
    return {
      error: 'Payment failed. Please retry payment.',
      status: 402,
      payload: { success: false, message: 'Payment failed. Please retry payment.', total }
    };
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    for (const item of cartItems) {
      const [updateResult] = await connection.query(
        `
          UPDATE products
          SET stock = stock - ?
          WHERE id = ? AND stock >= ?
        `,
        [item.quantity, item.id, item.quantity]
      );

      if (updateResult.affectedRows !== 1) {
        throw new Error(`Inventory changed while checking out ${item.name}. Please try again.`);
      }
    }

    const [orderInsert] = await connection.query(
      `
        INSERT INTO orders (
          order_number,
          customer_name,
          customer_email,
          customer_address,
          customer_phone,
          subtotal,
          shipping_cost,
          total,
          amount_paid,
          payment_status,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        'PENDING',
        customer.name,
        customer.email,
        customer.address,
        customer.phone,
        subtotal,
        shipping,
        total,
        total,
        'success',
        'Processing'
      ]
    );

    const orderId = orderInsert.insertId;
    const orderNumber = `NBO-${String(orderId).padStart(5, '0')}`;

    await connection.query('UPDATE orders SET order_number = ? WHERE id = ?', [orderNumber, orderId]);

    for (const item of cartItems) {
      await connection.query(
        `
          INSERT INTO order_items (
            order_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            line_total,
            image
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [orderId, item.id, item.name, item.quantity, item.unitPrice, item.lineTotal, item.image]
      );
    }

    await connection.commit();

    const [orderRows] = await connection.query(
      `
        SELECT
          id,
          order_number AS orderNumber,
          customer_name AS customerName,
          customer_email AS customerEmail,
          customer_address AS customerAddress,
          customer_phone AS customerPhone,
          subtotal,
          shipping_cost AS shippingCost,
          total,
          amount_paid AS amountPaid,
          payment_status AS paymentStatus,
          status,
          created_at AS createdAt
        FROM orders
        WHERE id = ?
      `,
      [orderId]
    );

    const [itemRows] = await connection.query(
      `
        SELECT
          id AS itemId,
          product_id AS id,
          product_name AS name,
          quantity,
          unit_price AS unitPrice,
          line_total AS lineTotal,
          image
        FROM order_items
        WHERE order_id = ?
        ORDER BY itemId ASC
      `,
      [orderId]
    );

    const order = {
      id: Number(orderRows[0].id),
      orderNumber: orderRows[0].orderNumber,
      customer: {
        name: orderRows[0].customerName,
        email: orderRows[0].customerEmail,
        address: orderRows[0].customerAddress,
        phone: orderRows[0].customerPhone
      },
      items: itemRows,
      subtotal: Number(orderRows[0].subtotal),
      shippingCost: Number(orderRows[0].shippingCost),
      total: Number(orderRows[0].total),
      amountPaid: Number(orderRows[0].amountPaid),
      paymentStatus: orderRows[0].paymentStatus,
      status: orderRows[0].status,
      createdAt: orderRows[0].createdAt
    };

    return {
      payload: {
        success: true,
        message: 'Payment successful. Order created.',
        order
      }
    };
  } catch (error) {
    await connection.rollback();
    return {
      error: error.message || 'Something went wrong while creating the order.',
      status: 500,
      payload: {
        success: false,
        message: error.message || 'Something went wrong while creating the order.'
      }
    };
  } finally {
    connection.release();
  }
};

export const listOrders = async () => {
  const pool = getPool();
  const [rows] = await pool.query(`
    SELECT
      id,
      order_number AS orderNumber,
      customer_name AS customerName,
      customer_email AS customerEmail,
      customer_address AS customerAddress,
      customer_phone AS customerPhone,
      subtotal,
      shipping_cost AS shippingCost,
      total,
      amount_paid AS amountPaid,
      payment_status AS paymentStatus,
      status,
      created_at AS createdAt
    FROM orders
    ORDER BY created_at DESC
    LIMIT 20
  `);

  return rows.map((order) => ({
    id: Number(order.id),
    orderNumber: order.orderNumber,
    customer: {
      name: order.customerName,
      email: order.customerEmail,
      address: order.customerAddress,
      phone: order.customerPhone
    },
    subtotal: Number(order.subtotal),
    shippingCost: Number(order.shippingCost),
    total: Number(order.total),
    amountPaid: Number(order.amountPaid),
    paymentStatus: order.paymentStatus,
    status: order.status,
    createdAt: order.createdAt
  }));
};

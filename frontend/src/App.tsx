import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { getProducts, submitCheckout } from './api';
import type { CartEntry, CustomerForm, Order, Product } from './types';

const SHIPPING_THRESHOLD = 60000;
const SHIPPING_FEE = 3200;

const currency = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0
});

const emptyCustomer: CustomerForm = {
  name: '',
  email: '',
  phone: '',
  address: ''
};

const formatCurrency = (value: number) => currency.format(value);

const getItemQuantity = (cart: CartEntry[], id: string) => cart.find((entry) => entry.id === id)?.quantity || 0;

export const App = () => {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [customer, setCustomer] = useState<CustomerForm>(emptyCustomer);
  const [latestOrder, setLatestOrder] = useState<Order | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ tone: 'idle' | 'success' | 'error'; text: string }>({
    tone: 'idle',
    text: 'Add a product to start building your order.'
  });

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
    staleTime: 1000 * 60 * 5
  });

  const products = productsQuery.data ?? [];
  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const subtotal = cart.reduce((sum, item) => {
    const product = productsById.get(item.id);
    return product ? sum + product.price * item.quantity : sum;
  }, 0);

  const shippingCost = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = subtotal + shippingCost;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const checkoutMutation = useMutation({
    mutationFn: submitCheckout,
    onSuccess: async (data) => {
      if (data.order) {
        setLatestOrder(data.order);
        setCart([]);
        setStatusMessage({
          tone: 'success',
          text: `Payment successful. Order ${data.order.orderNumber} is now being processed.`
        });
        setCustomer(emptyCustomer);
        await queryClient.invalidateQueries({ queryKey: ['products'] });
        return;
      }

      setStatusMessage({
        tone: 'error',
        text: data.message || 'Payment failed. Please retry.'
      });
    },
    onError: (error) => {
      setStatusMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'A network error occurred while processing payment.'
      });
    }
  });

  const addToCart = (product: Product) => {
    const currentQuantity = getItemQuantity(cart, product.id);

    if (currentQuantity >= product.stock) {
      setStatusMessage({
        tone: 'error',
        text: `Only ${product.stock} units of ${product.name} are available.`
      });
      return;
    }

    setCart((currentCart) => {
      const existing = currentCart.find((entry) => entry.id === product.id);
      if (existing) {
        return currentCart.map((entry) =>
          entry.id === product.id ? { ...entry, quantity: entry.quantity + 1 } : entry
        );
      }

      return [...currentCart, { id: product.id, quantity: 1 }];
    });

    setStatusMessage({
      tone: 'idle',
      text: `${product.name} added to your cart.`
    });
  };

  const changeQuantity = (productId: string, delta: number) => {
    setCart((currentCart) =>
      currentCart
        .map((entry) => (entry.id === productId ? { ...entry, quantity: entry.quantity + delta } : entry))
        .filter((entry) => entry.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((currentCart) => currentCart.filter((entry) => entry.id !== productId));
  };

  const handleCustomerChange = (field: keyof CustomerForm, value: string) => {
    setCustomer((current) => ({ ...current, [field]: value }));
  };

  const handleCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (cart.length === 0) {
      setStatusMessage({
        tone: 'error',
        text: 'Add at least one product before checking out.'
      });
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const paymentStatus = submitter?.value === 'failed' ? 'failed' : 'success';

    checkoutMutation.mutate({
      customer,
      items: cart,
      paymentStatus
    });
  };

  const cartLines = cart
    .map((entry) => {
      const product = productsById.get(entry.id);
      if (!product) return null;

      return {
        ...entry,
        product,
        lineTotal: product.price * entry.quantity
      };
    })
    .filter((entry): entry is { id: string; quantity: number; product: Product; lineTotal: number } => Boolean(entry));

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">N</div>
          <div>
            <div className="brand-name">NoboNG</div>
            <small>React + TypeScript storefront on MySQL</small>
          </div>
        </div>
        <div className="status-pill">Node API · React Query · MySQL</div>
      </header>

      <main className="page-shell">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">Cross-border commerce</span>
            <h1>A storefront built for a modern full-stack deployment.</h1>
            <p>
              Browse products, manage your cart, and submit orders through a Node.js REST API
              backed by MySQL.
            </p>
            <div className="hero-stats">
              <div>
                <strong>{products.length}</strong>
                <span>catalog items</span>
              </div>
              <div>
                <strong>{formatCurrency(SHIPPING_THRESHOLD)}</strong>
                <span>free shipping threshold</span>
              </div>
              <div>
                <strong>{itemCount}</strong>
                <span>items in cart</span>
              </div>
            </div>
          </div>
          <div className="hero-card">
            <div className="hero-card-label">Deployment shape</div>
            <p>Frontend: Vite + React + TypeScript + React Query</p>
            <p>Backend: Node.js REST API + MySQL transactions</p>
            <p>Payments: simulated checkout flow for assessment purposes</p>
          </div>
        </section>

        <section className="catalog-section">
          <div className="section-head">
            <div>
              <span className="section-kicker">Catalog</span>
              <h2>Featured products</h2>
            </div>
            <p>Inventory and order placement come from the API, not from local mock state.</p>
          </div>

          {productsQuery.isLoading ? <div className="state-card">Loading catalog...</div> : null}
          {productsQuery.isError ? (
            <div className="state-card error">
              {productsQuery.error instanceof Error ? productsQuery.error.message : 'Failed to load products.'}
            </div>
          ) : null}

          <div className="product-grid">
            {products.map((product) => (
              <article key={product.id} className="product-card">
                <img src={product.image} alt={product.name} />
                <div className="product-body">
                  <div className="product-meta">
                    <div>
                      <h3>{product.name}</h3>
                      <div className="product-category">{product.category}</div>
                    </div>
                    <div className="price-tag">{formatCurrency(product.price)}</div>
                  </div>
                  <p className="product-description">{product.description}</p>
                  <div className="product-foot">
                    <span>{product.stock} in stock</span>
                    <span>{product.eta}</span>
                  </div>
                  <button className="primary" type="button" onClick={() => addToCart(product)}>
                    Add to cart
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="checkout-grid">
          <aside className="panel cart-panel">
            <div className="panel-head">
              <div>
                <span className="section-kicker">Cart</span>
                <h3>Your items</h3>
              </div>
              <div className="mini-pill">{itemCount} item{itemCount === 1 ? '' : 's'}</div>
            </div>

            {cartLines.length === 0 ? (
              <div className="empty-state">Your cart is empty. Add products to start checkout.</div>
            ) : (
              <div className="cart-list">
                {cartLines.map(({ product, quantity, lineTotal }) => (
                  <div key={product.id} className="cart-item">
                    <img src={product.image} alt={product.name} />
                    <div className="cart-item-body">
                      <div className="cart-item-top">
                        <strong>{product.name}</strong>
                        <span>{formatCurrency(lineTotal)}</span>
                      </div>
                      <p>{formatCurrency(product.price)} each</p>
                      <div className="qty-controls">
                        <button type="button" onClick={() => changeQuantity(product.id, -1)}>
                          -
                        </button>
                        <span>{quantity}</span>
                        <button type="button" onClick={() => changeQuantity(product.id, 1)}>
                          +
                        </button>
                        <button type="button" className="link-btn" onClick={() => removeFromCart(product.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="totals">
              <div>
                <span>Subtotal</span>
                <strong>{formatCurrency(subtotal)}</strong>
              </div>
              <div>
                <span>Shipping</span>
                <strong>{formatCurrency(shippingCost)}</strong>
              </div>
              <div className="grand-total">
                <span>Total</span>
                <strong>{formatCurrency(total)}</strong>
              </div>
            </div>
          </aside>

          <section className="panel checkout-panel">
            <div className="panel-head">
              <div>
                <span className="section-kicker">Checkout</span>
                <h3>Customer details</h3>
              </div>
              <div className="mini-pill">MySQL-backed orders</div>
            </div>

            <form className="checkout-form" onSubmit={handleCheckout}>
              <div className="field-grid">
                <label>
                  Full name
                  <input
                    type="text"
                    value={customer.name}
                    onChange={(event) => handleCustomerChange('name', event.target.value)}
                    placeholder="Oge Okafor"
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={customer.email}
                    onChange={(event) => handleCustomerChange('email', event.target.value)}
                    placeholder="oge@example.com"
                    required
                  />
                </label>
                <label>
                  Phone
                  <input
                    type="tel"
                    value={customer.phone}
                    onChange={(event) => handleCustomerChange('phone', event.target.value)}
                    placeholder="08012345678"
                    required
                  />
                </label>
                <label>
                  Delivery address
                  <input
                    type="text"
                    value={customer.address}
                    onChange={(event) => handleCustomerChange('address', event.target.value)}
                    placeholder="12 Lekki Phase 1, Lagos"
                    required
                  />
                </label>
              </div>

              <div className="summary-box">
                <h4>Order summary</h4>
                {cartLines.length === 0 ? (
                  <p>Add items to see your order summary here.</p>
                ) : (
                  <ul>
                    {cartLines.map(({ product, quantity, lineTotal }) => (
                      <li key={product.id}>
                        <span>
                          {product.name} x {quantity}
                        </span>
                        <strong>{formatCurrency(lineTotal)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="payment-actions">
                <button type="submit" className="primary" value="success" disabled={checkoutMutation.isPending}>
                  {checkoutMutation.isPending ? 'Submitting...' : 'Pay now'}
                </button>
                <button type="submit" className="secondary" value="failed" disabled={checkoutMutation.isPending}>
                  Simulate failed payment
                </button>
              </div>
            </form>

            <div className={`status-box ${statusMessage.tone}`}>
              {statusMessage.text}
            </div>

            {latestOrder ? (
              <div className="order-card">
                <h4>Latest order</h4>
                <div className="order-meta">
                  <strong>{latestOrder.orderNumber}</strong>
                  <span>{latestOrder.status}</span>
                </div>
                <ul>
                  <li>Customer: {latestOrder.customer.name}</li>
                  <li>Email: {latestOrder.customer.email}</li>
                  <li>Total paid: {formatCurrency(latestOrder.amountPaid)}</li>
                  <li>Created: {new Date(latestOrder.createdAt).toLocaleString()}</li>
                </ul>
              </div>
            ) : null}
          </section>
        </section>
      </main>
    </div>
  );
};

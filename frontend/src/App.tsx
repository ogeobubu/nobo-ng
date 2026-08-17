import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
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

const buttonStyles = {
  primary:
    'inline-flex items-center justify-center rounded-full bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-950/10 transition duration-200 hover:-translate-y-0.5 hover:from-teal-600 hover:via-teal-500 hover:to-emerald-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0',
  secondary:
    'inline-flex items-center justify-center rounded-full border border-teal-700/10 bg-white/80 px-5 py-3 text-sm font-semibold text-teal-950 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0',
  ghost:
    'inline-flex items-center justify-center rounded-full border border-teal-700/10 bg-white/75 px-4 py-2.5 text-sm font-semibold text-teal-950 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0',
  chip:
    'inline-flex items-center justify-center rounded-full border border-amber-500/15 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-amber-900 transition hover:bg-amber-500/15',
  icon:
    'inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/85 text-2xl leading-none text-slate-900 shadow-sm transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2'
};

const panelClass =
  'rounded-[28px] border border-white/60 bg-white/75 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-2xl';

export const App = () => {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [customer, setCustomer] = useState<CustomerForm>(emptyCustomer);
  const [latestOrder, setLatestOrder] = useState<Order | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentOutcome, setPaymentOutcome] = useState<{
    variant: 'success' | 'error';
    title: string;
    message: string;
    order?: Order;
  } | null>(null);
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
  const primaryProduct = products[0];
  const orderNumber = latestOrder?.orderNumber;

  const aiSignals = [
    {
      label: 'Catalog state',
      value: productsQuery.isLoading ? 'Syncing live data' : `${products.length} live products`
    },
    {
      label: 'Cart readiness',
      value: itemCount > 0 ? `${itemCount} item${itemCount === 1 ? '' : 's'} selected` : 'Empty and ready'
    },
    {
      label: 'Delivery cutoff',
      value: formatCurrency(SHIPPING_THRESHOLD)
    },
    {
      label: 'Last order',
      value: orderNumber || 'None yet'
    }
  ];

  const workflowSteps = [
    {
      step: '01',
      title: 'Discover',
      text: 'Editorial cards surface the most useful product details first.'
    },
    {
      step: '02',
      title: 'Compare',
      text: 'A live cart summary keeps pricing, quantity, and shipping visible.'
    },
    {
      step: '03',
      title: 'Checkout',
      text: 'One form submits straight to the Node and MySQL order flow.'
    }
  ];

  const checkoutMutation = useMutation({
    mutationFn: submitCheckout,
    onSuccess: async (data) => {
      if (data.order) {
        setLatestOrder(data.order);
        setPaymentOutcome({
          variant: 'success',
          title: 'Order placed',
          message: `Order ${data.order.orderNumber} was created successfully and is now being processed.`,
          order: data.order
        });
        setCart([]);
        setStatusMessage({
          tone: 'success',
          text: `Payment successful. Order ${data.order.orderNumber} is now being processed.`
        });
        setCustomer(emptyCustomer);
        setIsCheckoutOpen(false);
        setIsCartOpen(false);
        await queryClient.invalidateQueries({ queryKey: ['products'] });
        return;
      }

      setStatusMessage({
        tone: 'error',
        text: data.message || 'Payment failed. Please retry.'
      });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'A network error occurred while processing payment.';
      setPaymentOutcome({
        variant: 'error',
        title: 'Payment failed',
        message
      });
      setIsCheckoutOpen(false);
      setStatusMessage({
        tone: 'error',
        text: message
      });
    }
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsCartOpen(false);
      setIsCheckoutOpen(false);
      setPaymentOutcome(null);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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

  const closeOutcome = () => setPaymentOutcome(null);

  const openCheckout = () => {
    if (cart.length === 0) {
      setStatusMessage({
        tone: 'error',
        text: 'Add at least one product before checking out.'
      });
      return;
    }

    setIsCheckoutOpen(true);
    setIsCartOpen(false);
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

  const statusToneClasses = {
    idle: 'border-teal-700/10 bg-teal-50 text-teal-950',
    success: 'border-emerald-500/15 bg-emerald-50 text-emerald-950',
    error: 'border-rose-500/15 bg-rose-50 text-rose-950'
  } as const;

  return (
    <div className="relative min-h-screen overflow-x-hidden text-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-0 h-[28rem] w-[28rem] rounded-full bg-teal-500/15 blur-3xl" />
        <div className="absolute right-[-8rem] top-28 h-[24rem] w-[24rem] rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/3 h-[22rem] w-[22rem] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 pb-16 sm:px-6 lg:px-8">
        <header
          className={`${panelClass} flex items-center justify-between gap-4 px-4 py-3 sm:px-5`}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-500 text-sm font-black text-white shadow-lg shadow-teal-950/20">
              N
            </div>
            <div>
              <div className="font-['Space_Grotesk'] text-lg font-bold tracking-[-0.04em] text-slate-950">
                NoboNG
              </div>
              <p className="mt-0.5 text-sm text-slate-600">
                AI-polished storefront on React, Node, and MySQL
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 rounded-full bg-white/70 p-1.5 md:flex" aria-label="Primary">
            <a
              href="#catalog"
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-teal-50 hover:text-teal-950"
            >
              Catalog
            </a>
            <a
              href="#checkout"
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-teal-50 hover:text-teal-950"
            >
              Checkout
            </a>
            <a
              href="#orders"
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-teal-50 hover:text-teal-950"
            >
              Latest order
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button type="button" className={buttonStyles.ghost} onClick={() => setIsCartOpen(true)}>
              Cart {itemCount > 0 ? `(${itemCount})` : ''}
            </button>
            <button type="button" className={buttonStyles.primary} onClick={openCheckout} disabled={cart.length === 0}>
              Checkout
            </button>
          </div>
        </header>

        <main className="flex flex-col gap-6">
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
            <div
              className={`${panelClass} overflow-hidden border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.72),rgba(255,255,255,0.52)_48%,rgba(236,253,245,0.62))] p-5 sm:p-8`}
            >
              <span className="inline-flex rounded-full border border-amber-500/15 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-amber-900">
                Cross-border commerce
              </span>
              <h1 className="mt-4 max-w-[11ch] font-['Space_Grotesk'] text-4xl font-bold leading-[0.94] tracking-[-0.06em] text-slate-950 sm:text-5xl lg:text-6xl">
                AI-shaped storefront design with production-grade structure.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                Browse products, manage your cart, and submit orders through a Node.js REST API backed by
                MySQL. The layout leans editorial and futuristic without losing clarity.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" className={buttonStyles.chip} onClick={() => setIsCartOpen(true)}>
                  Open cart drawer
                </button>
                <button type="button" className={buttonStyles.chip} onClick={openCheckout}>
                  Open checkout modal
                </button>
                <span className={buttonStyles.chip}>AI-assisted polish</span>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
                  <div className="text-lg font-bold text-slate-950">{products.length}</div>
                  <div className="mt-1 text-sm text-slate-600">catalog items</div>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
                  <div className="text-lg font-bold text-slate-950">{formatCurrency(SHIPPING_THRESHOLD)}</div>
                  <div className="mt-1 text-sm text-slate-600">free shipping threshold</div>
                </div>
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
                  <div className="text-lg font-bold text-slate-950">{itemCount}</div>
                  <div className="mt-1 text-sm text-slate-600">items in cart</div>
                </div>
              </div>
            </div>

            <aside
              className="relative overflow-hidden rounded-[28px] border border-teal-900/10 bg-[linear-gradient(180deg,rgba(15,118,110,0.98),rgba(7,45,42,0.96))] p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.24)]"
            >
              <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
                Intelligence panel
              </div>
              <div className="mt-4 grid gap-3">
                {aiSignals.map((signal) => (
                  <div
                    key={signal.label}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/10 px-4 py-3"
                  >
                    <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/60">
                      {signal.label}
                    </span>
                    <strong className="text-sm text-white/95">{signal.value}</strong>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-white/10 p-4">
                <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80">
                  Featured pick
                </div>
                {primaryProduct ? (
                  <>
                    <strong className="mt-3 block font-['Space_Grotesk'] text-xl tracking-[-0.04em]">
                      {primaryProduct.name}
                    </strong>
                    <p className="mt-2 text-sm leading-6 text-white/75">{primaryProduct.description}</p>
                  </>
                ) : (
                  <>
                    <strong className="mt-3 block font-['Space_Grotesk'] text-xl tracking-[-0.04em]">
                      Live catalog ready
                    </strong>
                    <p className="mt-2 text-sm leading-6 text-white/75">
                      Products load from the API as soon as the app opens.
                    </p>
                  </>
                )}
              </div>
            </aside>
          </section>

          <section className="grid gap-3 md:grid-cols-3" aria-label="Workflow overview">
            {workflowSteps.map((item) => (
              <article key={item.step} className="flex items-start gap-3 rounded-[22px] border border-white/60 bg-white/75 p-4 shadow-sm backdrop-blur-xl">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-600/10 text-sm font-bold text-teal-950">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-['Space_Grotesk'] text-base font-bold tracking-[-0.04em] text-slate-950">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p>
                </div>
              </article>
            ))}
          </section>

          <section id="catalog" className="flex flex-col gap-4">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <span className="inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-amber-900">
                  Catalog
                </span>
                <h2 className="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.04em] text-slate-950 sm:text-3xl">
                  Featured products
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                Inventory and order placement come from the API, not from local mock state.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-teal-700/10 bg-white/75 px-3 py-1.5 text-xs font-semibold text-teal-950">
                Curated for clarity
              </span>
              <span className="rounded-full border border-teal-700/10 bg-white/75 px-3 py-1.5 text-xs font-semibold text-teal-950">
                Visual hierarchy first
              </span>
              <span className="rounded-full border border-teal-700/10 bg-white/75 px-3 py-1.5 text-xs font-semibold text-teal-950">
                Responsive by default
              </span>
            </div>

            {productsQuery.isLoading ? (
              <div className={`${panelClass} p-4 text-sm text-slate-700`}>Loading catalog...</div>
            ) : null}
            {productsQuery.isError ? (
              <div className={`${panelClass} border-rose-500/20 bg-rose-50 p-4 text-sm text-rose-950`}>
                {productsQuery.error instanceof Error ? productsQuery.error.message : 'Failed to load products.'}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-[26px] border border-white/60 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.11)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(15,23,42,0.14)]"
                >
                  <div className="flex items-center justify-between gap-3 px-4 pt-4">
                    <span className="inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-900">
                      {product.category}
                    </span>
                    <span className="inline-flex rounded-full bg-teal-600/10 px-3 py-1 text-xs font-semibold text-teal-950">
                      {product.stock} in stock
                    </span>
                  </div>

                  <img
                    src={product.image}
                    alt={product.name}
                    className="mt-4 h-56 w-full object-cover px-4"
                  />

                  <div className="space-y-4 p-4 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-['Space_Grotesk'] text-xl font-bold tracking-[-0.04em] text-slate-950">
                          {product.name}
                        </h3>
                        <div className="mt-1 text-sm uppercase tracking-[0.18em] text-slate-500">{product.category}</div>
                      </div>
                      <div className="rounded-2xl bg-slate-950 px-3 py-2 text-sm font-bold text-white">
                        {formatCurrency(product.price)}
                      </div>
                    </div>

                    <p className="min-h-[3.25rem] text-sm leading-6 text-slate-600">{product.description}</p>

                    <div className="flex items-center justify-between gap-2 text-sm text-slate-500">
                      <span>{product.category}</span>
                      <span>{product.eta}</span>
                    </div>

                    <button type="button" className={buttonStyles.primary} onClick={() => addToCart(product)}>
                      Add to cart
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section
            id="checkout"
            className={`${panelClass} grid gap-4 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.82fr)]`}
          >
            <div>
              <span className="inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-amber-900">
                Checkout
              </span>
              <h2 className="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.04em] text-slate-950 sm:text-3xl">
                Move from browsing to payment in a focused overlay.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                The cart slides in from the side, and checkout opens as its own modal so the buying
                moment feels more deliberate, polished, and premium.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-[22px] border border-teal-600/10 bg-gradient-to-b from-teal-600/10 to-teal-600/5 p-4">
                <strong className="block text-xl font-bold text-slate-950">{formatCurrency(total)}</strong>
                <span className="mt-1 block text-sm text-slate-600">Current cart value</span>
              </div>
              <button type="button" className={buttonStyles.primary} onClick={openCheckout} disabled={cart.length === 0}>
                Begin checkout
              </button>
              <button type="button" className={buttonStyles.secondary} onClick={() => setIsCartOpen(true)}>
                Review cart
              </button>
            </div>
          </section>

          {latestOrder ? (
            <section id="orders" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.78fr)]">
              <div>
                <span className="inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-amber-900">
                  Latest order
                </span>
                <h2 className="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.04em] text-slate-950">
                  Most recent placement
                </h2>
              </div>
              <div className="rounded-[22px] border border-white/60 bg-white/80 p-4 shadow-sm">
                <strong className="block font-['Space_Grotesk'] text-xl tracking-[-0.04em] text-slate-950">
                  {latestOrder.orderNumber}
                </strong>
                <span className="mt-1 inline-flex rounded-full bg-teal-600/10 px-3 py-1 text-xs font-semibold text-teal-950">
                  {latestOrder.status}
                </span>
                <p className="mt-3 text-sm text-slate-600">{latestOrder.customer.name}</p>
              </div>
            </section>
          ) : null}
        </main>
      </div>

      <div
        className={`fixed inset-0 z-50 transition duration-200 ${
          isCartOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!isCartOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
          aria-label="Close cart drawer"
          onClick={() => setIsCartOpen(false)}
        />
        <aside className="absolute right-0 top-0 flex h-full w-full max-w-[min(430px,92vw)] flex-col border-l border-white/40 bg-white/92 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-amber-900">
                Cart drawer
              </span>
              <h3 className="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.04em] text-slate-950">
                Your items
              </h3>
            </div>
            <button type="button" className={buttonStyles.icon} onClick={() => setIsCartOpen(false)} aria-label="Close cart">
              ×
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-[18px] border border-slate-200 bg-white/80 px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
              Real-time pricing
            </span>
            <strong className="text-sm text-slate-950">{formatCurrency(total)}</strong>
          </div>

          <div className="mt-4 flex-1 overflow-auto pr-1">
            {cartLines.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-slate-300 bg-white/80 p-4 text-sm text-slate-600">
                Your cart is empty. Add products to start checkout.
              </div>
            ) : (
              <div className="grid gap-3">
                {cartLines.map(({ product, quantity, lineTotal }) => (
                  <div
                    key={product.id}
                    className="grid grid-cols-[68px_minmax(0,1fr)] gap-3 rounded-[18px] border border-slate-200/80 bg-white/85 p-3"
                  >
                    <img src={product.image} alt={product.name} className="h-[68px] w-[68px] rounded-2xl object-cover" />
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <strong className="truncate text-sm text-slate-950">{product.name}</strong>
                        <span className="text-sm font-semibold text-slate-950">{formatCurrency(lineTotal)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{formatCurrency(product.price)} each</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-1 py-1">
                          <button
                            type="button"
                            onClick={() => changeQuantity(product.id, -1)}
                            className="h-7 w-7 rounded-full text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-sm font-semibold text-slate-950">{quantity}</span>
                          <button
                            type="button"
                            onClick={() => changeQuantity(product.id, 1)}
                            className="h-7 w-7 rounded-full text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className="text-sm font-semibold text-teal-950 underline decoration-teal-950/20 underline-offset-4 transition hover:text-teal-700"
                          onClick={() => removeFromCart(product.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-2 rounded-[20px] border border-slate-200 bg-white/80 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-600">Subtotal</span>
              <strong className="text-slate-950">{formatCurrency(subtotal)}</strong>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-600">Shipping</span>
              <strong className="text-slate-950">{formatCurrency(shippingCost)}</strong>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-teal-600/10 px-4 py-3 text-sm">
              <span className="font-semibold text-teal-950">Total</span>
              <strong className="text-teal-950">{formatCurrency(total)}</strong>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className={buttonStyles.secondary} onClick={() => setIsCartOpen(false)}>
              Continue shopping
            </button>
            <button type="button" className={buttonStyles.primary} onClick={openCheckout} disabled={cart.length === 0}>
              Checkout now
            </button>
          </div>
        </aside>
      </div>

      <div
        className={`fixed inset-0 z-50 transition duration-200 ${
          isCheckoutOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!isCheckoutOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
          aria-label="Close checkout"
          onClick={() => setIsCheckoutOpen(false)}
        />
        <section
          className={`absolute left-1/2 top-1/2 w-[min(1100px,calc(100vw-1rem))] max-h-[88vh] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-[28px] border border-white/50 bg-white/95 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-2xl sm:p-5`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-title"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-amber-900">
                Checkout modal
              </span>
              <h3 id="checkout-title" className="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.04em] text-slate-950">
                Confirm your order
              </h3>
            </div>
            <button
              type="button"
              className={buttonStyles.icon}
              onClick={() => setIsCheckoutOpen(false)}
              aria-label="Close checkout"
            >
              ×
            </button>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.75fr)]">
            <form className="space-y-4" onSubmit={handleCheckout}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Full name
                  <input
                    type="text"
                    value={customer.name}
                    onChange={(event) => handleCustomerChange('name', event.target.value)}
                    placeholder="Oge Okafor"
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Email
                  <input
                    type="email"
                    value={customer.email}
                    onChange={(event) => handleCustomerChange('email', event.target.value)}
                    placeholder="oge@example.com"
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Phone
                  <input
                    type="tel"
                    value={customer.phone}
                    onChange={(event) => handleCustomerChange('phone', event.target.value)}
                    placeholder="08012345678"
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Delivery address
                  <input
                    type="text"
                    value={customer.address}
                    onChange={(event) => handleCustomerChange('address', event.target.value)}
                    placeholder="12 Lekki Phase 1, Lagos"
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  />
                </label>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-white/90 p-4">
                <h4 className="font-['Space_Grotesk'] text-lg font-bold tracking-[-0.04em] text-slate-950">
                  Order summary
                </h4>
                {cartLines.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">Add items to see your order summary here.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {cartLines.map(({ product, quantity, lineTotal }) => (
                      <li
                        key={product.id}
                        className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm"
                      >
                        <span className="min-w-0 truncate text-slate-700">
                          {product.name} x {quantity}
                        </span>
                        <strong className="text-slate-950">{formatCurrency(lineTotal)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="submit"
                  className={buttonStyles.primary}
                  value="success"
                  disabled={checkoutMutation.isPending}
                >
                  {checkoutMutation.isPending ? 'Submitting...' : 'Pay now'}
                </button>
                <button
                  type="submit"
                  className={buttonStyles.secondary}
                  value="failed"
                  disabled={checkoutMutation.isPending}
                >
                  Simulate failed payment
                </button>
              </div>
            </form>

            <aside className="grid content-start gap-3">
              <div className="rounded-[22px] border border-slate-200 bg-white/90 p-4">
                <span className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Subtotal</span>
                <strong className="mt-1 block text-xl font-bold text-slate-950">{formatCurrency(subtotal)}</strong>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-white/90 p-4">
                <span className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Shipping</span>
                <strong className="mt-1 block text-xl font-bold text-slate-950">{formatCurrency(shippingCost)}</strong>
              </div>
              <div className="rounded-[22px] border border-teal-600/15 bg-gradient-to-b from-teal-600/10 to-teal-600/5 p-4">
                <span className="text-xs font-bold uppercase tracking-[0.24em] text-teal-900">Payable amount</span>
                <strong className="mt-1 block text-2xl font-bold text-teal-950">{formatCurrency(total)}</strong>
              </div>
              <div className={`rounded-[22px] border px-4 py-3 text-sm font-medium ${statusToneClasses[statusMessage.tone]}`}>
                {statusMessage.text}
              </div>
            </aside>
          </div>
        </section>
      </div>

      <div
        className={`fixed inset-0 z-50 transition duration-200 ${
          paymentOutcome ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!paymentOutcome}
      >
        <button
          type="button"
          className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
          aria-label="Close result"
          onClick={closeOutcome}
        />
        {paymentOutcome ? (
          <section
            className={`absolute left-1/2 top-1/2 w-[min(560px,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border bg-white/95 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-2xl sm:p-5 ${
              paymentOutcome.variant === 'success' ? 'border-teal-500/20' : 'border-rose-500/20'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-amber-900">
                  {paymentOutcome.variant === 'success' ? 'Placed order' : 'Payment failed'}
                </span>
                <h3 className="mt-2 font-['Space_Grotesk'] text-2xl font-bold tracking-[-0.04em] text-slate-950">
                  {paymentOutcome.title}
                </h3>
              </div>
              <button type="button" className={buttonStyles.icon} onClick={closeOutcome} aria-label="Close result">
                ×
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600">{paymentOutcome.message}</p>

            {paymentOutcome.order ? (
              <div className="mt-4 rounded-[22px] border border-slate-200 bg-white/90 p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong className="font-['Space_Grotesk'] text-xl tracking-[-0.04em] text-slate-950">
                    {paymentOutcome.order.orderNumber}
                  </strong>
                  <span className="rounded-full bg-teal-600/10 px-3 py-1 text-xs font-semibold text-teal-950">
                    {paymentOutcome.order.status}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                      Total paid
                    </span>
                    <strong className="mt-1 block text-sm text-slate-950">
                      {formatCurrency(paymentOutcome.order.amountPaid)}
                    </strong>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                      Items
                    </span>
                    <strong className="mt-1 block text-sm text-slate-950">{paymentOutcome.order.items.length}</strong>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                      Created
                    </span>
                    <strong className="mt-1 block text-sm text-slate-950">
                      {new Date(paymentOutcome.order.createdAt).toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button type="button" className={buttonStyles.secondary} onClick={closeOutcome}>
                Dismiss
              </button>
              {paymentOutcome.variant === 'success' ? (
                <button
                  type="button"
                  className={buttonStyles.primary}
                  onClick={() => {
                    closeOutcome();
                    setIsCartOpen(true);
                  }}
                >
                  View cart drawer
                </button>
              ) : (
                <button
                  type="button"
                  className={buttonStyles.primary}
                  onClick={() => {
                    closeOutcome();
                    openCheckout();
                  }}
                >
                  Try again
                </button>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
};

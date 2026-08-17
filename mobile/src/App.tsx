import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View
} from 'react-native';
import { getProducts, submitCheckout } from './api';
import type { CartEntry, CustomerForm, Order, Product } from './types';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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

const baseButton =
  'items-center justify-center rounded-full px-4 py-3 active:opacity-80';

const primaryButton =
  `${baseButton} bg-teal-700 shadow-sm shadow-teal-950/10`;
const secondaryButton =
  `${baseButton} border border-teal-700/10 bg-white/90`;

export default function App() {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [checkoutPending, setCheckoutPending] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadProducts = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const result = await getProducts();
        if (!isActive) return;
        setProducts(result);
      } catch (error) {
        if (!isActive) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load products.');
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    loadProducts();

    return () => {
      isActive = false;
    };
  }, []);

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const subtotal = cart.reduce((sum, item) => {
    const product = productsById.get(item.id);
    return product ? sum + product.price * item.quantity : sum;
  }, 0);

  const shippingCost = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = subtotal + shippingCost;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const primaryProduct = products[0];

  const aiSignals = [
    {
      label: 'Catalog state',
      value: isLoading ? 'Syncing live data' : `${products.length} live products`
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
      label: 'Latest order',
      value: latestOrder?.orderNumber || 'None yet'
    }
  ];

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

  const executeCheckout = async (paymentStatus: 'success' | 'failed') => {
    if (cart.length === 0) {
      setStatusMessage({
        tone: 'error',
        text: 'Add at least one product before checking out.'
      });
      return;
    }

    setCheckoutPending(true);

    try {
      const response = await submitCheckout({
        customer,
        items: cart,
        paymentStatus
      });

      if (response.order) {
        setLatestOrder(response.order);
        setPaymentOutcome({
          variant: 'success',
          title: 'Order placed',
          message: `Order ${response.order.orderNumber} was created successfully and is now being processed.`,
          order: response.order
        });
        setCart([]);
        setCustomer(emptyCustomer);
        setIsCheckoutOpen(false);
        setIsCartOpen(false);
        setStatusMessage({
          tone: 'success',
          text: `Payment successful. Order ${response.order.orderNumber} is now being processed.`
        });
        return;
      }

      setPaymentOutcome({
        variant: 'error',
        title: 'Payment failed',
        message: response.message || 'Payment failed. Please retry.'
      });
      setIsCheckoutOpen(false);
      setStatusMessage({
        tone: 'error',
        text: response.message || 'Payment failed. Please retry.'
      });
    } catch (error) {
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
    } finally {
      setCheckoutPending(false);
    }
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

  const toneClasses = {
    idle: 'border-teal-700/10 bg-teal-50 text-teal-950',
    success: 'border-emerald-500/15 bg-emerald-50 text-emerald-950',
    error: 'border-rose-500/15 bg-rose-50 text-rose-950'
  } as const;

  return (
    <SafeAreaView className="flex-1 bg-[#f6f1ea]" edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />

      <View className="absolute inset-0 overflow-hidden">
        <View className="absolute -left-20 top-0 h-80 w-80 rounded-full bg-teal-500/15" />
        <View className="absolute right-[-6rem] top-28 h-72 w-72 rounded-full bg-amber-500/15" />
        <View className="absolute bottom-[-10rem] left-16 h-72 w-72 rounded-full bg-emerald-500/10" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-36 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-4">
          <View className="rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-sm">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-2xl bg-teal-700">
                  <Text className="text-sm font-black text-white">N</Text>
                </View>
                <View>
                  <Text className="text-lg font-bold tracking-[-0.04em] text-slate-950">NoboNG</Text>
                  <Text className="text-sm text-slate-600">Expo mobile storefront</Text>
                </View>
              </View>

              <Pressable
                onPress={() => setIsCartOpen(true)}
                className="rounded-full border border-teal-700/10 bg-white px-4 py-2.5"
              >
                <Text className="text-sm font-semibold text-slate-900">
                  Cart {itemCount > 0 ? `(${itemCount})` : ''}
                </Text>
              </Pressable>
            </View>

            <View className="mt-4 rounded-[24px] bg-slate-950 p-5">
              <Text className="inline-flex self-start rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-white/70">
                AI-shaped retail
              </Text>
              <Text className="mt-3 max-w-[12ch] text-4xl font-bold leading-[1] tracking-[-0.06em] text-white">
                Mobile checkout with a polished native feel.
              </Text>
              <Text className="mt-3 text-sm leading-6 text-white/70">
                Browse products, manage your cart, and submit orders through the same Node.js REST API backed by MySQL.
              </Text>

              <View className="mt-4 flex-row flex-wrap gap-2">
                <Pressable onPress={() => setIsCartOpen(true)} className="rounded-full bg-white/10 px-3 py-2">
                  <Text className="text-xs font-bold uppercase tracking-[0.18em] text-white">Open cart</Text>
                </Pressable>
                <Pressable onPress={openCheckout} className="rounded-full bg-amber-500 px-3 py-2">
                  <Text className="text-xs font-bold uppercase tracking-[0.18em] text-white">Checkout</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const featured = products[0];
                    if (featured) {
                      addToCart(featured);
                    }
                  }}
                  className="rounded-full bg-white/10 px-3 py-2"
                >
                  <Text className="text-xs font-bold uppercase tracking-[0.18em] text-white">Try cart</Text>
                </Pressable>
              </View>
            </View>

            <View className="mt-4 gap-3">
              {aiSignals.map((signal) => (
                <View key={signal.label} className="flex-row items-center justify-between rounded-2xl bg-white/70 px-4 py-3">
                  <Text className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">{signal.label}</Text>
                  <Text className="text-sm font-semibold text-slate-950">{signal.value}</Text>
                </View>
              ))}
            </View>

            {primaryProduct ? (
              <View className="mt-4 rounded-[24px] border border-white/70 bg-white/80 p-4">
                <Text className="inline-flex self-start rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-amber-900">
                  Featured pick
                </Text>
                <Text className="mt-3 text-xl font-bold tracking-[-0.04em] text-slate-950">{primaryProduct.name}</Text>
                <Text className="mt-2 text-sm leading-6 text-slate-600">{primaryProduct.description}</Text>
              </View>
            ) : null}
          </View>

          <View className="rounded-[24px] border border-white/70 bg-white/75 p-4 shadow-sm">
            <Text className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-900">Workflow</Text>
            <View className="mt-3 gap-3">
              {[
                ['01', 'Discover', 'Editorial cards surface the useful details first.'],
                ['02', 'Compare', 'Cart and pricing stay visible while you browse.'],
                ['03', 'Checkout', 'A clean modal submits to the backend in one step.']
              ].map(([step, title, description]) => (
                <View key={step} className="flex-row gap-3 rounded-2xl bg-white/80 p-3">
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-teal-700/10">
                    <Text className="text-sm font-bold text-teal-950">{step}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold tracking-[-0.04em] text-slate-950">{title}</Text>
                    <Text className="mt-1 text-sm leading-6 text-slate-600">{description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="flex-row items-end justify-between">
            <View>
              <Text className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-900">Catalog</Text>
              <Text className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">Featured products</Text>
            </View>
            <Text className="max-w-[12rem] text-right text-sm leading-5 text-slate-600">
              Inventory and order placement come from the API, not from mock data.
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-2">
            <View className="rounded-full border border-teal-700/10 bg-white/80 px-3 py-1.5">
              <Text className="text-xs font-semibold text-teal-950">Curated for clarity</Text>
            </View>
            <View className="rounded-full border border-teal-700/10 bg-white/80 px-3 py-1.5">
              <Text className="text-xs font-semibold text-teal-950">Visual hierarchy first</Text>
            </View>
            <View className="rounded-full border border-teal-700/10 bg-white/80 px-3 py-1.5">
              <Text className="text-xs font-semibold text-teal-950">Native-first UI</Text>
            </View>
          </View>

          {isLoading ? (
            <View className="items-center rounded-[24px] border border-white/70 bg-white/80 p-6">
              <ActivityIndicator color="#0f766e" />
              <Text className="mt-3 text-sm text-slate-600">Loading catalog...</Text>
            </View>
          ) : null}

          {loadError ? (
            <View className="rounded-[24px] border border-rose-500/20 bg-rose-50 p-4">
              <Text className="text-sm text-rose-950">{loadError}</Text>
            </View>
          ) : null}

          <View className="gap-4">
            {products.map((product) => (
              <View
                key={product.id}
                className="overflow-hidden rounded-[26px] border border-white/70 bg-white shadow-sm"
              >
                <View className="flex-row items-center justify-between px-4 pt-4">
                  <Text className="rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-900">
                    {product.category}
                  </Text>
                  <Text className="rounded-full bg-teal-700/10 px-3 py-1 text-xs font-semibold text-teal-950">
                    {product.stock} in stock
                  </Text>
                </View>

                <Image
                  source={{ uri: product.image }}
                  resizeMode="cover"
                  className="mt-4 h-56 w-full px-4"
                />

                <View className="gap-4 p-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-xl font-bold tracking-[-0.04em] text-slate-950">{product.name}</Text>
                      <Text className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{product.category}</Text>
                    </View>
                    <View className="rounded-2xl bg-slate-950 px-3 py-2">
                      <Text className="text-sm font-bold text-white">{formatCurrency(product.price)}</Text>
                    </View>
                  </View>

                  <Text className="min-h-[3.75rem] text-sm leading-6 text-slate-600">{product.description}</Text>

                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-slate-500">{product.category}</Text>
                    <Text className="text-sm text-slate-500">{product.eta}</Text>
                  </View>

                  <Pressable onPress={() => addToCart(product)} className={primaryButton}>
                    <Text className="text-sm font-semibold text-white">Add to cart</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          <View className="rounded-[26px] border border-white/70 bg-white/80 p-4 shadow-sm">
            <Text className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-900">Checkout</Text>
            <Text className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">
              Move from browsing to payment in a focused overlay.
            </Text>
            <Text className="mt-3 text-sm leading-6 text-slate-600">
              The cart slides up from the bottom, and checkout opens as its own modal so the buying moment feels more deliberate.
            </Text>

            <View className="mt-4 gap-2">
              <View className="rounded-[22px] border border-teal-600/10 bg-teal-600/5 p-4">
                <Text className="text-xs font-bold uppercase tracking-[0.24em] text-teal-900">Current cart value</Text>
                <Text className="mt-1 text-xl font-bold text-slate-950">{formatCurrency(total)}</Text>
              </View>
              <Pressable onPress={openCheckout} className={primaryButton}>
                <Text className="text-sm font-semibold text-white">Begin checkout</Text>
              </Pressable>
              <Pressable onPress={() => setIsCartOpen(true)} className={secondaryButton}>
                <Text className="text-sm font-semibold text-slate-900">Review cart</Text>
              </Pressable>
            </View>
          </View>

          {latestOrder ? (
            <View className="rounded-[26px] border border-white/70 bg-white/80 p-4 shadow-sm">
              <Text className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-900">Latest order</Text>
              <Text className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">Most recent placement</Text>
              <View className="mt-3 rounded-[22px] bg-slate-50 p-4">
                <Text className="text-xl font-bold tracking-[-0.04em] text-slate-950">{latestOrder.orderNumber}</Text>
                <Text className="mt-1 text-sm text-slate-600">{latestOrder.status}</Text>
                <Text className="mt-3 text-sm text-slate-600">{latestOrder.customer.name}</Text>
              </View>
            </View>
          ) : null}

          <View className={`rounded-[22px] border px-4 py-3 ${toneClasses[statusMessage.tone]}`}>
            <Text className="text-sm font-medium">{statusMessage.text}</Text>
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute left-4 right-4 flex-row gap-2 rounded-[22px] border border-white/70 bg-white/90 p-3 shadow-xl shadow-slate-950/10"
        style={{ bottom: Math.max(insets.bottom, 12) }}
      >
        <Pressable onPress={() => setIsCartOpen(true)} className={`${secondaryButton} flex-1`}>
          <Text className="text-sm font-semibold text-slate-900">Cart {itemCount > 0 ? `(${itemCount})` : ''}</Text>
        </Pressable>
        <Pressable onPress={openCheckout} className={`${primaryButton} flex-1`}>
          <Text className="text-sm font-semibold text-white">Checkout</Text>
        </Pressable>
      </View>

      <Modal
        visible={isCartOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCartOpen(false)}
      >
        <View className="flex-1 justify-end bg-slate-950/55">
          <Pressable className="absolute inset-0" onPress={() => setIsCartOpen(false)} />
          <View className="max-h-[88%] rounded-t-[32px] bg-white p-4">
            <View className="flex-row items-start justify-between gap-4">
              <View>
                <Text className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-900">Cart drawer</Text>
                <Text className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">Your items</Text>
              </View>
              <Pressable onPress={() => setIsCartOpen(false)} className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white">
                <Text className="text-2xl leading-none text-slate-900">×</Text>
              </Pressable>
            </View>

            <View className="mt-4 flex-row items-center justify-between rounded-[18px] border border-slate-200 bg-white px-4 py-3">
              <Text className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Real-time pricing</Text>
              <Text className="text-sm font-semibold text-slate-950">{formatCurrency(total)}</Text>
            </View>

            <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
              {cartLines.length === 0 ? (
                <View className="rounded-[18px] border border-dashed border-slate-300 bg-white p-4">
                  <Text className="text-sm text-slate-600">Your cart is empty. Add products to start checkout.</Text>
                </View>
              ) : (
                <View className="gap-3">
                  {cartLines.map(({ product, quantity, lineTotal }) => (
                    <View key={product.id} className="flex-row gap-3 rounded-[18px] border border-slate-200 bg-white p-3">
                      <Image source={{ uri: product.image }} className="h-[68px] w-[68px] rounded-2xl" />
                      <View className="min-w-0 flex-1">
                        <View className="flex-row items-start justify-between gap-3">
                          <Text className="flex-1 text-sm font-semibold text-slate-950">{product.name}</Text>
                          <Text className="text-sm font-semibold text-slate-950">{formatCurrency(lineTotal)}</Text>
                        </View>
                        <Text className="mt-1 text-xs text-slate-500">{formatCurrency(product.price)} each</Text>
                        <View className="mt-3 flex-row items-center gap-2">
                          <View className="flex-row items-center rounded-full border border-slate-200 bg-white px-1 py-1">
                            <Pressable
                              onPress={() => changeQuantity(product.id, -1)}
                              className="h-7 w-7 items-center justify-center rounded-full"
                            >
                              <Text className="text-sm font-bold text-slate-700">-</Text>
                            </Pressable>
                            <Text className="w-8 text-center text-sm font-semibold text-slate-950">{quantity}</Text>
                            <Pressable
                              onPress={() => changeQuantity(product.id, 1)}
                              className="h-7 w-7 items-center justify-center rounded-full"
                            >
                              <Text className="text-sm font-bold text-slate-700">+</Text>
                            </Pressable>
                          </View>
                          <Pressable onPress={() => removeFromCart(product.id)}>
                            <Text className="text-sm font-semibold text-teal-950">Remove</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <View className="mt-4 gap-2 rounded-[20px] border border-slate-200 bg-white p-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-slate-600">Subtotal</Text>
                <Text className="text-sm font-semibold text-slate-950">{formatCurrency(subtotal)}</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-slate-600">Shipping</Text>
                <Text className="text-sm font-semibold text-slate-950">{formatCurrency(shippingCost)}</Text>
              </View>
              <View className="flex-row items-center justify-between rounded-2xl bg-teal-600/10 px-4 py-3">
                <Text className="text-sm font-semibold text-teal-950">Total</Text>
                <Text className="text-sm font-semibold text-teal-950">{formatCurrency(total)}</Text>
              </View>
            </View>

            <View className="mt-4 flex-row gap-2">
              <Pressable onPress={() => setIsCartOpen(false)} className={`${secondaryButton} flex-1`}>
                <Text className="text-sm font-semibold text-slate-900">Continue shopping</Text>
              </Pressable>
              <Pressable onPress={openCheckout} className={`${primaryButton} flex-1`}>
                <Text className="text-sm font-semibold text-white">Checkout now</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isCheckoutOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCheckoutOpen(false)}
      >
        <View className="flex-1 justify-end bg-slate-950/55">
          <Pressable className="absolute inset-0" onPress={() => setIsCheckoutOpen(false)} />
          <View className="max-h-[92%] rounded-t-[32px] bg-white p-4">
            <View className="flex-row items-start justify-between gap-4">
              <View>
                <Text className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-900">Checkout modal</Text>
                <Text className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">Confirm your order</Text>
              </View>
              <Pressable onPress={() => setIsCheckoutOpen(false)} className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white">
                <Text className="text-2xl leading-none text-slate-900">×</Text>
              </Pressable>
            </View>

            <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <View className="gap-3">
                  <Text className="text-sm font-semibold text-slate-700">Full name</Text>
                  <TextInput
                    value={customer.name}
                    onChangeText={(value) => handleCustomerChange('name', value)}
                    placeholder="Oge Okafor"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950"
                  />
                  <Text className="text-sm font-semibold text-slate-700">Email</Text>
                  <TextInput
                    value={customer.email}
                    onChangeText={(value) => handleCustomerChange('email', value)}
                    placeholder="oge@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950"
                  />
                  <Text className="text-sm font-semibold text-slate-700">Phone</Text>
                  <TextInput
                    value={customer.phone}
                    onChangeText={(value) => handleCustomerChange('phone', value)}
                    placeholder="08012345678"
                    keyboardType="phone-pad"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950"
                  />
                  <Text className="text-sm font-semibold text-slate-700">Delivery address</Text>
                  <TextInput
                    value={customer.address}
                    onChangeText={(value) => handleCustomerChange('address', value)}
                    placeholder="12 Lekki Phase 1, Lagos"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950"
                  />
                </View>

                <View className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <Text className="text-lg font-bold tracking-[-0.04em] text-slate-950">Order summary</Text>
                  {cartLines.length === 0 ? (
                    <Text className="mt-2 text-sm text-slate-600">Add items to see your order summary here.</Text>
                  ) : (
                    <View className="mt-3 gap-2">
                      {cartLines.map(({ product, quantity, lineTotal }) => (
                        <View key={product.id} className="flex-row items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                          <Text className="flex-1 pr-3 text-sm text-slate-700">
                            {product.name} x {quantity}
                          </Text>
                          <Text className="text-sm font-semibold text-slate-950">{formatCurrency(lineTotal)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => executeCheckout('success')}
                    disabled={checkoutPending}
                    className={`${primaryButton} flex-1 ${checkoutPending ? 'opacity-70' : ''}`}
                  >
                    <Text className="text-sm font-semibold text-white">
                      {checkoutPending ? 'Submitting...' : 'Pay now'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => executeCheckout('failed')}
                    disabled={checkoutPending}
                    className={`${secondaryButton} flex-1`}
                  >
                    <Text className="text-sm font-semibold text-slate-900">Failed payment</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            <View className="mt-4 gap-2">
              <View className="rounded-[22px] border border-slate-200 bg-white p-4">
                <Text className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Subtotal</Text>
                <Text className="mt-1 text-xl font-bold text-slate-950">{formatCurrency(subtotal)}</Text>
              </View>
              <View className="rounded-[22px] border border-slate-200 bg-white p-4">
                <Text className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">Shipping</Text>
                <Text className="mt-1 text-xl font-bold text-slate-950">{formatCurrency(shippingCost)}</Text>
              </View>
              <View className="rounded-[22px] border border-teal-600/15 bg-teal-600/5 p-4">
                <Text className="text-xs font-bold uppercase tracking-[0.24em] text-teal-900">Payable amount</Text>
                <Text className="mt-1 text-2xl font-bold text-teal-950">{formatCurrency(total)}</Text>
              </View>
              <View className={`rounded-[22px] border px-4 py-3 ${toneClasses[statusMessage.tone]}`}>
                <Text className="text-sm font-medium">{statusMessage.text}</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(paymentOutcome)}
        transparent
        animationType="fade"
        onRequestClose={() => setPaymentOutcome(null)}
      >
        <View className="flex-1 items-center justify-center bg-slate-950/55 px-4">
          <Pressable className="absolute inset-0" onPress={() => setPaymentOutcome(null)} />
          {paymentOutcome ? (
            <View
              className={`w-full max-w-[560px] rounded-[28px] border bg-white p-4 shadow-xl ${
                paymentOutcome.variant === 'success' ? 'border-teal-500/20' : 'border-rose-500/20'
              }`}
            >
              <View className="flex-row items-start justify-between gap-4">
                <View>
                  <Text className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-900">
                    {paymentOutcome.variant === 'success' ? 'Placed order' : 'Payment failed'}
                  </Text>
                  <Text className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">
                    {paymentOutcome.title}
                  </Text>
                </View>
                <Pressable onPress={() => setPaymentOutcome(null)} className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white">
                  <Text className="text-2xl leading-none text-slate-900">×</Text>
                </Pressable>
              </View>

              <Text className="mt-3 text-sm leading-6 text-slate-600">{paymentOutcome.message}</Text>

              {paymentOutcome.order ? (
                <View className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="text-xl font-bold tracking-[-0.04em] text-slate-950">
                      {paymentOutcome.order.orderNumber}
                    </Text>
                    <Text className="rounded-full bg-teal-600/10 px-3 py-1 text-xs font-semibold text-teal-950">
                      {paymentOutcome.order.status}
                    </Text>
                  </View>
                  <View className="mt-4 flex-row gap-2">
                    <View className="flex-1 rounded-2xl bg-white p-3">
                      <Text className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Total paid</Text>
                      <Text className="mt-1 text-sm font-semibold text-slate-950">
                        {formatCurrency(paymentOutcome.order.amountPaid)}
                      </Text>
                    </View>
                    <View className="flex-1 rounded-2xl bg-white p-3">
                      <Text className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Items</Text>
                      <Text className="mt-1 text-sm font-semibold text-slate-950">
                        {paymentOutcome.order.items.length}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}

              <View className="mt-4 flex-row gap-2">
                <Pressable onPress={() => setPaymentOutcome(null)} className={`${secondaryButton} flex-1`}>
                  <Text className="text-sm font-semibold text-slate-900">Dismiss</Text>
                </Pressable>
                {paymentOutcome.variant === 'success' ? (
                  <Pressable
                    onPress={() => {
                      setPaymentOutcome(null);
                      setIsCartOpen(true);
                    }}
                    className={`${primaryButton} flex-1`}
                  >
                    <Text className="text-sm font-semibold text-white">View cart</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      setPaymentOutcome(null);
                      openCheckout();
                    }}
                    className={`${primaryButton} flex-1`}
                  >
                    <Text className="text-sm font-semibold text-white">Try again</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

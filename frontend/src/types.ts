export type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  image: string;
  description: string;
  eta: string;
  category: string;
};

export type CartEntry = {
  id: string;
  quantity: number;
};

export type CustomerForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

export type CheckoutPayload = {
  customer: CustomerForm;
  items: CartEntry[];
  paymentStatus: 'success' | 'failed';
};

export type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  image: string;
};

export type Order = {
  id: number;
  orderNumber: string;
  customer: CustomerForm;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  amountPaid: number;
  paymentStatus: 'success' | 'failed';
  status: string;
  createdAt: string;
};

export type ProductsResponse = {
  products: Product[];
};

export type CheckoutResponse = {
  success: boolean;
  message: string;
  total?: number;
  order?: Order;
};

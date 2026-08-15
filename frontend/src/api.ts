import type { CheckoutPayload, CheckoutResponse, ProductsResponse } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const fetchJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    },
    ...init
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || 'Something went wrong.';
    throw new Error(message);
  }

  return data as T;
};

export const getProducts = async () => {
  const data = await fetchJson<ProductsResponse>('/api/products');
  return data.products;
};

export const submitCheckout = async (payload: CheckoutPayload) => {
  return fetchJson<CheckoutResponse>('/api/checkout', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
};

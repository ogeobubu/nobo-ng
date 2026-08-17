import { Platform } from 'react-native';
import type { CheckoutPayload, CheckoutResponse, ProductsResponse } from './types';

const defaultApiBaseUrl = Platform.select({
  android: 'http://10.0.2.2:4000',
  ios: 'http://localhost:4000',
  web: 'http://localhost:4000',
  default: 'http://localhost:4000'
});

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || defaultApiBaseUrl || 'http://localhost:4000';

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

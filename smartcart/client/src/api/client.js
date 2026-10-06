const BASE = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'smartcart_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Fired when the server says the token is no longer valid, so the app can log out
export const UNAUTHORIZED_EVENT = 'smartcart:unauthorized';

async function request(method, path, body, { auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is the API running?', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(data.message || `Request failed (${res.status})`, res.status, data.details);
  }
  return data;
}

const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  // auth
  register: (b) => request('POST', '/api/auth/register', b, { auth: false }),
  verifyOtp: (b) => request('POST', '/api/auth/verify-otp', b, { auth: false }),
  resendOtp: (b) => request('POST', '/api/auth/resend-otp', b, { auth: false }),
  login: (b) => request('POST', '/api/auth/login', b, { auth: false }),
  me: () => request('GET', '/api/auth/me'),

  // products
  products: (params) => request('GET', `/api/products${qs(params)}`, undefined, { auth: false }),
  productMeta: () => request('GET', '/api/products/meta', undefined, { auth: false }),
  product: (id) => request('GET', `/api/products/${id}`, undefined, { auth: false }),
  createProduct: (b) => request('POST', '/api/products', b),
  updateProduct: (id, b) => request('PUT', `/api/products/${id}`, b),
  deleteProduct: (id) => request('DELETE', `/api/products/${id}`),

  // cart
  cart: () => request('GET', '/api/cart'),
  addToCart: (productId, quantity = 1) => request('POST', '/api/cart', { productId, quantity }),
  setCartQty: (productId, quantity) => request('PUT', `/api/cart/${productId}`, { quantity }),
  removeFromCart: (productId) => request('DELETE', `/api/cart/${productId}`),

  // orders
  placeOrder: (b) => request('POST', '/api/orders', b),
  myOrders: () => request('GET', '/api/orders/mine'),
  cancelOrder: (id) => request('PUT', `/api/orders/${id}/cancel`),
  allOrders: (params) => request('GET', `/api/orders${qs(params)}`),
  setOrderStatus: (id, status) => request('PUT', `/api/orders/${id}/status`, { status }),

  // admin
  adminStats: () => request('GET', '/api/admin/stats'),
  adminProducts: (params) => request('GET', `/api/admin/products${qs(params)}`),
  adminSetStock: (id, stock) => request('PATCH', `/api/admin/products/${id}/stock`, { stock }),
};

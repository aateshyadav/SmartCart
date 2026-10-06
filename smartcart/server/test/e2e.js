process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
const path = require('path');
const SERVER = path.join(__dirname, '..');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

(async () => {
  const mms = await MongoMemoryServer.create();
  await mongoose.connect(mms.getUri('smartcart'));
  const app = require(path.join(SERVER, 'src/app'));
  const User = require(path.join(SERVER, 'src/models/User'));
  const Product = require(path.join(SERVER, 'src/models/Product'));

  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, p, body, token) => {
    const r = await fetch(base + p, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body && JSON.stringify(body),
    });
    return { s: r.status, b: await r.json().catch(() => ({})) };
  };

  let fails = 0;
  const t = (name, cond, extra = '') => {
    if (!cond) fails++;
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`);
  };

  // seed
  await User.create({ name: 'Admin', email: 'admin@x.dev', password: 'Admin@12345', role: 'admin', isVerified: true });
  const [laptop, phone, mouse] = await Product.insertMany([
    { name: 'Aero Laptop', brand: 'Aero', category: 'Laptops', price: 70000, stock: 3, rating: 4.5 },
    { name: 'Pulse Phone', brand: 'Pulse', category: 'Phones', price: 20000, stock: 10, rating: 4.0 },
    { name: 'Glide Mouse', brand: 'Glide', category: 'Accessories', price: 1000, stock: 0, rating: 3.5 },
  ]);

  // ---- auth + OTP ----
  let r = await call('POST', '/api/auth/register', { name: 'Test User', email: 'Test@Example.com', password: 'short' });
  t('register rejects short password', r.s === 400, JSON.stringify(r));
  r = await call('POST', '/api/auth/register', { name: 'Test User', email: 'Test@Example.com', password: 'password123', role: 'admin' });
  t('register ok + devOtp returned', r.s === 201 && /^\d{6}$/.test(r.b.devOtp || ''), JSON.stringify(r));
  const otp = r.b.devOtp;
  const u = await User.findOne({ email: 'test@example.com' }).select('+password +otpHash');
  t('role escalation ignored', u.role === 'user');
  t('password hashed', u.password !== 'password123' && u.password.startsWith('$2'));
  t('otp stored hashed', u.otpHash && u.otpHash !== otp);
  r = await call('POST', '/api/auth/login', { email: 'test@example.com', password: 'password123' });
  t('login blocked before verification (403)', r.s === 403 && r.b.details?.needsVerification, JSON.stringify(r));
  const wrong = otp === '000000' ? '111111' : '000000';
  r = await call('POST', '/api/auth/verify-otp', { email: 'test@example.com', otp: wrong });
  t('wrong OTP rejected', r.s === 400, JSON.stringify(r));
  r = await call('POST', '/api/auth/resend-otp', { email: 'test@example.com' });
  t('resend inside cooldown -> 429', r.s === 429, JSON.stringify(r));
  r = await call('POST', '/api/auth/verify-otp', { email: 'test@example.com', otp });
  t('correct OTP verifies + returns token', r.s === 200 && r.b.token && r.b.user.isVerified, JSON.stringify(r));
  const token = r.b.token;
  r = await call('POST', '/api/auth/verify-otp', { email: 'test@example.com', otp });
  t('OTP cannot be reused', r.s === 400, JSON.stringify(r));
  r = await call('POST', '/api/auth/login', { email: 'test@example.com', password: 'nope' });
  t('wrong password -> 401', r.s === 401);
  r = await call('POST', '/api/auth/login', { email: 'test@example.com', password: 'password123' });
  t('login ok', r.s === 200 && r.b.token);
  r = await call('GET', '/api/auth/me', null, token);
  t('me returns user (no password)', r.s === 200 && r.b.user.email === 'test@example.com' && !r.b.user.password);
  r = await call('POST', '/api/auth/register', { name: 'Dup', email: 'test@example.com', password: 'password123' });
  t('duplicate verified email -> 409', r.s === 409);

  // OTP attempt lockout
  r = await call('POST', '/api/auth/register', { name: 'Lock', email: 'lock@example.com', password: 'password123' });
  const lockOtp = r.b.devOtp;
  const bad = lockOtp === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) await call('POST', '/api/auth/verify-otp', { email: 'lock@example.com', otp: bad });
  r = await call('POST', '/api/auth/verify-otp', { email: 'lock@example.com', otp: lockOtp });
  t('OTP locked after 5 wrong attempts (429)', r.s === 429, JSON.stringify(r));

  // OTP expiry
  r = await call('POST', '/api/auth/register', { name: 'Exp', email: 'exp@example.com', password: 'password123' });
  await User.updateOne({ email: 'exp@example.com' }, { otpExpires: new Date(Date.now() - 1000) });
  r = await call('POST', '/api/auth/verify-otp', { email: 'exp@example.com', otp: r.b.devOtp });
  t('expired OTP rejected', r.s === 400 && /expired/i.test(r.b.message), JSON.stringify(r));

  // ---- catalog ----
  r = await call('GET', '/api/products');
  t('list products (public)', r.s === 200 && r.b.total === 3);
  r = await call('GET', '/api/products?search=lap');
  t('partial search "lap"', r.b.total === 1 && r.b.items[0].name === 'Aero Laptop', JSON.stringify(r.b));
  r = await call('GET', '/api/products?category=Phones');
  t('filter by category', r.b.total === 1 && r.b.items[0].name === 'Pulse Phone');
  r = await call('GET', '/api/products?minPrice=15000&maxPrice=80000&sort=price-desc');
  t('price range + sort desc', r.b.total === 2 && r.b.items[0].price === 70000);
  r = await call('GET', '/api/products?inStock=true');
  t('inStock filter', r.b.total === 2);
  r = await call('GET', '/api/products?limit=2&page=2');
  t('pagination', r.b.items.length === 1 && r.b.pages === 2);
  r = await call('GET', '/api/products?search=' + encodeURIComponent('.*'));
  t('regex chars in search are escaped', r.s === 200 && r.b.total === 0);
  r = await call('GET', '/api/products/meta');
  t('meta has categories + price range', r.b.categories.length === 3 && r.b.price.min === 1000 && r.b.price.max === 70000);
  r = await call('GET', '/api/products/not-an-id');
  t('bad id -> 400', r.s === 400);

  // ---- cart ----
  r = await call('POST', '/api/cart', { productId: laptop._id, quantity: 2 }, token);
  t('add to cart', r.s === 201 && r.b.itemCount === 2 && r.b.subtotal === 140000, JSON.stringify(r.b));
  r = await call('POST', '/api/cart', { productId: laptop._id, quantity: 2 }, token);
  t('cannot exceed stock via add (400)', r.s === 400, JSON.stringify(r));
  r = await call('POST', '/api/cart', { productId: mouse._id, quantity: 1 }, token);
  t('cannot add out-of-stock item', r.s === 400);
  r = await call('POST', '/api/cart', { productId: phone._id, quantity: 0 }, token);
  t('quantity 0 rejected', r.s === 400);
  r = await call('PUT', `/api/cart/${laptop._id}`, { quantity: 1 }, token);
  t('set quantity', r.s === 200 && r.b.items[0].quantity === 1);
  r = await call('POST', '/api/cart', { productId: phone._id, quantity: 2 }, token);
  t('cart totals', r.b.itemCount === 3 && r.b.subtotal === 70000 + 40000, JSON.stringify(r.b));

  // ---- orders ----
  const addr = { fullName: 'Test User', phone: '9999999999', line1: '1 Main St', city: 'Thanesar', state: 'Haryana', postalCode: '136118' };
  r = await call('POST', '/api/orders', { shippingAddress: { fullName: 'x' } }, token);
  t('incomplete address -> 400', r.s === 400);
  r = await call('POST', '/api/orders', { shippingAddress: addr, paymentMethod: 'bitcoin' }, token);
  t('invalid payment method -> 400', r.s === 400);

  // race: someone else buys the stock first -> checkout must fail and roll back
  await Product.updateOne({ _id: phone._id }, { stock: 1 });
  r = await call('POST', '/api/orders', { shippingAddress: addr }, token);
  t('insufficient stock at checkout -> 409', r.s === 409, JSON.stringify(r));
  t('earlier lines rolled back (laptop stock still 3)', (await Product.findById(laptop._id)).stock === 3);
  await Product.updateOne({ _id: phone._id }, { stock: 10 });

  r = await call('POST', '/api/orders', { shippingAddress: addr, paymentMethod: 'upi' }, token);
  t('place order', r.s === 201 && r.b.totalPrice === 110000 && r.b.status === 'pending', JSON.stringify(r));
  const orderId = r.b._id;
  t('stock decremented', (await Product.findById(laptop._id)).stock === 2 && (await Product.findById(phone._id)).stock === 8);
  r = await call('GET', '/api/cart', null, token);
  t('cart cleared after order', r.b.items.length === 0);
  r = await call('POST', '/api/orders', { shippingAddress: addr }, token);
  t('empty cart checkout -> 400', r.s === 400);
  r = await call('GET', '/api/orders/mine', null, token);
  t('my orders', r.b.length === 1);

  // price snapshot survives product edits
  await Product.updateOne({ _id: laptop._id }, { price: 99999 });
  r = await call('GET', `/api/orders/${orderId}`, null, token);
  t('order keeps price snapshot', r.b.items.find((i) => i.name === 'Aero Laptop').price === 70000);

  // ---- RBAC ----
  r = await call('GET', '/api/admin/stats', null, token);
  t('user blocked from admin stats (403)', r.s === 403);
  r = await call('POST', '/api/products', { name: 'Hack', price: 1, category: 'x', stock: 1 }, token);
  t('user blocked from creating product (403)', r.s === 403);
  r = await call('GET', '/api/orders', null, token);
  t('user blocked from all-orders (403)', r.s === 403);

  // other user cannot see this order
  r = await call('POST', '/api/auth/register', { name: 'Other', email: 'other@example.com', password: 'password123' });
  r = await call('POST', '/api/auth/verify-otp', { email: 'other@example.com', otp: r.b.devOtp });
  const token2 = r.b.token;
  r = await call('GET', `/api/orders/${orderId}`, null, token2);
  t("other user cannot read someone else's order (403)", r.s === 403);
  r = await call('PUT', `/api/orders/${orderId}/cancel`, null, token2);
  t("other user cannot cancel someone else's order (404)", r.s === 404);

  // ---- admin ----
  r = await call('POST', '/api/auth/login', { email: 'admin@x.dev', password: 'Admin@12345' });
  const admin = r.b.token;
  t('admin login', r.s === 200 && r.b.user.role === 'admin');
  r = await call('GET', '/api/admin/stats', null, admin);
  t('admin stats', r.s === 200 && r.b.orders === 1 && r.b.revenue === 110000 && r.b.users === 3 && r.b.lowStock.some((p) => p.name === 'Glide Mouse'), JSON.stringify(r.b));
  r = await call('POST', '/api/products', { name: 'New Monitor', price: 9000, category: 'Monitors', stock: 7, brand: 'Lumen', isAdmin: true }, admin);
  t('admin creates product', r.s === 201);
  const newId = r.b._id;
  r = await call('POST', '/api/products', { name: 'Bad', price: -5, category: 'x', stock: 1 }, admin);
  t('validation error -> 400', r.s === 400 && r.b.details?.price, JSON.stringify(r));
  r = await call('PATCH', `/api/admin/products/${newId}/stock`, { stock: 25 }, admin);
  t('admin sets stock', r.s === 200 && r.b.stock === 25);
  r = await call('PATCH', `/api/admin/products/${newId}/stock`, { stock: -1 }, admin);
  t('negative stock rejected', r.s === 400);
  r = await call('DELETE', `/api/products/${newId}`, null, admin);
  r = await call('GET', `/api/products/${newId}`);
  t('soft-deleted product hidden from shop', r.s === 404);
  r = await call('GET', '/api/admin/products', null, admin);
  t('inventory still lists removed product', r.b.some((p) => p._id === newId && p.isActive === false));

  r = await call('PUT', `/api/orders/${orderId}/status`, { status: 'delivered' }, admin);
  t('illegal transition pending->delivered rejected', r.s === 400, JSON.stringify(r));
  r = await call('PUT', `/api/orders/${orderId}/status`, { status: 'processing' }, admin);
  t('pending->processing', r.s === 200 && r.b.status === 'processing');
  r = await call('PUT', `/api/orders/${orderId}/cancel`, null, token);
  t('user cannot cancel once processing (400)', r.s === 400);
  r = await call('PUT', `/api/orders/${orderId}/status`, { status: 'cancelled' }, admin);
  t('admin cancel restores stock', r.s === 200 && (await Product.findById(laptop._id)).stock === 3 && (await Product.findById(phone._id)).stock === 10);
  r = await call('GET', '/api/orders?status=cancelled', null, admin);
  t('admin lists orders by status', r.s === 200 && r.b.total === 1 && r.b.items[0].user.email === 'test@example.com');

  // user cancel path
  await call('POST', '/api/cart', { productId: phone._id, quantity: 3 }, token);
  r = await call('POST', '/api/orders', { shippingAddress: addr }, token);
  const o2 = r.b._id;
  t('stock after 2nd order', (await Product.findById(phone._id)).stock === 7);
  r = await call('PUT', `/api/orders/${o2}/cancel`, null, token);
  t('user cancels pending order + stock restored', r.s === 200 && r.b.status === 'cancelled' && (await Product.findById(phone._id)).stock === 10);

  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  server.close();
  await mongoose.disconnect();
  await mms.stop();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('E2E crashed:', e.message); process.exit(2); });

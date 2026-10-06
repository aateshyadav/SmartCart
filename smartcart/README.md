# SmartCart

A full-stack e-commerce platform built with **React**, **Node.js/Express** and **MongoDB**.

- Secure **JWT authentication** with **role-based access control** (`user` / `admin`)
- **OTP-based email verification** at sign-up (hashed, expiring, attempt-limited)
- **REST APIs** for the product catalog, cart, orders and search with filtering, sorting and pagination
- **Admin dashboard** for inventory management, order fulfilment and sales stats
- **Responsive React UI** that works on phones, tablets and desktops

## Project structure

```
smartcart/
├── server/                     Express + Mongoose API
│   ├── src/
│   │   ├── config/db.js
│   │   ├── models/             User, Product, Cart, Order
│   │   ├── middleware/         auth (protect, authorize), error handling
│   │   ├── controllers/        auth, product, cart, order, admin
│   │   ├── routes/
│   │   ├── utils/              otp, mailer, asyncHandler, HttpError
│   │   ├── app.js
│   │   ├── server.js
│   │   └── seed.js             sample products + admin account
│   └── test/e2e.js             end-to-end API test (see Testing)
└── client/                     React (Vite) single-page app
    └── src/
        ├── api/client.js       fetch wrapper, attaches the JWT
        ├── context/            Auth, Cart, Toast
        ├── components/         Navbar, ProductCard, ProtectedRoute
        └── pages/              Home, ProductDetail, Cart, Checkout, Orders,
                                Login, Register, VerifyOtp, admin/*
```

## Quick start

**Requirements:** Node.js 18+ and a MongoDB instance (local install or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster).

### 1. API

```bash
cd server
npm install
cp .env.example .env        # then edit MONGO_URI and set a long random JWT_SECRET
npm run seed                # 16 sample products + the admin account
npm run dev                 # http://localhost:5000
```

### 2. Client

```bash
cd client
npm install
npm run dev                 # http://localhost:5173  (proxies /api to :5000)
```

### 3. Try it

- **Admin login:** `admin@smartcart.dev` / `Admin@12345` (change these in `.env` before seeding)
- **Customer flow:** sign up → enter the OTP → shop → cart → checkout → orders

**About the OTP email:** if `SMTP_HOST` is empty, the OTP is printed in the server console and shown on the verify page (development only; this is switched off when `NODE_ENV=production`). To send real emails, fill in the `SMTP_*` variables in `.env` (Gmail app password, Mailtrap, SendGrid SMTP, etc.).

## API reference

All routes are prefixed with `/api`. Protected routes expect `Authorization: Bearer <token>`.

### Auth

| Method | Route | Access | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | public | Create an account and email an OTP. `role` in the body is ignored. |
| POST | `/auth/verify-otp` | public | `{ email, otp }`. Verifies the account and returns `{ token, user }`. |
| POST | `/auth/resend-otp` | public | New OTP, 30 s cooldown. Responds the same whether or not the email exists. |
| POST | `/auth/login` | public | Returns `{ token, user }`. Unverified accounts get 403. |
| GET | `/auth/me` | user | Current user. |

### Products

| Method | Route | Access | Description |
| --- | --- | --- | --- |
| GET | `/products` | public | Search, filter, sort, paginate (see below). |
| GET | `/products/meta` | public | Categories, brands and price range for filter UIs. |
| GET | `/products/:id` | public | Single product. |
| POST | `/products` | admin | Create. |
| PUT | `/products/:id` | admin | Update. |
| DELETE | `/products/:id` | admin | Soft delete (hidden from shop, kept for order history). |

`GET /products` query parameters: `search`, `category`, `brand`, `minPrice`, `maxPrice`, `inStock=true`, `sort` (`newest`, `price-asc`, `price-desc`, `rating`, `name`), `page`, `limit` (max 50).

### Cart (user)

| Method | Route | Description |
| --- | --- | --- |
| GET | `/cart` | Lines, `subtotal`, `itemCount`. |
| POST | `/cart` | `{ productId, quantity }` adds to the existing quantity. Stock is checked. |
| PUT | `/cart/:productId` | `{ quantity }` sets the exact quantity. |
| DELETE | `/cart/:productId` | Remove a line. |
| DELETE | `/cart` | Empty the cart. |

### Orders

| Method | Route | Access | Description |
| --- | --- | --- | --- |
| POST | `/orders` | user | Check out the cart: `{ shippingAddress, paymentMethod }`. |
| GET | `/orders/mine` | user | Your order history. |
| GET | `/orders/:id` | owner / admin | Order detail. |
| PUT | `/orders/:id/cancel` | owner | Only while `pending`. Restores stock. |
| GET | `/orders` | admin | All orders, `?status=&page=&limit=`. |
| PUT | `/orders/:id/status` | admin | `pending → processing → shipped → delivered`, or cancel before shipping. |

### Admin

| Method | Route | Description |
| --- | --- | --- |
| GET | `/admin/stats` | Revenue, counts, orders by status, low-stock list. |
| GET | `/admin/products` | Full inventory including removed products. |
| PATCH | `/admin/products/:id/stock` | `{ stock }` quick stock update. |

## Design notes

- **Passwords** are hashed with bcrypt (cost 12). **OTPs** are stored as an HMAC, never in plain text, expire after `OTP_TTL_MINUTES`, and lock after `OTP_MAX_ATTEMPTS` wrong guesses. Comparison is constant-time.
- **Roles are never trusted from the client.** New accounts are always `user`; admins are created by the seed script or directly in the database.
- **Prices come from the database.** Checkout recalculates totals server-side, and each order stores a snapshot of name, image and price so history stays correct if a product changes later.
- **Stock can't oversell.** Checkout reserves each line with an atomic `findOneAndUpdate({ stock: { $gte: qty } })`. If any line fails, the lines already reserved are given back. Cancelling an order restores stock. (This approach works on a standalone MongoDB; with a replica set you could swap in a multi-document transaction.)
- **Rate limiting** on the auth endpoints, `helmet` security headers, request-size limit, and regex-escaped search input.
- **Client:** the API wrapper logs the user out automatically on any 401; the cart is always re-read from the server after each change; search and price inputs are debounced; filter state resets pagination.

## Testing

`server/test/e2e.js` is an end-to-end test of the whole API (auth and OTP edge cases, search and filters, cart, checkout with stock rollback, RBAC, admin flows). It starts an in-memory MongoDB, so no database setup is needed:

```bash
cd server
npm install
npm run test:e2e
```

The first run downloads a MongoDB binary (needs internet access).

## Ideas for next steps

- Payment gateway integration (Razorpay / Stripe) in place of the recorded-only payment method
- Product reviews, wishlists and image upload (Cloudinary / S3)
- Refresh tokens or httpOnly-cookie auth
- Pagination and search on the admin order list; CSV export
- Docker Compose for one-command local setup, and CI to run the e2e test

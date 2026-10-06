const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');

const ADDRESS_FIELDS = ['fullName', 'phone', 'line1', 'city', 'state', 'postalCode'];
const STATUS_FLOW = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

// Atomically take stock for each line. If any line can't be satisfied, give back what was taken.
async function reserveStock(lines) {
  const reserved = [];
  try {
    for (const l of lines) {
      const updated = await Product.findOneAndUpdate(
        { _id: l.product, isActive: true, stock: { $gte: l.quantity } },
        { $inc: { stock: -l.quantity } },
        { new: true }
      );
      if (!updated) throw new HttpError(409, `"${l.name}" is out of stock or has insufficient quantity`);
      reserved.push(l);
    }
  } catch (err) {
    await releaseStock(reserved);
    throw err;
  }
}

async function releaseStock(lines) {
  await Promise.all(lines.map((l) => Product.updateOne({ _id: l.product }, { $inc: { stock: l.quantity } })));
}

// POST /api/orders  { shippingAddress, paymentMethod }  -> checks out the user's cart
exports.placeOrder = asyncHandler(async (req, res) => {
  const { shippingAddress = {}, paymentMethod = 'cod' } = req.body;
  const missing = ADDRESS_FIELDS.filter((f) => !String(shippingAddress[f] || '').trim());
  if (missing.length) throw new HttpError(400, 'Incomplete shipping address', { missing });
  if (!['cod', 'card', 'upi'].includes(paymentMethod)) throw new HttpError(400, 'Invalid payment method');

  const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
  const live = (cart ? cart.items : []).filter((l) => l.product && l.product.isActive);
  if (!live.length) throw new HttpError(400, 'Your cart is empty');

  // Price comes from the database, never from the client
  const lines = live.map((l) => ({
    product: l.product._id,
    name: l.product.name,
    image: l.product.image,
    price: l.product.price,
    quantity: l.quantity,
  }));
  const totalPrice = Number(lines.reduce((s, l) => s + l.price * l.quantity, 0).toFixed(2));

  await reserveStock(lines);

  let order;
  try {
    order = await Order.create({
      user: req.user._id,
      items: lines,
      shippingAddress: Object.fromEntries(ADDRESS_FIELDS.map((f) => [f, String(shippingAddress[f]).trim()])),
      paymentMethod,
      totalPrice,
    });
  } catch (err) {
    await releaseStock(lines);
    throw err;
  }

  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
  res.status(201).json(order);
});

// GET /api/orders/mine
exports.myOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json(orders);
});

// GET /api/orders/:id  (owner or admin)
exports.getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email').lean();
  if (!order) throw new HttpError(404, 'Order not found');
  const ownerId = String(order.user._id || order.user);
  if (req.user.role !== 'admin' && ownerId !== String(req.user._id)) {
    throw new HttpError(403, 'You do not have access to this order');
  }
  res.json(order);
});

// PUT /api/orders/:id/cancel  (owner, only while pending)
exports.cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.status !== 'pending') throw new HttpError(400, 'Only pending orders can be cancelled');

  order.status = 'cancelled';
  await order.save();
  await releaseStock(order.items);
  res.json(order);
});

// GET /api/orders  (admin)  ?status=&page=&limit=
exports.allOrders = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const filter = req.query.status ? { status: req.query.status } : {};

  const [items, total] = await Promise.all([
    Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);
  res.json({ items, page, limit, total, pages: Math.ceil(total / limit) });
});

// PUT /api/orders/:id/status  (admin)
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) throw new HttpError(404, 'Order not found');
  if (!(status in STATUS_FLOW)) throw new HttpError(400, 'Invalid status');
  if (!STATUS_FLOW[order.status].includes(status)) {
    throw new HttpError(400, `Cannot move an order from "${order.status}" to "${status}"`);
  }

  order.status = status;
  await order.save();
  if (status === 'cancelled') await releaseStock(order.items);
  res.json(order);
});

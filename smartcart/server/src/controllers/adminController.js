const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

const LOW_STOCK_THRESHOLD = 5;

// GET /api/admin/stats
exports.stats = asyncHandler(async (req, res) => {
  const [users, products, orders, revenueAgg, byStatus, lowStock] = await Promise.all([
    User.countDocuments({ role: 'user', isVerified: true }),
    Product.countDocuments({ isActive: true }),
    Order.countDocuments(),
    Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, revenue: { $sum: '$totalPrice' } } },
    ]),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Product.find({ isActive: true, stock: { $lte: LOW_STOCK_THRESHOLD } })
      .sort({ stock: 1 })
      .limit(10)
      .select('name stock category')
      .lean(),
  ]);

  res.json({
    users,
    products,
    orders,
    revenue: revenueAgg[0] ? Number(revenueAgg[0].revenue.toFixed(2)) : 0,
    ordersByStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    lowStock,
  });
});

// GET /api/admin/products  -> includes inactive items, for inventory management
exports.inventory = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = {};
  if (search && search.trim()) {
    const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { category: rx }, { brand: rx }];
  }
  const items = await Product.find(filter).sort({ updatedAt: -1 }).lean();
  res.json(items);
});

// PATCH /api/admin/products/:id/stock  { stock }
exports.setStock = asyncHandler(async (req, res, next) => {
  const stock = Number(req.body.stock);
  if (!Number.isInteger(stock) || stock < 0) {
    return res.status(400).json({ message: 'Stock must be a whole number, zero or more' });
  }
  const product = await Product.findByIdAndUpdate(req.params.id, { stock }, { new: true });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
});

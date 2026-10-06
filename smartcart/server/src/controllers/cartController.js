const Cart = require('../models/Cart');
const Product = require('../models/Product');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');

// Builds the response shape: populated lines + totals. Drops lines whose product was removed.
async function buildCartView(userId) {
  const cart = await Cart.findOne({ user: userId }).populate('items.product');
  const items = (cart ? cart.items : [])
    .filter((l) => l.product && l.product.isActive)
    .map((l) => ({
      product: l.product,
      quantity: l.quantity,
      lineTotal: Number((l.product.price * l.quantity).toFixed(2)),
    }));
  const subtotal = Number(items.reduce((s, l) => s + l.lineTotal, 0).toFixed(2));
  const itemCount = items.reduce((s, l) => s + l.quantity, 0);
  return { items, subtotal, itemCount };
}

const toQty = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 99) throw new HttpError(400, 'Quantity must be a whole number from 1 to 99');
  return n;
};

// GET /api/cart
exports.getCart = asyncHandler(async (req, res) => {
  res.json(await buildCartView(req.user._id));
});

// POST /api/cart  { productId, quantity }  -> adds to existing quantity
exports.addItem = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const quantity = toQty(req.body.quantity ?? 1);

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw new HttpError(404, 'Product not found');

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) cart = new Cart({ user: req.user._id, items: [] });

  const line = cart.items.find((l) => l.product.equals(product._id));
  const nextQty = (line ? line.quantity : 0) + quantity;
  if (nextQty > product.stock) {
    throw new HttpError(400, `Only ${product.stock} unit(s) of "${product.name}" in stock`);
  }

  if (line) line.quantity = nextQty;
  else cart.items.push({ product: product._id, quantity });
  await cart.save();

  res.status(201).json(await buildCartView(req.user._id));
});

// PUT /api/cart/:productId  { quantity }  -> sets exact quantity
exports.updateItem = asyncHandler(async (req, res) => {
  const quantity = toQty(req.body.quantity);
  const product = await Product.findOne({ _id: req.params.productId, isActive: true });
  if (!product) throw new HttpError(404, 'Product not found');
  if (quantity > product.stock) {
    throw new HttpError(400, `Only ${product.stock} unit(s) of "${product.name}" in stock`);
  }

  const cart = await Cart.findOne({ user: req.user._id });
  const line = cart && cart.items.find((l) => l.product.equals(product._id));
  if (!line) throw new HttpError(404, 'Item not in cart');

  line.quantity = quantity;
  await cart.save();
  res.json(await buildCartView(req.user._id));
});

// DELETE /api/cart/:productId
exports.removeItem = asyncHandler(async (req, res) => {
  await Cart.updateOne({ user: req.user._id }, { $pull: { items: { product: req.params.productId } } });
  res.json(await buildCartView(req.user._id));
});

// DELETE /api/cart
exports.clearCart = asyncHandler(async (req, res) => {
  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
  res.json(await buildCartView(req.user._id));
});

const Product = require('../models/Product');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SORTS = {
  newest: { createdAt: -1 },
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
  rating: { rating: -1 },
  name: { name: 1 },
};
const EDITABLE = ['name', 'description', 'price', 'category', 'brand', 'image', 'stock', 'rating', 'isActive'];
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

// GET /api/products?search=&category=&brand=&minPrice=&maxPrice=&inStock=&sort=&page=&limit=
exports.listProducts = asyncHandler(async (req, res) => {
  const { search, category, brand, minPrice, maxPrice, inStock, sort = 'newest' } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);

  const filter = { isActive: true };
  if (search && search.trim()) {
    // Regex over name/brand/category so partial words match ("lap" -> "Laptop")
    const rx = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ name: rx }, { brand: rx }, { category: rx }, { description: rx }];
  }
  if (category) filter.category = category;
  if (brand) filter.brand = brand;
  const price = {};
  if (minPrice !== undefined && minPrice !== '' && !Number.isNaN(Number(minPrice))) price.$gte = Number(minPrice);
  if (maxPrice !== undefined && maxPrice !== '' && !Number.isNaN(Number(maxPrice))) price.$lte = Number(maxPrice);
  if (Object.keys(price).length) filter.price = price;
  if (inStock === 'true') filter.stock = { $gt: 0 };

  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort(SORTS[sort] || SORTS.newest)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  res.json({ items, page, limit, total, pages: Math.ceil(total / limit) });
});

// GET /api/products/meta  -> filter options for the UI
exports.productMeta = asyncHandler(async (req, res) => {
  const [categories, brands, priceRange] = await Promise.all([
    Product.distinct('category', { isActive: true }),
    Product.distinct('brand', { isActive: true }),
    Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } },
    ]),
  ]);
  res.json({
    categories: categories.sort(),
    brands: brands.filter(Boolean).sort(),
    price: priceRange[0] ? { min: priceRange[0].min, max: priceRange[0].max } : { min: 0, max: 0 },
  });
});

// GET /api/products/:id
exports.getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, isActive: true }).lean();
  if (!product) throw new HttpError(404, 'Product not found');
  res.json(product);
});

// POST /api/products  (admin)
exports.createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(pick(req.body, EDITABLE));
  res.status(201).json(product);
});

// PUT /api/products/:id  (admin)
exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, pick(req.body, EDITABLE), {
    new: true,
    runValidators: true,
  });
  if (!product) throw new HttpError(404, 'Product not found');
  res.json(product);
});

// DELETE /api/products/:id  (admin) - soft delete keeps order history intact
exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!product) throw new HttpError(404, 'Product not found');
  res.json({ message: 'Product removed' });
});

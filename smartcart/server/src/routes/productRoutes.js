const router = require('express').Router();
const ctrl = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');

// Public
router.get('/', ctrl.listProducts);
router.get('/meta', ctrl.productMeta);
router.get('/:id', ctrl.getProduct);

// Admin only
router.post('/', protect, authorize('admin'), ctrl.createProduct);
router.put('/:id', protect, authorize('admin'), ctrl.updateProduct);
router.delete('/:id', protect, authorize('admin'), ctrl.deleteProduct);

module.exports = router;

const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('admin'));

router.get('/stats', ctrl.stats);
router.get('/products', ctrl.inventory);
router.patch('/products/:id/stock', ctrl.setStock);

module.exports = router;

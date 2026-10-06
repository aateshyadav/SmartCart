const router = require('express').Router();
const ctrl = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.post('/', ctrl.placeOrder);
router.get('/mine', ctrl.myOrders);

// Admin
router.get('/', authorize('admin'), ctrl.allOrders);
router.put('/:id/status', authorize('admin'), ctrl.updateStatus);

// Owner (or admin for read)
router.get('/:id', ctrl.getOrder);
router.put('/:id/cancel', ctrl.cancelOrder);

module.exports = router;

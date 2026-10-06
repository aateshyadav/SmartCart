const router = require('express').Router();
const ctrl = require('../controllers/cartController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', ctrl.getCart);
router.post('/', ctrl.addItem);
router.delete('/', ctrl.clearCart);
router.put('/:productId', ctrl.updateItem);
router.delete('/:productId', ctrl.removeItem);

module.exports = router;

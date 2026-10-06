import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { money } from '../utils';

export default function Cart() {
  const { user } = useAuth();
  const { cart, setQty, remove, busy } = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="container narrow">
        <div className="empty card">
          <h2>Your cart is waiting</h2>
          <p className="muted">Log in to see the items you've added.</p>
          <Link className="btn btn-primary" to="/login" state={{ from: '/cart' }}>
            Log in
          </Link>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="container narrow">
        <div className="empty card">
          <h2>Your cart is empty</h2>
          <p className="muted">Browse the shop and add something you like.</p>
          <Link className="btn btn-primary" to="/">
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  const change = async (fn) => {
    try {
      await fn();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="container">
      <h1 className="page-title">Shopping cart</h1>
      <div className="cart-layout">
        <div className="card cart-lines">
          {cart.items.map(({ product, quantity, lineTotal }) => (
            <div className="cart-line" key={product._id}>
              <img src={product.image} alt={product.name} />
              <div className="cart-line-info">
                <Link to={`/product/${product._id}`} className="product-name">
                  {product.name}
                </Link>
                <span className="muted small">{money(product.price)} each</span>
                {product.stock < quantity && <span className="stock-out small">Only {product.stock} in stock</span>}
                <button className="link-btn danger" disabled={busy} onClick={() => change(() => remove(product._id))}>
                  Remove
                </button>
              </div>
              <div className="qty">
                <button
                  disabled={busy || quantity <= 1}
                  onClick={() => change(() => setQty(product._id, quantity - 1))}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span>{quantity}</span>
                <button
                  disabled={busy || quantity >= product.stock}
                  onClick={() => change(() => setQty(product._id, quantity + 1))}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <strong className="line-total">{money(lineTotal)}</strong>
            </div>
          ))}
        </div>

        <aside className="card summary">
          <h3>Order summary</h3>
          <div className="summary-row">
            <span>Items ({cart.itemCount})</span>
            <span>{money(cart.subtotal)}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span className="stock-ok">Free</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{money(cart.subtotal)}</span>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => navigate('/checkout')}>
            Proceed to checkout
          </button>
        </aside>
      </div>
    </div>
  );
}

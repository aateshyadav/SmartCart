import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { money } from '../utils';

const FIELDS = [
  ['fullName', 'Full name', 'text'],
  ['phone', 'Phone number', 'tel'],
  ['line1', 'Address', 'text'],
  ['city', 'City', 'text'],
  ['state', 'State', 'text'],
  ['postalCode', 'PIN code', 'text'],
];

export default function Checkout() {
  const { user } = useAuth();
  const { cart, refresh } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [address, setAddress] = useState({
    fullName: user?.name || '',
    phone: '',
    line1: '',
    city: '',
    state: '',
    postalCode: '',
  });
  const [payment, setPayment] = useState('cod');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (cart.items.length === 0) {
    return (
      <div className="container narrow">
        <div className="empty card">
          <h2>Nothing to check out</h2>
          <Link className="btn btn-primary" to="/">
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const order = await api.placeOrder({ shippingAddress: address, paymentMethod: payment });
      await refresh();
      toast.success('Order placed successfully');
      navigate('/orders', { state: { placed: order._id } });
    } catch (err) {
      setError(err.message);
      refresh(); // stock may have changed, so show the current cart
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container">
      <h1 className="page-title">Checkout</h1>
      <form className="cart-layout" onSubmit={submit}>
        <div className="card form-card">
          <h3>Shipping address</h3>
          <div className="form-grid">
            {FIELDS.map(([key, label, type]) => (
              <label className={`field ${key === 'line1' ? 'span-2' : ''}`} key={key}>
                <span>{label}</span>
                <input
                  className="input"
                  type={type}
                  required
                  value={address[key]}
                  onChange={(e) => setAddress((a) => ({ ...a, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>

          <h3>Payment method</h3>
          <div className="radio-group">
            {[
              ['cod', 'Cash on delivery'],
              ['upi', 'UPI'],
              ['card', 'Card'],
            ].map(([v, l]) => (
              <label key={v} className={`radio ${payment === v ? 'active' : ''}`}>
                <input type="radio" name="payment" value={v} checked={payment === v} onChange={() => setPayment(v)} />
                {l}
              </label>
            ))}
          </div>
          <p className="muted small">
            This is a demo store: no real payment is taken. The method is recorded on the order only.
          </p>
        </div>

        <aside className="card summary">
          <h3>Your order</h3>
          {cart.items.map(({ product, quantity, lineTotal }) => (
            <div className="summary-row" key={product._id}>
              <span>
                {product.name} × {quantity}
              </span>
              <span>{money(lineTotal)}</span>
            </div>
          ))}
          <div className="summary-row total">
            <span>Total</span>
            <span>{money(cart.subtotal)}</span>
          </div>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Placing order…' : 'Place order'}
          </button>
        </aside>
      </form>
    </div>
  );
}

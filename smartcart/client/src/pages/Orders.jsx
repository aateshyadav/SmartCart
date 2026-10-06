import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { formatDate, money, STATUS_LABEL } from '../utils';

export default function Orders() {
  const toast = useToast();
  const location = useLocation();
  const placed = location.state?.placed;
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.myOrders().then(setOrders).catch((e) => setError(e.message));
  }, []);

  const cancel = async (id) => {
    if (!window.confirm('Cancel this order?')) return;
    try {
      const updated = await api.cancelOrder(id);
      setOrders((list) => list.map((o) => (o._id === id ? updated : o)));
      toast.success('Order cancelled');
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (error) return <div className="container narrow"><div className="alert alert-error">{error}</div></div>;
  if (!orders) return <div className="page-loading">Loading…</div>;

  return (
    <div className="container narrow">
      <h1 className="page-title">Your orders</h1>
      {placed && <div className="alert alert-success">Thanks! Your order was placed.</div>}

      {orders.length === 0 ? (
        <div className="empty card">
          <h3>No orders yet</h3>
          <Link className="btn btn-primary" to="/">
            Start shopping
          </Link>
        </div>
      ) : (
        orders.map((o) => (
          <article className={`card order ${o._id === placed ? 'highlight' : ''}`} key={o._id}>
            <header className="order-head">
              <div>
                <strong>Order #{o._id.slice(-8).toUpperCase()}</strong>
                <div className="muted small">Placed {formatDate(o.createdAt)}</div>
              </div>
              <span className={`status status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
            </header>
            <ul className="order-items">
              {o.items.map((i) => (
                <li key={i.product}>
                  <img src={i.image} alt="" />
                  <span>
                    {i.name} <span className="muted">× {i.quantity}</span>
                  </span>
                  <span>{money(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <footer className="order-foot">
              <span className="muted small">
                Ship to {o.shippingAddress.city}, {o.shippingAddress.state} · {o.paymentMethod.toUpperCase()}
              </span>
              <strong>{money(o.totalPrice)}</strong>
              {o.status === 'pending' && (
                <button className="btn btn-ghost btn-sm" onClick={() => cancel(o._id)}>
                  Cancel order
                </button>
              )}
            </footer>
          </article>
        ))
      )}
    </div>
  );
}

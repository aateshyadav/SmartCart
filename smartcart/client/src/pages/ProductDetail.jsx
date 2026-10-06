import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { money } from '../utils';

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { add, busy } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    setProduct(null);
    setError('');
    api.product(id).then(setProduct).catch((e) => setError(e.message));
  }, [id]);

  if (error)
    return (
      <div className="container narrow">
        <div className="alert alert-error">{error}</div>
        <Link to="/">← Back to shop</Link>
      </div>
    );
  if (!product) return <div className="page-loading">Loading…</div>;

  const out = product.stock === 0;

  const handleAdd = async () => {
    if (!user) return navigate('/login', { state: { from: `/product/${id}` } });
    try {
      await add(product._id, qty);
      toast.success(`Added ${qty} × "${product.name}" to cart`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="container">
      <Link to="/" className="back-link">
        ← Back to shop
      </Link>
      <div className="detail card">
        <img className="detail-img" src={product.image} alt={product.name} />
        <div className="detail-info">
          <span className="muted small">
            {product.category}
            {product.brand ? ` · ${product.brand}` : ''}
          </span>
          <h1>{product.name}</h1>
          <div className="rating">★ {product.rating.toFixed(1)}</div>
          <p className="detail-desc">{product.description}</p>
          <strong className="price price-lg">{money(product.price)}</strong>
          <p className={out ? 'stock-out' : product.stock <= 5 ? 'stock-low' : 'stock-ok'}>
            {out ? 'Out of stock' : product.stock <= 5 ? `Only ${product.stock} left` : 'In stock'}
          </p>

          {!out && (
            <div className="buy-row">
              <div className="qty">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
                  −
                </button>
                <span>{qty}</span>
                <button onClick={() => setQty((q) => Math.min(product.stock, q + 1))} aria-label="Increase quantity">
                  +
                </button>
              </div>
              <button className="btn btn-primary" disabled={busy} onClick={handleAdd}>
                Add to cart
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

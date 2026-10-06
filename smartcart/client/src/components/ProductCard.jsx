import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { money } from '../utils';

export default function ProductCard({ product }) {
  const { user } = useAuth();
  const { add, busy } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const out = product.stock === 0;

  const handleAdd = async () => {
    if (!user) return navigate('/login', { state: { from: '/' } });
    try {
      await add(product._id, 1);
      toast.success(`Added "${product.name}" to cart`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <article className="card product-card">
      <Link to={`/product/${product._id}`} className="product-img-wrap">
        <img src={product.image} alt={product.name} loading="lazy" />
        {out && <span className="tag tag-out">Out of stock</span>}
        {!out && product.stock <= 5 && <span className="tag tag-low">Only {product.stock} left</span>}
      </Link>
      <div className="product-body">
        <span className="muted small">{product.brand || product.category}</span>
        <Link to={`/product/${product._id}`} className="product-name">
          {product.name}
        </Link>
        <div className="rating" aria-label={`Rated ${product.rating} out of 5`}>
          ★ {product.rating.toFixed(1)}
        </div>
        <div className="product-foot">
          <strong className="price">{money(product.price)}</strong>
          <button className="btn btn-primary btn-sm" disabled={out || busy} onClick={handleAdd}>
            {out ? 'Sold out' : 'Add to cart'}
          </button>
        </div>
      </div>
    </article>
  );
}

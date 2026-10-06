import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { money, STATUS_LABEL } from '../../utils';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.adminStats().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!stats) return <div className="page-loading">Loading…</div>;

  const cards = [
    ['Revenue', money(stats.revenue)],
    ['Orders', stats.orders],
    ['Products', stats.products],
    ['Customers', stats.users],
  ];

  return (
    <>
      <div className="stat-grid">
        {cards.map(([label, value]) => (
          <div className="card stat" key={label}>
            <span className="muted small">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="two-col">
        <section className="card pad">
          <h3>Orders by status</h3>
          {Object.keys(STATUS_LABEL).map((s) => (
            <div className="summary-row" key={s}>
              <span className={`status status-${s}`}>{STATUS_LABEL[s]}</span>
              <strong>{stats.ordersByStatus[s] || 0}</strong>
            </div>
          ))}
        </section>

        <section className="card pad">
          <h3>Low stock (≤ {stats.lowStockThreshold})</h3>
          {stats.lowStock.length === 0 ? (
            <p className="muted">Everything is well stocked.</p>
          ) : (
            stats.lowStock.map((p) => (
              <div className="summary-row" key={p._id}>
                <span>{p.name}</span>
                <strong className={p.stock === 0 ? 'stock-out' : 'stock-low'}>{p.stock === 0 ? 'Out' : p.stock}</strong>
              </div>
            ))
          )}
          <Link to="/admin/products" className="small">
            Manage inventory →
          </Link>
        </section>
      </div>
    </>
  );
}

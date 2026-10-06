import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatDate, money, NEXT_STATUS, STATUS_LABEL } from '../../utils';

export default function AdminOrders() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api
      .allOrders({ status, page, limit: 10 })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [status, page]);

  const move = async (order, next) => {
    try {
      const updated = await api.setOrderStatus(order._id, next);
      setData((d) => ({ ...d, items: d.items.map((o) => (o._id === order._id ? { ...o, status: updated.status } : o)) }));
      toast.success(`Order marked ${STATUS_LABEL[next].toLowerCase()}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <div className="toolbar">
        <label className="sort">
          Status
          <select
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!data && !error && <div className="page-loading">Loading…</div>}

      {data && (
        <>
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Update</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o._id}>
                    <td>
                      <strong>#{o._id.slice(-8).toUpperCase()}</strong>
                      <div className="muted small">{formatDate(o.createdAt)}</div>
                    </td>
                    <td>
                      {o.user?.name || 'Deleted user'}
                      <div className="muted small">{o.user?.email}</div>
                    </td>
                    <td>{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                    <td>{money(o.totalPrice)}</td>
                    <td>
                      <span className={`status status-${o.status}`}>{STATUS_LABEL[o.status]}</span>
                    </td>
                    <td className="actions">
                      {NEXT_STATUS[o.status].length === 0 && <span className="muted small">Final</span>}
                      {NEXT_STATUS[o.status].map((n) => (
                        <button key={n} className={`link-btn ${n === 'cancelled' ? 'danger' : ''}`} onClick={() => move(o, n)}>
                          {STATUS_LABEL[n]}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="center muted">
                      No orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data.pages > 1 && (
            <div className="pagination">
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Previous
              </button>
              <span className="muted">
                Page {page} of {data.pages}
              </span>
              <button className="btn btn-ghost btn-sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

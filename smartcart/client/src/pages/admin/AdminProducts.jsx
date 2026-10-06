import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { money, useDebounce } from '../../utils';

const BLANK = { name: '', description: '', price: '', category: '', brand: '', image: '', stock: '', rating: '' };

function ProductForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ? { ...BLANK, ...initial } : BLANK);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave({
        name: form.name,
        description: form.description,
        price: Number(form.price),
        category: form.category,
        brand: form.brand,
        image: form.image,
        stock: Number(form.stock),
        rating: form.rating === '' ? 0 : Number(form.rating),
      });
    } catch (err) {
      setError(err.details ? Object.values(err.details).join(', ') : err.message);
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal card" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}>
        <h3>{initial ? 'Edit product' : 'Add product'}</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <label className="field span-2">
            <span>Name</span>
            <input className="input" required value={form.name} onChange={set('name')} />
          </label>
          <label className="field">
            <span>Category</span>
            <input className="input" required value={form.category} onChange={set('category')} />
          </label>
          <label className="field">
            <span>Brand</span>
            <input className="input" value={form.brand} onChange={set('brand')} />
          </label>
          <label className="field">
            <span>Price (₹)</span>
            <input className="input" type="number" min="0" step="0.01" required value={form.price} onChange={set('price')} />
          </label>
          <label className="field">
            <span>Stock</span>
            <input className="input" type="number" min="0" step="1" required value={form.stock} onChange={set('stock')} />
          </label>
          <label className="field">
            <span>Rating (0–5)</span>
            <input className="input" type="number" min="0" max="5" step="0.1" value={form.rating} onChange={set('rating')} />
          </label>
          <label className="field">
            <span>Image URL</span>
            <input className="input" type="url" value={form.image} onChange={set('image')} />
          </label>
          <label className="field span-2">
            <span>Description</span>
            <textarea className="input" rows={3} value={form.description} onChange={set('description')} />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

function StockCell({ product, onSaved }) {
  const toast = useToast();
  const [value, setValue] = useState(String(product.stock));
  const dirty = value !== String(product.stock);

  useEffect(() => setValue(String(product.stock)), [product.stock]);

  const save = async () => {
    try {
      const updated = await api.adminSetStock(product._id, Number(value));
      onSaved(updated);
      toast.success('Stock updated');
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="stock-edit">
      <input
        className="input input-sm"
        type="number"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={`Stock for ${product.name}`}
      />
      {dirty && (
        <button className="btn btn-primary btn-sm" onClick={save}>
          Save
        </button>
      )}
    </div>
  );
}

export default function AdminProducts() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | product
  const [error, setError] = useState('');
  const q = useDebounce(search);

  const load = useCallback(() => {
    api
      .adminProducts({ search: q })
      .then(setItems)
      .catch((e) => setError(e.message));
  }, [q]);

  useEffect(load, [load]);

  const replace = (updated) => setItems((list) => list.map((p) => (p._id === updated._id ? updated : p)));

  const save = async (data) => {
    if (editing === 'new') await api.createProduct(data);
    else await api.updateProduct(editing._id, data);
    toast.success(editing === 'new' ? 'Product created' : 'Product updated');
    setEditing(null);
    load();
  };

  const toggleActive = async (p) => {
    try {
      if (p.isActive) {
        if (!window.confirm(`Remove "${p.name}" from the shop? Past orders are unaffected.`)) return;
        await api.deleteProduct(p._id);
        replace({ ...p, isActive: false });
        toast.success('Product removed from the shop');
      } else {
        replace(await api.updateProduct(p._id, { isActive: true }));
        toast.success('Product restored');
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <>
      <div className="toolbar">
        <input
          className="input"
          type="search"
          placeholder="Search inventory…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          + Add product
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {!items && !error && <div className="page-loading">Loading…</div>}

      {items && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p._id} className={p.isActive ? '' : 'row-muted'}>
                  <td>
                    <div className="cell-product">
                      <img src={p.image} alt="" />
                      <div>
                        <strong>{p.name}</strong>
                        <div className="muted small">{p.brand}</div>
                      </div>
                    </div>
                  </td>
                  <td>{p.category}</td>
                  <td>{money(p.price)}</td>
                  <td>
                    <StockCell product={p} onSaved={replace} />
                  </td>
                  <td>
                    <span className={`status ${p.isActive ? 'status-delivered' : 'status-cancelled'}`}>
                      {p.isActive ? 'Live' : 'Removed'}
                    </span>
                  </td>
                  <td className="actions">
                    <button className="link-btn" onClick={() => setEditing(p)}>
                      Edit
                    </button>
                    <button className={`link-btn ${p.isActive ? 'danger' : ''}`} onClick={() => toggleActive(p)}>
                      {p.isActive ? 'Remove' : 'Restore'}
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="center muted">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && <ProductForm initial={editing === 'new' ? null : editing} onSave={save} onClose={() => setEditing(null)} />}
    </>
  );
}

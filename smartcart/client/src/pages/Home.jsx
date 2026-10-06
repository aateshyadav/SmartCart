import { useEffect, useState } from 'react';
import { api } from '../api/client';
import ProductCard from '../components/ProductCard';
import { useDebounce } from '../utils';

const SORT_OPTIONS = [
  ['newest', 'Newest'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['rating', 'Top rated'],
  ['name', 'Name A–Z'],
];

const DEFAULTS = { search: '', category: '', brand: '', minPrice: '', maxPrice: '', inStock: false, sort: 'newest' };

export default function Home() {
  const [filters, setFilters] = useState(DEFAULTS);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ categories: [], brands: [], price: { min: 0, max: 0 } });
  const [result, setResult] = useState({ items: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Debounce text inputs so we don't hit the API on every keystroke
  const search = useDebounce(filters.search);
  const minPrice = useDebounce(filters.minPrice, 500);
  const maxPrice = useDebounce(filters.maxPrice, 500);

  useEffect(() => {
    api.productMeta().then(setMeta).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .products({
        search,
        category: filters.category,
        brand: filters.brand,
        minPrice,
        maxPrice,
        inStock: filters.inStock ? 'true' : '',
        sort: filters.sort,
        page,
        limit: 8,
      })
      .then((r) => !cancelled && setResult(r))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [search, minPrice, maxPrice, filters.category, filters.brand, filters.inStock, filters.sort, page]);

  const update = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  const activeCount = ['category', 'brand', 'minPrice', 'maxPrice'].filter((k) => filters[k]).length + (filters.inStock ? 1 : 0);

  return (
    <div className="container">
      <section className="hero">
        <h1>Find your next favourite gadget</h1>
        <p>Laptops, phones, audio and more — fast delivery and simple returns.</p>
        <input
          className="input hero-search"
          type="search"
          placeholder="Search products, brands, categories…"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          aria-label="Search products"
        />
      </section>

      <div className="catalog">
        <button className="btn btn-ghost filter-toggle" onClick={() => setShowFilters((s) => !s)}>
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>

        <aside className={`filters card ${showFilters ? 'open' : ''}`}>
          <div className="filters-head">
            <h3>Filters</h3>
            <button className="link-btn" onClick={() => { setFilters(DEFAULTS); setPage(1); }}>
              Reset
            </button>
          </div>

          <label className="field">
            <span>Category</span>
            <select className="input" value={filters.category} onChange={(e) => update({ category: e.target.value })}>
              <option value="">All categories</option>
              {meta.categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Brand</span>
            <select className="input" value={filters.brand} onChange={(e) => update({ brand: e.target.value })}>
              <option value="">All brands</option>
              {meta.brands.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>

          <div className="field">
            <span>Price (₹)</span>
            <div className="row">
              <input
                className="input"
                type="number"
                min="0"
                placeholder={`Min ${meta.price.min || ''}`}
                value={filters.minPrice}
                onChange={(e) => update({ minPrice: e.target.value })}
              />
              <input
                className="input"
                type="number"
                min="0"
                placeholder={`Max ${meta.price.max || ''}`}
                value={filters.maxPrice}
                onChange={(e) => update({ maxPrice: e.target.value })}
              />
            </div>
          </div>

          <label className="check">
            <input type="checkbox" checked={filters.inStock} onChange={(e) => update({ inStock: e.target.checked })} />
            In stock only
          </label>
        </aside>

        <section className="results">
          <div className="results-bar">
            <span className="muted">{loading ? 'Searching…' : `${result.total} product${result.total === 1 ? '' : 's'}`}</span>
            <label className="sort">
              Sort by
              <select className="input" value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
                {SORT_OPTIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {!error && !loading && result.items.length === 0 && (
            <div className="empty card">
              <h3>No products match your filters</h3>
              <p className="muted">Try a different search term or clear some filters.</p>
            </div>
          )}

          <div className={`grid ${loading ? 'dim' : ''}`}>
            {result.items.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>

          {result.pages > 1 && (
            <div className="pagination">
              <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Previous
              </button>
              <span className="muted">
                Page {page} of {result.pages}
              </span>
              <button className="btn btn-ghost btn-sm" disabled={page >= result.pages} onClick={() => setPage((p) => p + 1)}>
                Next →
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

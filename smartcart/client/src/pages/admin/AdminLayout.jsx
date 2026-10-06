import { NavLink, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div className="container">
      <h1 className="page-title">Admin dashboard</h1>
      <nav className="tabs">
        <NavLink to="/admin" end>
          Overview
        </NavLink>
        <NavLink to="/admin/products">Inventory</NavLink>
        <NavLink to="/admin/orders">Orders</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}

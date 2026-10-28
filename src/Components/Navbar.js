import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/css/bootstrap.min.css';

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const cart = useSelector((state) => state.cart.items);
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="navbar navbar-expand-lg navbar-light shop-navbar">
      <div className="container">
        <NavLink className="navbar-brand shop-brand" to="/" onClick={closeMenu}>
          <span className="brand-mark"><i className="bi bi-bag-heart" aria-hidden="true" /></span>
          ShopFusion
        </NavLink>
        <button
          className="navbar-toggler"
          type="button"
          aria-controls="shop-navigation"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className={`collapse navbar-collapse ${menuOpen ? 'show' : ''}`} id="shop-navigation">
          <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-3">
            <li className="nav-item">
              <NavLink end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to="/" onClick={closeMenu}>Home</NavLink>
            </li>
            <li className="nav-item">
              <NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to="/about" onClick={closeMenu}>About</NavLink>
            </li>
            <li className="nav-item">
              <NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to="/contact" onClick={closeMenu}>Contact</NavLink>
            </li>
            <li className="nav-item">
              <NavLink className={({ isActive }) => `nav-link cart-nav-link ${isActive ? 'active' : ''}`} to="/cart" onClick={closeMenu} aria-label={`Shopping bag, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}>
                <i className="bi bi-bag" aria-hidden="true" />
                <span>Bag</span>
                <span className="cart-count" aria-live="polite">{cartCount}</span>
              </NavLink>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

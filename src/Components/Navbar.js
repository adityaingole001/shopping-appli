import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuth } from '../Context/AuthContext';
import AccountModal from './AccountModal';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/css/bootstrap.min.css';

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMode, setAccountMode] = useState(null);
  const [authNotice, setAuthNotice] = useState('');
  const cart = useSelector((state) => state.cart.items);
  const { user, loading, logout } = useAuth();
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    setAuthNotice('');
    try {
      await logout();
    } catch (error) {
      console.error('Unable to sign out:', error);
      setAuthNotice('Sign out failed. Please try again.');
    }
  };

  return (
    <>
      <nav className="navbar navbar-expand-xl navbar-light shop-navbar">
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
            <ul className="navbar-nav ms-auto align-items-xl-center gap-xl-3">
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
              <li className="nav-item account-nav-item">
                {loading ? (
                  <span className="account-loading" role="status">Account</span>
                ) : user ? (
                  <div className="account-signed-in">
                    <NavLink
                      className={({ isActive }) => `account-profile-link ${isActive ? 'active' : ''}`}
                      to="/profile"
                      onClick={closeMenu}
                      title="View profile and order history"
                    >
                      <i className="bi bi-person-circle" aria-hidden="true" />
                      <span className="account-profile-name">{user.displayName || user.email}</span>
                    </NavLink>
                    <button className="account-nav-button" type="button" onClick={handleLogout}>Sign out</button>
                  </div>
                ) : (
                  <div className="account-nav-actions">
                    <button
                      className="account-nav-button"
                      type="button"
                      onClick={() => {
                        closeMenu();
                        setAccountMode('signin');
                      }}
                    >
                      Sign in
                    </button>
                    <button
                      className="btn btn-brand account-create-button"
                      type="button"
                      onClick={() => {
                        closeMenu();
                        setAccountMode('signup');
                      }}
                    >
                      Create account
                    </button>
                  </div>
                )}
              </li>
            </ul>
            {authNotice && <p className="account-nav-error" role="alert">{authNotice}</p>}
          </div>
        </div>
      </nav>
      {accountMode && (
        <AccountModal
          key={accountMode}
          initialMode={accountMode}
          onClose={() => setAccountMode(null)}
        />
      )}
    </>
  );
}

export default Navbar;

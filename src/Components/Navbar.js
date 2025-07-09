import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/css/bootstrap.min.css';

function Navbar() {
  const cart = useSelector((state) => state.cart.items);

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark p-3 fs-5">
      <div className="container-fluid">
        <h2 className="navbar-brand m-0 text-white">ShopFusion</h2>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Collapsible Navbar Links */}
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto d-flex align-items-center gap-3">
            <li className="nav-item">
              <NavLink className="nav-link text-white" to="/">Home</NavLink>
            </li>
            <li className="nav-item">
              <NavLink className="nav-link text-white" to="/about">About</NavLink>
            </li>
            <li className="nav-item">
              <NavLink className="nav-link text-white" to="/contact">Contact</NavLink>
            </li>
            <li className="nav-item position-relative">
              <NavLink to="/cart" className="nav-link text-white">
                <i className="bi bi-cart3 fs-5"></i>
                {cart.length > 0 && (
                  <span
                    className="position-absolute top-0 start-100 translate-middle badge rounded-circle bg-danger"
                    style={{ fontSize: '0.65rem', padding: '4px 6px' }}
                  >
                    {cart.length}
                  </span>
                )}
              </NavLink>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

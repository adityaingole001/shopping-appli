import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { removeFromCart } from '../redux/cartSlice';
import LoginForm from './LoginForm';

function Cart() {
  const cart = useSelector(state => state.cart.items);
  const user = useSelector(state => state.auth.user);
  const dispatch = useDispatch();

  const [showLogin, setShowLogin] = useState(false);
  const [orderMessage, setOrderMessage] = useState('');
  const [localCart, setLocalCart] = useState([]);

  const totalPrice = cart.reduce((total, item) => total + item.price, 0);

  const handleCheckout = () => {
    if (user) {
      setOrderMessage('Order placed successfully!');
    } else {
      setShowLogin(true);
    }
  };

  const handleLoginSuccess = () => {
    setOrderMessage('Login successful! Placing your order...');
    setShowLogin(false);

    // Simulate order placement
    setTimeout(() => {
      setOrderMessage('✅ Order placed successfully!');
    }, 1000);
  };

  // ✅ Load localStorage cart on page load
  useEffect(() => {
    const storedCart = localStorage.getItem('cart');
    if (storedCart) {
      try {
        setLocalCart(JSON.parse(storedCart));
      } catch (err) {
        console.error("Error parsing local cart:", err);
      }
    }
  }, []);

  // ✅ Clear order message after 3 seconds
  useEffect(() => {
    if (orderMessage) {
      const timer = setTimeout(() => setOrderMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [orderMessage]);

  return (
    <div className="container my-4">
      <h2 className="text-center mb-4">Your Cart</h2>

      {localCart.length > 0 && (
        <div className="alert alert-secondary">
          <strong>Items in localStorage:</strong> {localCart.length}
        </div>
      )}

      {cart.length === 0 ? (
        <p className="text-center text-muted">Your cart is empty.</p>
      ) : (
        <>
          <div className="row">
            {cart.map((item, index) => (
              <div key={index} className="col-6 col-sm-4 col-md-3 mb-4">
                <div className="card h-100 text-center">
                  <img
                    src={item.image}
                    className="card-img-top p-3"
                    style={{ height: '120px', objectFit: 'contain' }}
                    alt={item.title}
                  />
                  <div className="card-body p-2">
                    <h6>{item.title.slice(0, 40)}...</h6>
                    <p className="text-success fw-bold">${item.price.toFixed(2)}</p>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => dispatch(removeFromCart(item.id))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total & Checkout */}
          <div className="text-center mt-4">
            <h5 className="mb-3">
              Total: <span className="text-success">${totalPrice.toFixed(2)}</span>
            </h5>
            <button type="button" className="btn btn-dark" onClick={handleCheckout}>
              Proceed to Checkout
            </button>

            {orderMessage && (
              <p className="mt-3 text-success fw-semibold">{orderMessage}</p>
            )}

            <div className="mt-3">
              <a href="/" className="btn btn-outline-secondary btn-sm">
                Continue Shopping
              </a>
            </div>
          </div>

          {/* Login Modal */}
          {showLogin && (
            <div
              className="modal-backdrop d-flex justify-content-center align-items-center position-fixed top-0 start-0 w-100 h-100"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999 }}
            >
              <div className="bg-white p-4 rounded shadow" style={{ width: '300px' }}>
                <LoginForm
                  onClose={() => setShowLogin(false)}
                  onLoginSuccess={handleLoginSuccess}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Cart;

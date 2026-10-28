import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { clearCart, removeFromCart, updateQuantity } from '../redux/cartSlice';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

function Cart() {
  const cart = useSelector((state) => state.cart.items);
  const dispatch = useDispatch();
  const [showCheckout, setShowCheckout] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [customer, setCustomer] = useState({ name: '', email: '', address: '' });

  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const totalPrice = cart.reduce((total, item) => total + item.price * item.quantity, 0);

  const handleSubmitOrder = (event) => {
    event.preventDefault();
    const orderNumber = `SF-${Date.now().toString().slice(-8)}`;
    setConfirmation({ orderNumber, name: customer.name.trim() });
    dispatch(clearCart());
    setShowCheckout(false);
    setCustomer({ name: '', email: '', address: '' });
  };

  if (confirmation) {
    return (
      <main className="container shop-container">
        <section className="confirmation-card">
          <div className="confirmation-icon"><i className="bi bi-check2" aria-hidden="true" /></div>
          <p className="eyebrow">Demo checkout complete</p>
          <h1>Thanks, {confirmation.name}.</h1>
          <p>Your cart has been cleared. Confirmation reference: <strong>{confirmation.orderNumber}</strong></p>
          <div className="alert alert-info text-start mt-4">
            This is a local demo confirmation. No payment was taken and no order was sent to a server.
          </div>
          <Link className="btn btn-brand mt-2" to="/">Continue shopping</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="container shop-container">
      <div className="section-heading cart-heading">
        <div>
          <p className="eyebrow mb-2">Your picks</p>
          <h1>Your shopping bag</h1>
        </div>
        {cart.length > 0 && <span className="text-secondary">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>}
      </div>

      {cart.length === 0 ? (
        <section className="empty-cart">
          <div className="empty-cart-icon"><i className="bi bi-bag" aria-hidden="true" /></div>
          <h2>Your bag is taking a breather</h2>
          <p>Browse the collection and add something you love.</p>
          <Link className="btn btn-brand" to="/">Explore products</Link>
        </section>
      ) : (
        <div className="row g-4 align-items-start">
          <div className="col-lg-8">
            <section className="cart-items" aria-label="Items in your shopping bag">
              {cart.map((item) => (
                <article className="cart-item" key={item.id}>
                  <img src={item.image} alt={item.title} />
                  <div className="cart-item-info">
                    <span className="eyebrow">{item.category}</span>
                    <h2>{item.title}</h2>
                    <p className="product-price">{currency.format(item.price)}</p>
                    <button className="remove-link" onClick={() => dispatch(removeFromCart(item.id))}>
                      Remove
                    </button>
                  </div>
                  <div className="quantity-control" aria-label={`Quantity for ${item.title}`}>
                    <button
                      type="button"
                      aria-label={`Decrease quantity of ${item.title}`}
                      onClick={() => dispatch(updateQuantity({ id: item.id, quantity: item.quantity - 1 }))}
                    >
                      <i className="bi bi-dash" aria-hidden="true" />
                    </button>
                    <span aria-live="polite">{item.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Increase quantity of ${item.title}`}
                      onClick={() => dispatch(updateQuantity({ id: item.id, quantity: item.quantity + 1 }))}
                    >
                      <i className="bi bi-plus" aria-hidden="true" />
                    </button>
                  </div>
                  <strong className="cart-line-total">{currency.format(item.price * item.quantity)}</strong>
                </article>
              ))}
            </section>
            <Link to="/" className="back-link d-inline-block mt-4">
              <i className="bi bi-arrow-left me-2" aria-hidden="true" />Continue shopping
            </Link>
          </div>

          <div className="col-lg-4">
            <aside className="order-summary">
              <h2>Order summary</h2>
              <div className="summary-row">
                <span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
                <strong>{currency.format(totalPrice)}</strong>
              </div>
              <div className="summary-row">
                <span>Shipping</span><span>Not included in demo</span>
              </div>
              <div className="summary-total">
                <span>Estimated total</span><strong>{currency.format(totalPrice)}</strong>
              </div>
              <p className="checkout-disclaimer">
                Demo checkout only. No payment is collected and no order is submitted to a server.
              </p>
              {!showCheckout ? (
                <button className="btn btn-brand w-100" onClick={() => setShowCheckout(true)}>
                  Continue to demo checkout
                </button>
              ) : (
                <form className="checkout-form" onSubmit={handleSubmitOrder}>
                  <h3>Delivery details</h3>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="checkout-name">Full name</label>
                    <input
                      className="form-control"
                      id="checkout-name"
                      autoComplete="name"
                      required
                      value={customer.name}
                      onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="checkout-email">Email</label>
                    <input
                      className="form-control"
                      id="checkout-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={customer.email}
                      onChange={(event) => setCustomer({ ...customer, email: event.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="checkout-address">Delivery address</label>
                    <textarea
                      className="form-control"
                      id="checkout-address"
                      autoComplete="street-address"
                      rows="3"
                      required
                      value={customer.address}
                      onChange={(event) => setCustomer({ ...customer, address: event.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn btn-brand w-100">Confirm demo order</button>
                  <button type="button" className="btn btn-link w-100 mt-2" onClick={() => setShowCheckout(false)}>
                    Go back
                  </button>
                </form>
              )}
            </aside>
          </div>
        </div>
      )}
    </main>
  );
}

export default Cart;

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../Context/AuthContext';
import AccountModal from './AccountModal';
import { downloadInvoice } from '../utils/invoicePdf';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR'
});

async function loadOrders(user) {
  const token = await user.getIdToken();
  const response = await fetch('/api/orders', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const responseText = await response.text();
  if (response.status === 404) {
    throw new Error(
      'The order-history API route was not found. The API on port 5000 may be outdated; restart it from this project with `npm run server`, then reload.'
    );
  }
  let data;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch (error) {
    throw new Error(`Order history returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(data.error || `Unable to load order history (HTTP ${response.status}).`);
  }
  return data.orders;
}

function Profile() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [error, setError] = useState('');
  const [showSignIn, setShowSignIn] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [invoiceError, setInvoiceError] = useState('');

  const handleDownloadInvoice = async (order) => {
    setInvoiceError('');
    try {
      await downloadInvoice(order);
    } catch (downloadError) {
      console.error('Unable to generate invoice PDF:', downloadError);
      setInvoiceError('Could not generate the invoice PDF. Please try again.');
    }
  };

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoadingOrders(false);
      setError('');
      return undefined;
    }

    let active = true;
    setLoadingOrders(true);
    setError('');
    loadOrders(user)
      .then((savedOrders) => {
        if (active) {
          setOrders(savedOrders.filter((order) => (
            order.paymentStatus === 'paid' &&
            order.payment?.status === 'captured'
          )));
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Unable to load order history.');
      })
      .finally(() => {
        if (active) setLoadingOrders(false);
      });

    return () => {
      active = false;
    };
  }, [user, reloadKey]);

  return (
    <main className="container shop-container orders-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow mb-2">Your account</p>
          <h1>Your profile</h1>
          <p className="text-secondary mb-0">Account details and purchase history.</p>
        </div>
        <Link className="back-link" to="/cart">Go to bag</Link>
      </div>

      {authLoading ? (
        <p role="status">Checking your account…</p>
      ) : !user ? (
        <section className="orders-empty">
          <div className="empty-cart-icon"><i className="bi bi-person-lock" aria-hidden="true" /></div>
          <h2>Sign in to view your orders</h2>
          <p>Your order history is private to your account.</p>
          <button type="button" className="btn btn-brand" onClick={() => setShowSignIn(true)}>
            Sign in
          </button>
        </section>
      ) : (
        <section className="profile-content">
          <section className="profile-details" aria-label="Profile details">
            <div className="profile-avatar"><i className="bi bi-person-circle" aria-hidden="true" /></div>
            <div>
              <p className="eyebrow mb-1">Signed-in account</p>
              <h2>{user.displayName || 'ShopFusion customer'}</h2>
              <p>{user.email}</p>
            </div>
          </section>
          {loadingOrders ? (
            <p role="status">Loading your order history…</p>
          ) : error ? (
            <div className="alert alert-danger" role="alert">
              {error}
              <button
                type="button"
                className="btn btn-link"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                Try again
              </button>
            </div>
          ) : orders.length === 0 ? (
            <section className="orders-empty">
              <div className="empty-cart-icon"><i className="bi bi-receipt" aria-hidden="true" /></div>
              <h2>No orders yet</h2>
              <p>Once you place an order, its status and invoice will appear here.</p>
              <Link className="btn btn-brand" to="/">Explore products</Link>
            </section>
          ) : (
            <>
              {invoiceError && <div className="alert alert-danger" role="alert">{invoiceError}</div>}
              <h2 className="profile-orders-heading">Order history</h2>
              <section className="orders-list" aria-label="Previous orders">
                {orders.map((order) => (
                  <article className="order-history-card" key={order.orderId}>
                    <header className="order-history-header">
                      <div>
                        <p className="eyebrow mb-1">
                          {order.invoiceNumber ? `Invoice ${order.invoiceNumber}` : 'Order details'}
                        </p>
                        <h3>{order.orderId}</h3>
                      </div>
                      <span className="order-status">{order.status}</span>
                    </header>
                    <div className="order-history-meta">
                      <span>Order date: {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Date unavailable'}</span>
                      <span>Payment status: {order.paymentStatus || 'pending'}</span>
                    </div>
                    <ul className="order-history-items">
                      {order.items.map((item) => (
                        <li key={item.id}>
                          <span>{item.title} × {item.quantity} <small>({currency.format(item.unitAmount / 100)} each)</small></span>
                          <strong>{currency.format(item.unitAmount * item.quantity / 100)}</strong>
                        </li>
                      ))}
                    </ul>
                    <footer className="order-history-footer">
                      <div>
                        <span>{order.payment ? `Payment ID: ${order.payment.paymentId}` : 'Payment not completed'}</span>
                        {order.payment && (
                          <span>
                            Method: {order.payment.method} · Paid: {order.payment.paymentDate
                              ? new Date(order.payment.paymentDate).toLocaleString()
                              : 'Date unavailable'}
                          </span>
                        )}
                      </div>
                      <div className="order-history-total">
                        <span>Total</span>
                        <strong>{currency.format(order.amount / 100)}</strong>
                      </div>
                    </footer>
                    {order.paymentStatus === 'paid' && order.payment?.status === 'captured' && (
                      <button
                        type="button"
                        className="invoice-icon-button"
                        onClick={() => handleDownloadInvoice(order)}
                        aria-label="Download invoice PDF"
                        title="Download invoice PDF"
                      >
                        <i className="bi bi-download" aria-hidden="true" />
                      </button>
                    )}
                  </article>
                ))}
              </section>
            </>
          )}
        </section>
      )}

      {showSignIn && (
        <AccountModal
          initialMode="signin"
          onClose={() => setShowSignIn(false)}
          onSuccess={() => setShowSignIn(false)}
        />
      )}
    </main>
  );
}

export default Profile;

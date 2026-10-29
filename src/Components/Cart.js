import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  clearCart,
  convertLegacyCartPrices,
  removeFromCart,
  updateQuantity
} from '../redux/cartSlice';
import loadRazorpay from '../utils/loadRazorpay';
import { useAuth } from '../Context/AuthContext';
import AccountModal from './AccountModal';
import { downloadInvoice } from '../utils/invoicePdf';
import { fetchUsdToInrRate } from '../utils/pricing';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR'
});

async function readApiResponse(response, allowedStatuses = []) {
  const responseText = await response.text();
  let data;

  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch (error) {
    if (responseText.startsWith('Proxy error:') || responseText.startsWith('Proxy request failed')) {
      throw new Error('The payment API is not reachable. Restart the app with `npm start` and check that port 5000 is available.');
    }
    throw new Error(`The payment API returned an invalid response (HTTP ${response.status}).`);
  }

  if (!response.ok && !allowedStatuses.includes(response.status)) {
    throw new Error(data.error || `The payment API request failed (HTTP ${response.status}).`);
  }

  return data;
}

function Cart() {
  const cart = useSelector((state) => state.cart.items);
  const dispatch = useDispatch();
  const { user, loading: authLoading } = useAuth();
  const [showCheckout, setShowCheckout] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [invoiceError, setInvoiceError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [priceConversionError, setPriceConversionError] = useState('');
  const [priceRetryKey, setPriceRetryKey] = useState(0);
  const [savedDeliveryAddresses, setSavedDeliveryAddresses] = useState([]);
  const [selectedDeliveryAddress, setSelectedDeliveryAddress] = useState('new');
  const [isLoadingSavedDetails, setIsLoadingSavedDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customer, setCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India'
  });

  useEffect(() => {
    setCustomer((currentCustomer) => ({
      ...currentCustomer,
      name: user?.displayName?.trim() || '',
      email: user?.email?.trim() || '',
      phone: user?.phoneNumber?.trim() || ''
    }));
  }, [user?.uid, user?.displayName, user?.email, user?.phoneNumber]);

  const hasUnconvertedPrices = cart.some((item) => item.priceCurrency !== 'INR');

  useEffect(() => {
    if (!hasUnconvertedPrices) {
      setPriceConversionError('');
      return undefined;
    }

    const controller = new AbortController();
    fetchUsdToInrRate(controller.signal)
      .then((rate) => {
        dispatch(convertLegacyCartPrices(rate));
        setPriceConversionError('');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setPriceConversionError(error.message || 'Prices could not be converted to INR.');
        }
      });

    return () => controller.abort();
  }, [dispatch, hasUnconvertedPrices, priceRetryKey]);

  const accountName = user?.displayName?.trim() || '';
  const accountEmail = user?.email?.trim() || '';
  const isUsingSavedDeliveryAddress = selectedDeliveryAddress !== 'new';
  const checkoutName = isUsingSavedDeliveryAddress
    ? customer.name.trim()
    : accountName || customer.name.trim();
  const checkoutEmail = isUsingSavedDeliveryAddress
    ? customer.email.trim()
    : accountEmail || customer.email.trim();
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const totalPrice = cart.reduce((total, item) => total + item.price * item.quantity, 0);

  const handleContinueToCheckout = async (authenticatedUser = user) => {
    setCheckoutError('');
    if (authLoading && !authenticatedUser) return;
    if (!authenticatedUser) {
      setShowSignIn(true);
      return;
    }

    setIsLoadingSavedDetails(true);
    try {
      const token = await authenticatedUser.getIdToken();
      const response = await fetch('/api/checkout/customer', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await readApiResponse(response);
      const savedAddresses = Array.isArray(result.addresses)
        ? result.addresses.filter((address) => address && typeof address === 'object')
        : result.customer && typeof result.customer === 'object'
          ? [result.customer]
          : [];
      setSavedDeliveryAddresses(savedAddresses);
      if (savedAddresses.length > 0) {
        const previousCustomer = {
          name: typeof savedAddresses[0].name === 'string' ? savedAddresses[0].name : accountName,
          email: typeof savedAddresses[0].email === 'string' ? savedAddresses[0].email : accountEmail,
          phone: typeof savedAddresses[0].phone === 'string' ? savedAddresses[0].phone : '',
          address: typeof savedAddresses[0].address === 'string' ? savedAddresses[0].address : '',
          city: typeof savedAddresses[0].city === 'string' ? savedAddresses[0].city : '',
          state: typeof savedAddresses[0].state === 'string' ? savedAddresses[0].state : '',
          postalCode: typeof savedAddresses[0].postalCode === 'string' ? savedAddresses[0].postalCode : '',
          country: typeof savedAddresses[0].country === 'string' ? savedAddresses[0].country : 'India'
        };
        setCustomer(previousCustomer);
        setSelectedDeliveryAddress('0');
      } else {
        setSelectedDeliveryAddress('new');
      }
    } catch (error) {
      console.error('Unable to load previous delivery details:', error);
      setSavedDeliveryAddresses([]);
      setSelectedDeliveryAddress('new');
      setCheckoutError('Could not load your previous delivery details. Enter them below to continue.');
    } finally {
      setIsLoadingSavedDetails(false);
    }

    setShowCheckout(true);
  };

  const handleSelectDeliveryAddress = (addressIndex) => {
    if (addressIndex === 'new') {
      setSelectedDeliveryAddress('new');
      setCustomer((currentCustomer) => ({
        ...currentCustomer,
        name: accountName || currentCustomer.name,
        email: accountEmail || currentCustomer.email,
        phone: '',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'India'
      }));
      return;
    }

    const address = savedDeliveryAddresses[Number(addressIndex)];
    if (!address) return;
    setSelectedDeliveryAddress(addressIndex);
    setCustomer({
      name: typeof address.name === 'string' ? address.name : accountName,
      email: typeof address.email === 'string' ? address.email : accountEmail,
      phone: typeof address.phone === 'string' ? address.phone : '',
      address: typeof address.address === 'string' ? address.address : '',
      city: typeof address.city === 'string' ? address.city : '',
      state: typeof address.state === 'string' ? address.state : '',
      postalCode: typeof address.postalCode === 'string' ? address.postalCode : '',
      country: typeof address.country === 'string' ? address.country : 'India'
    });
  };

  const handleDownloadInvoice = async () => {
    if (!confirmation) return;
    try {
      await downloadInvoice(confirmation);
    } catch (error) {
      console.error('Unable to generate the paid invoice PDF:', error);
      setInvoiceError('Could not generate the invoice PDF. You can try downloading it from your profile.');
    }
  };

  const handleSubmitOrder = async (event) => {
    event.preventDefault();
    if (isSubmitting || cart.length === 0) return;
    if (hasUnconvertedPrices) {
      setCheckoutError('Please wait for cart prices to be converted to INR before paying.');
      return;
    }
    if (!user) {
      setShowCheckout(false);
      setShowSignIn(true);
      return;
    }

    setCheckoutError('');
    setPaymentMessage('');
    setIsSubmitting(true);

    try {
      const checkoutLoaded = await loadRazorpay();
      if (!checkoutLoaded) {
        throw new Error('Razorpay Checkout could not be loaded. Check your connection and try again.');
      }

      const idToken = await user.getIdToken();
      const checkoutCustomer = {
        name: checkoutName,
        email: checkoutEmail,
        phone: customer.phone.trim(),
        address: customer.address.trim(),
        city: customer.city.trim(),
        state: customer.state.trim(),
        postalCode: customer.postalCode.trim(),
        country: customer.country.trim()
      };
      const orderResponse = await fetch('/api/checkout/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          items: cart.map(({ id, quantity }) => ({ id, quantity })),
          customer: checkoutCustomer
        })
      });
      const order = await readApiResponse(orderResponse);

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'ShopFusion',
        description: `${itemCount} ${itemCount === 1 ? 'item' : 'items'} in your bag`,
        order_id: order.orderId,
        prefill: {
          name: checkoutName,
          email: checkoutEmail,
          contact: customer.phone.trim()
        },
        theme: { color: '#234b3b' },
        modal: {
          ondismiss: () => setIsSubmitting(false)
        },
        handler: async (paymentResponse) => {
          try {
            const verificationToken = await user.getIdToken();
            const verificationResponse = await fetch('/api/checkout/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${verificationToken}`
              },
              body: JSON.stringify(paymentResponse)
            });
            const verification = await readApiResponse(verificationResponse, [202]);
            if (verificationResponse.status === 202 && verification.status === 'pending') {
              setPaymentMessage(verification.message);
              setIsSubmitting(false);
              return;
            }

            dispatch(clearCart());
            setShowCheckout(false);
            const confirmedOrder = {
              ...verification,
              customer: {
                ...checkoutCustomer,
                ...(verification.customer && typeof verification.customer === 'object'
                  ? verification.customer
                  : {})
              }
            };
            setConfirmation(confirmedOrder);
            try {
              await downloadInvoice(confirmedOrder);
            } catch (invoiceDownloadError) {
              console.error('Unable to generate the paid invoice PDF:', invoiceDownloadError);
              setInvoiceError('Payment is confirmed, but automatic invoice download failed. You can try downloading it again below or from your profile.');
            }
          } catch (verificationError) {
            setCheckoutError(verificationError.message || 'Unable to verify payment. Please contact support.');
          } finally {
            setIsSubmitting(false);
          }
        }
      });

      checkout.on('payment.failed', (failure) => {
        setCheckoutError(
          failure.error && failure.error.description
            ? failure.error.description
            : 'Payment was not completed. Your cart is still saved; you can try again.'
        );
        setIsSubmitting(false);
      });
      checkout.open();
      setIsSubmitting(false);
    } catch (error) {
      setCheckoutError(error.message || 'Unable to start payment. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (confirmation) {
    return (
      <main className="container shop-container payment-result-page">
        <section className="confirmation-card" aria-labelledby="payment-result-title">
          <div className="confirmation-icon"><i className="bi bi-check2" aria-hidden="true" /></div>
          <p className="eyebrow confirmation-eyebrow">Payment confirmed</p>
          <h1 id="payment-result-title">Thanks, {confirmation.customer?.name || 'there'}.</h1>
          <p className="confirmation-subtitle">Your payment was successful and your order is confirmed.</p>
          <div className="confirmation-amount">
            <span>Amount paid</span>
            <strong>{new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: confirmation.currency
            }).format(confirmation.amount / 100)}</strong>
          </div>
          <div className="confirmation-details" aria-label="Payment details">
            <div className="confirmation-detail-row">
              <span>Order reference</span>
              <strong>{confirmation.orderId}</strong>
            </div>
            <div className="confirmation-detail-row">
              <span>Invoice number</span>
              <strong>{confirmation.invoiceNumber}</strong>
            </div>
            {confirmation.payment?.paymentId && (
              <div className="confirmation-detail-row">
                <span>Payment ID</span>
                <strong>{confirmation.payment.paymentId}</strong>
              </div>
            )}
            <div className="confirmation-verified">
              <i className="bi bi-shield-check" aria-hidden="true" />
              Payment was verified by the ShopFusion server
            </div>
          </div>
          {invoiceError && <div className="alert alert-warning text-start" role="status">{invoiceError}</div>}
          {confirmation.paymentStatus === 'paid' && confirmation.payment?.status === 'captured' && (
            <button
              type="button"
              className="invoice-icon-button"
              onClick={handleDownloadInvoice}
              aria-label="Download invoice PDF"
              title="Download invoice PDF"
            >
              <i className="bi bi-download" aria-hidden="true" />
            </button>
          )}
          <div className="confirmation-actions">
            <Link className="btn btn-brand" to="/">Continue shopping</Link>
            <Link className="confirmation-profile-link" to="/profile">
              View order history <i className="bi bi-arrow-right" aria-hidden="true" />
            </Link>
          </div>
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
                    <p className="product-price">
                      {item.priceCurrency === 'INR' ? currency.format(item.price) : 'Converting price…'}
                    </p>
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
                      disabled={item.quantity >= 10}
                      onClick={() => dispatch(updateQuantity({ id: item.id, quantity: item.quantity + 1 }))}
                    >
                      <i className="bi bi-plus" aria-hidden="true" />
                    </button>
                  </div>
                  <strong className="cart-line-total">
                    {item.priceCurrency === 'INR'
                      ? currency.format(item.price * item.quantity)
                      : 'Converting…'}
                  </strong>
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
                <strong>{hasUnconvertedPrices ? 'Converting…' : currency.format(totalPrice)}</strong>
              </div>
              <div className="summary-row">
                <span>Shipping</span><span>Not included</span>
              </div>
              <div className="summary-total">
                <span>Estimated total</span>
                <strong>{hasUnconvertedPrices ? 'Converting…' : currency.format(totalPrice)}</strong>
              </div>
              <p className="checkout-disclaimer">
                Prices are converted from USD to INR using the current exchange rate. Secure checkout via Razorpay; shipping is not included.
              </p>
              {hasUnconvertedPrices && (
                <div className="alert alert-info" role="status">
                  {priceConversionError || 'Converting saved cart prices to INR…'}
                  {priceConversionError && (
                    <button
                      type="button"
                      className="btn btn-link"
                      onClick={() => setPriceRetryKey((key) => key + 1)}
                    >
                      Try again
                    </button>
                  )}
                </div>
              )}
              {!user && (
                <div className="alert alert-info" role="status">
                  Sign in or create an account before purchasing. Your cart will remain saved.
                </div>
              )}
              {checkoutError && <div className="alert alert-danger" role="alert">{checkoutError}</div>}
              {paymentMessage && <div className="alert alert-warning" role="status">{paymentMessage}</div>}
              {!showCheckout ? (
                <button
                  className="btn btn-brand w-100"
                  disabled={authLoading || isLoadingSavedDetails}
                  onClick={() => handleContinueToCheckout()}
                >
                  {authLoading
                    ? 'Checking your account…'
                    : isLoadingSavedDetails
                      ? 'Loading your saved details…'
                      : user
                        ? 'Continue to checkout'
                        : 'Sign in to checkout'}
                </button>
              ) : (
                <form className="checkout-form" onSubmit={handleSubmitOrder}>
                  <h3>Delivery details</h3>
                  {savedDeliveryAddresses.length > 0 && (
                    <fieldset className="saved-delivery-options">
                      <legend>Choose a delivery address</legend>
                      {savedDeliveryAddresses.map((address, index) => (
                        <label className="saved-delivery-option" key={`${address.phone || ''}-${address.address || ''}-${index}`}>
                          <input
                            type="radio"
                            name="delivery-address"
                            value={String(index)}
                            checked={selectedDeliveryAddress === String(index)}
                            onChange={() => handleSelectDeliveryAddress(String(index))}
                          />
                          <span>
                            <strong>{address.name || 'Delivery address'}</strong>
                            <span>{address.phone || 'No mobile number'}</span>
                            <span>
                              {[
                                address.address,
                                address.city,
                                address.state,
                                address.postalCode,
                                address.country
                              ].filter(Boolean).join(', ')}
                            </span>
                          </span>
                        </label>
                      ))}
                      <label className="saved-delivery-option saved-delivery-new-option">
                        <input
                          type="radio"
                          name="delivery-address"
                          value="new"
                          checked={selectedDeliveryAddress === 'new'}
                          onChange={() => handleSelectDeliveryAddress('new')}
                        />
                        <span><strong>Use a new address</strong></span>
                      </label>
                    </fieldset>
                  )}
                  {isUsingSavedDeliveryAddress ? (
                    <p className="text-secondary mb-3">
                      Using the saved address for this order. Choose “Use a new address” to enter different details.
                    </p>
                  ) : (
                    <>
                  {(accountName || accountEmail) && (
                    <p className="text-secondary mb-3">
                      Signed in as <strong>{accountName || accountEmail}</strong>
                      {accountName && accountEmail ? ` · ${accountEmail}` : ''}
                    </p>
                  )}
                  {!accountName && (
                    <div className="mb-3">
                      <label className="form-label" htmlFor="checkout-name">Delivery recipient name</label>
                      <input
                        className="form-control"
                        id="checkout-name"
                        autoComplete="name"
                        minLength="2"
                        maxLength="100"
                        required
                        value={customer.name}
                        onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
                      />
                    </div>
                  )}
                  {!accountEmail && (
                    <div className="mb-3">
                      <label className="form-label" htmlFor="checkout-email">Contact email</label>
                      <input
                        className="form-control"
                        id="checkout-email"
                        type="email"
                        autoComplete="email"
                        maxLength="254"
                        required
                        value={customer.email}
                        onChange={(event) => setCustomer({ ...customer, email: event.target.value })}
                      />
                    </div>
                  )}
                  <div className="mb-3">
                    <label className="form-label" htmlFor="checkout-phone">Mobile number</label>
                    <input
                      className="form-control"
                      id="checkout-phone"
                      type="tel"
                      autoComplete="tel"
                      pattern="\+?[0-9\s()-]{7,20}"
                      title="Enter a valid phone number, including country code if needed."
                      required
                      value={customer.phone}
                      onChange={(event) => setCustomer({ ...customer, phone: event.target.value })}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="checkout-address">Street address</label>
                    <textarea
                      className="form-control"
                      id="checkout-address"
                      autoComplete="street-address"
                      rows="3"
                      minLength="5"
                      maxLength="500"
                      required
                      value={customer.address}
                      onChange={(event) => setCustomer({ ...customer, address: event.target.value })}
                    />
                  </div>
                  <div className="row g-2">
                    <div className="col-sm-6 mb-3">
                      <label className="form-label" htmlFor="checkout-city">City</label>
                      <input
                        className="form-control"
                        id="checkout-city"
                        autoComplete="address-level2"
                        maxLength="100"
                        required
                        value={customer.city}
                        onChange={(event) => setCustomer({ ...customer, city: event.target.value })}
                      />
                    </div>
                    <div className="col-sm-6 mb-3">
                      <label className="form-label" htmlFor="checkout-state">State</label>
                      <input
                        className="form-control"
                        id="checkout-state"
                        autoComplete="address-level1"
                        maxLength="100"
                        required
                        value={customer.state}
                        onChange={(event) => setCustomer({ ...customer, state: event.target.value })}
                      />
                    </div>
                    <div className="col-sm-6 mb-3">
                      <label className="form-label" htmlFor="checkout-postal-code">Postal / PIN code</label>
                      <input
                        className="form-control"
                        id="checkout-postal-code"
                        autoComplete="postal-code"
                        maxLength="20"
                        required
                        value={customer.postalCode}
                        onChange={(event) => setCustomer({ ...customer, postalCode: event.target.value })}
                      />
                    </div>
                    <div className="col-sm-6 mb-3">
                      <label className="form-label" htmlFor="checkout-country">Country</label>
                      <input
                        className="form-control"
                        id="checkout-country"
                        autoComplete="country-name"
                        maxLength="100"
                        required
                        value={customer.country}
                        onChange={(event) => setCustomer({ ...customer, country: event.target.value })}
                      />
                    </div>
                  </div>
                    </>
                  )}
                  <button
                    type="submit"
                    className="btn btn-brand w-100"
                    disabled={isSubmitting || hasUnconvertedPrices}
                  >
                    {isSubmitting
                      ? 'Starting secure checkout…'
                      : hasUnconvertedPrices
                        ? 'Converting prices…'
                        : `Pay ${currency.format(totalPrice)}`}
                  </button>
                 <button
  type="button"
  className="btn btn-link w-100 mt-2 text-decoration-none"
  disabled={isSubmitting}
  onClick={() => setShowCheckout(false)}
>
  Go back
</button>
                </form>
              )}
            </aside>
          </div>
        </div>
      )}
      {showSignIn && (
        <AccountModal
          initialMode="signin"
          onClose={() => setShowSignIn(false)}
          onSuccess={(signedInUser) => {
            setShowSignIn(false);
            handleContinueToCheckout(signedInUser);
          }}
        />
      )}
    </main>
  );
}

export default Cart;

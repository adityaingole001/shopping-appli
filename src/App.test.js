import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import Cart from './Components/Cart';
import store from './redux/store';
import { addToCart, clearCart } from './redux/cartSlice';
import loadRazorpay from './utils/loadRazorpay';
import { downloadInvoice } from './utils/invoicePdf';
import { useAuth } from './Context/AuthContext';

const product = {
  id: 1,
  title: 'Everyday Shopper Tote',
  price: 24.5,
  description: 'A practical bag for everyday use.',
  category: 'accessories',
  image: 'https://example.com/tote.jpg',
  priceCurrency: 'INR'
};

jest.mock('react-router-dom', () => {
  const React = require('react');
  return {
    Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children)
  };
}, { virtual: true });

jest.mock('./utils/loadRazorpay', () => jest.fn());
jest.mock('./utils/invoicePdf', () => ({
  downloadInvoice: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('./Context/AuthContext', () => ({
  useAuth: jest.fn()
}));
jest.mock('./Components/AccountModal', () => {
  const React = require('react');
  return function MockAccountModal({ onClose, onSuccess }) {
    return React.createElement(
      'div',
      { role: 'dialog', 'aria-label': 'Sign in' },
      React.createElement('button', {
        type: 'button',
        onClick: () => {
          onSuccess({
            displayName: 'Taylor Shopper',
            email: 'taylor@example.com',
            getIdToken: jest.fn().mockResolvedValue('firebase-id-token')
          });
          onClose();
        }
      }, 'Complete sign in')
    );
  };
});

const signedInUser = {
  displayName: 'Taylor Shopper',
  email: 'taylor@example.com',
  getIdToken: jest.fn().mockResolvedValue('firebase-id-token')
};

beforeEach(() => {
  localStorage.clear();
  store.dispatch(clearCart());
  store.dispatch(addToCart(product));
  signedInUser.getIdToken.mockResolvedValue('firebase-id-token');
  useAuth.mockReturnValue({ user: signedInUser, loading: false });
  loadRazorpay.mockResolvedValue(true);
  global.fetch = jest.fn().mockImplementation((url) => {
    if (url === '/api/pricing') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          baseCurrency: 'USD',
          currency: 'INR',
          usdToInrRate: 83.5
        })
      });
    }
    if (url === '/api/checkout/orders') {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          keyId: 'rzp_test_example',
          orderId: 'order_test_123',
          amount: 2450,
          currency: 'INR'
        }))
      });
    }
    if (url === '/api/checkout/customer') {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ customer: null }))
      });
    }
    if (url === '/api/checkout/verify') {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          status: 'paid',
          orderId: 'order_test_123',
          invoiceNumber: 'SF-20261029-TEST1234',
          paymentId: 'pay_test_123',
          subtotal: 2450,
          amount: 2450,
          currency: 'INR',
          items: [{ id: 1, title: product.title, quantity: 1, unitAmount: 2450 }],
          payment: {
            paymentId: 'pay_test_123',
            status: 'captured',
            method: 'card',
            paymentDate: '2026-10-29T10:00:00.000Z'
          },
          paymentStatus: 'paid'
        }))
      });
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
});

afterEach(() => {
  delete window.Razorpay;
  jest.restoreAllMocks();
});

function fillCheckoutDetails() {
  fireEvent.change(screen.getByLabelText(/mobile number/i), { target: { value: '+15551234567' } });
  fireEvent.change(screen.getByLabelText(/street address/i), { target: { value: '123 Market Street' } });
  fireEvent.change(screen.getByLabelText(/city/i), { target: { value: 'Test City' } });
  fireEvent.change(screen.getByLabelText(/state/i), { target: { value: 'Test State' } });
  fireEvent.change(screen.getByLabelText(/postal \/ pin code/i), { target: { value: '12345' } });
  fireEvent.change(screen.getByLabelText(/country/i), { target: { value: 'India' } });
}

test('shopper pays through Razorpay and cart clears only after server verification', async () => {
  let checkoutOptions;
  window.Razorpay = jest.fn().mockImplementation((options) => {
    checkoutOptions = options;
    return {
      open: jest.fn(),
      on: jest.fn()
    };
  });

  render(<Provider store={store}><Cart /></Provider>);

  expect(screen.getByText(product.title)).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem('cart'))[0].quantity).toBe(1);
  expect(screen.getAllByText(/₹24\.50/)).toHaveLength(4);
  fireEvent.click(screen.getByRole('button', { name: /continue to checkout/i }));

  expect(await screen.findByText(/signed in as/i)).toHaveTextContent('Taylor Shopper');
  expect(screen.queryByLabelText(/full name|email/i)).not.toBeInTheDocument();
  fillCheckoutDetails();
  fireEvent.click(screen.getByRole('button', { name: /pay ₹24\.50/i }));

  expect(await screen.findByRole('button', { name: /pay ₹24\.50/i })).toBeInTheDocument();
  expect(window.Razorpay).toHaveBeenCalledWith(expect.objectContaining({
    order_id: 'order_test_123',
    amount: 2450,
    currency: 'INR',
    key: 'rzp_test_example'
  }));
  expect(store.getState().cart.items).toHaveLength(1);
  const createOrderRequest = global.fetch.mock.calls.find(([url]) => url === '/api/checkout/orders');
  expect(JSON.parse(createOrderRequest[1].body).customer).toEqual({
    name: 'Taylor Shopper',
    email: 'taylor@example.com',
    phone: '+15551234567',
    address: '123 Market Street',
    city: 'Test City',
    state: 'Test State',
    postalCode: '12345',
    country: 'India'
  });
  expect(createOrderRequest[1].headers.Authorization).toBe('Bearer firebase-id-token');

  await act(async () => {
    await checkoutOptions.handler({
      razorpay_order_id: 'order_test_123',
      razorpay_payment_id: 'pay_test_123',
      razorpay_signature: 'verified-by-server'
    });
  });

  expect(await screen.findByRole('heading', { name: /thanks, taylor shopper/i })).toBeInTheDocument();
  expect(screen.getByText(/payment was verified by the shopfusion server/i)).toBeInTheDocument();
  expect(downloadInvoice).toHaveBeenCalledWith(expect.objectContaining({
    invoiceNumber: 'SF-20261029-TEST1234',
    paymentStatus: 'paid'
  }));
  expect(store.getState().cart.items).toHaveLength(0);
  expect(JSON.parse(localStorage.getItem('cart'))).toEqual([]);
  expect(global.fetch).toHaveBeenCalledWith('/api/checkout/verify', expect.objectContaining({
    method: 'POST'
  }));
  const verifyRequest = global.fetch.mock.calls.find(([url]) => url === '/api/checkout/verify');
  expect(verifyRequest[1].headers.Authorization).toBe('Bearer firebase-id-token');
});

test('keeps the cart when the backend cannot verify payment', async () => {
  let checkoutOptions;
  window.Razorpay = jest.fn().mockImplementation((options) => {
    checkoutOptions = options;
    return { open: jest.fn(), on: jest.fn() };
  });
  global.fetch.mockImplementation((url) => {
    if (url === '/api/checkout/customer') {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ customer: null }))
      });
    }
    if (url === '/api/checkout/orders') {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          keyId: 'rzp_test_example',
          orderId: 'order_test_123',
          amount: 2450,
          currency: 'INR'
        }))
      });
    }
    return Promise.resolve({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ error: 'Payment signature verification failed.' }))
    });
  });

  render(<Provider store={store}><Cart /></Provider>);
  fireEvent.click(screen.getByRole('button', { name: /continue to checkout/i }));
  await screen.findByLabelText(/mobile number/i);
  fillCheckoutDetails();
  fireEvent.click(screen.getByRole('button', { name: /pay ₹24\.50/i }));
  await screen.findByRole('button', { name: /pay ₹24\.50/i });

  await act(async () => {
    await checkoutOptions.handler({
      razorpay_order_id: 'order_test_123',
      razorpay_payment_id: 'pay_test_123',
      razorpay_signature: 'invalid'
    });
  });

  expect(await screen.findByRole('alert')).toHaveTextContent('Payment signature verification failed.');
  expect(store.getState().cart.items).toHaveLength(1);
});

test('converts saved USD cart prices to INR before displaying checkout totals', async () => {
  store.dispatch(clearCart());
  store.dispatch(addToCart({ ...product, priceCurrency: undefined }));

  render(<Provider store={store}><Cart /></Provider>);

  expect(await screen.findAllByText('₹2,045.75')).not.toHaveLength(0);
  expect(store.getState().cart.items[0]).toMatchObject({
    price: 2045.75,
    priceCurrency: 'INR'
  });
});

test('lets the shopper choose a saved delivery address or enter a new one', async () => {
  const defaultFetch = global.fetch;
  global.fetch = jest.fn((url, options) => {
    if (url === '/api/checkout/customer') {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          addresses: [{
            name: 'Taylor Shopper',
            email: 'taylor@example.com',
            phone: '+911234567890',
            address: '45 Previous Road',
            city: 'Pune',
            state: 'Maharashtra',
            postalCode: '411001',
            country: 'India'
          }, {
            name: 'Taylor Shopper',
            email: 'taylor@example.com',
            phone: '+919876543210',
            address: '8 Garden Lane',
            city: 'Mumbai',
            state: 'Maharashtra',
            postalCode: '400001',
            country: 'India'
          }]
        }))
      });
    }
    return defaultFetch(url, options);
  });

  render(<Provider store={store}><Cart /></Provider>);
  fireEvent.click(screen.getByRole('button', { name: /continue to checkout/i }));

  const firstAddress = await screen.findByRole('radio', { name: /45 Previous Road/ });
  const secondAddress = screen.getByRole('radio', { name: /8 Garden Lane/ });
  expect(firstAddress).toBeChecked();
  fireEvent.click(secondAddress);
  expect(secondAddress).toBeChecked();
  expect(screen.queryByLabelText(/mobile number/i)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('radio', { name: /use a new address/i }));
  expect(screen.getByLabelText(/mobile number/i)).toHaveValue('');
  expect(screen.getByLabelText(/street address/i)).toHaveValue('');

  fireEvent.click(firstAddress);
  expect(firstAddress).toBeChecked();
});

test('shows a useful error when the frontend proxy cannot reach the payment API', async () => {
  global.fetch.mockImplementation((url) => {
    if (url === '/api/checkout/customer') {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ customer: null }))
      });
    }
    return Promise.resolve({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Proxy error: Could not proxy request')
    });
  });

  render(<Provider store={store}><Cart /></Provider>);
  fireEvent.click(screen.getByRole('button', { name: /continue to checkout/i }));
  await screen.findByLabelText(/mobile number/i);
  fillCheckoutDetails();
  fireEvent.click(screen.getByRole('button', { name: /pay ₹24\.50/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/payment api is not reachable/i);
  expect(screen.getByRole('alert')).toHaveTextContent(/npm start/i);
  expect(store.getState().cart.items).toHaveLength(1);
});

test('requires sign-in before showing the payment form or calling the order API', async () => {
  useAuth.mockReturnValue({ user: null, loading: false });
  render(<Provider store={store}><Cart /></Provider>);

  fireEvent.click(screen.getByRole('button', { name: /sign in to checkout/i }));

  expect(screen.getByRole('dialog', { name: /sign in/i })).toBeInTheDocument();
  expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: /complete sign in/i }));

  expect(await screen.findByLabelText(/delivery recipient name/i)).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith('/api/checkout/customer', expect.objectContaining({
    headers: { Authorization: 'Bearer firebase-id-token' }
  }));
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { downloadInvoice } from '../utils/invoicePdf';
import Profile from './Profile';
import { useAuth } from '../Context/AuthContext';

jest.mock('../Context/AuthContext', () => ({
  useAuth: jest.fn()
}));

jest.mock('../utils/invoicePdf', () => ({
  downloadInvoice: jest.fn()
}));

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>
}), { virtual: true });

jest.mock('./AccountModal', () => function MockAccountModal({ onClose }) {
  return <div role="dialog"><button type="button" onClick={onClose}>Close sign in</button></div>;
});

const user = {
  uid: 'user-123',
  displayName: 'Taylor Shopper',
  email: 'taylor@example.com',
  getIdToken: jest.fn().mockResolvedValue('firebase-id-token')
};

beforeEach(() => {
  jest.clearAllMocks();
  user.getIdToken.mockResolvedValue('firebase-id-token');
  useAuth.mockReturnValue({ user, loading: false });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({
      orders: [{
        orderId: 'order_123',
        invoiceNumber: 'SF-20261028-ORDER123',
        paymentStatus: 'paid',
        status: 'confirmed',
        amount: 4900,
        subtotal: 4900,
        currency: 'INR',
        customer: {
          name: 'Taylor Shopper',
          email: 'taylor@example.com',
          phone: '+15551234567',
          address: '123 Main Street',
          city: 'Test City',
          state: 'Test State',
          postalCode: '12345',
          country: 'India'
        },
        createdAt: '2026-10-28T10:00:00.000Z',
        items: [{ id: 1, title: 'Test item', quantity: 2, unitAmount: 2450 }],
        payment: {
          paymentId: 'pay_123',
          status: 'captured',
          method: 'card',
          paymentDate: '2026-10-28T10:01:00.000Z'
        }
      }]
    })
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('loads profile and paid order history and allows downloading its invoice', async () => {
  render(<Profile />);

  expect(await screen.findByRole('heading', { name: 'order_123' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Your profile' })).toBeInTheDocument();
  expect(screen.getByText('Taylor Shopper')).toBeInTheDocument();
  expect(screen.getByText('Test item × 2')).toBeInTheDocument();
  expect(screen.getByText('Payment ID: pay_123')).toBeInTheDocument();
  expect(screen.getAllByText('₹49.00')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: /download invoice/i }));
  expect(downloadInvoice).toHaveBeenCalledWith(expect.objectContaining({
    invoiceNumber: 'SF-20261028-ORDER123',
    paymentStatus: 'paid'
  }));
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith('/api/orders', {
      headers: { Authorization: 'Bearer firebase-id-token' }
    });
  });
});

test('requires sign-in before requesting order history', () => {
  useAuth.mockReturnValue({ user: null, loading: false });

  render(<Profile />);

  expect(screen.getByRole('heading', { name: /sign in to view your orders/i })).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

test('hides orders without a captured payment from order history', async () => {
  global.fetch.mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({
      orders: [
        {
          orderId: 'order_pending',
          status: 'pending',
          paymentStatus: 'pending',
          amount: 4900,
          subtotal: 4900,
          currency: 'INR',
          customer: { name: 'Taylor Shopper' },
          createdAt: '2026-10-28T10:00:00.000Z',
          items: [{ id: 1, title: 'Pending item', quantity: 1, unitAmount: 2450 }],
          payment: null
        },
        {
          orderId: 'order_failed',
          status: 'payment_failed',
          paymentStatus: 'failed',
          amount: 4900,
          subtotal: 4900,
          currency: 'INR',
          customer: { name: 'Taylor Shopper' },
          createdAt: '2026-10-28T10:00:00.000Z',
          items: [{ id: 2, title: 'Failed item', quantity: 1, unitAmount: 2450 }],
          payment: { paymentId: 'pay_failed', status: 'failed' }
        }
      ]
    })
  });

  render(<Profile />);

  expect(await screen.findByRole('heading', { name: 'No orders yet' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'order_pending' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'order_failed' })).not.toBeInTheDocument();
  expect(screen.queryByText('Pending item × 1')).not.toBeInTheDocument();
  expect(screen.queryByText('Failed item × 1')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /download invoice/i })).not.toBeInTheDocument();
});

test('explains how to fix an outdated API when order history returns 404', async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    status: 404,
    text: async () => '<!doctype html><title>Not Found</title>'
  });

  render(<Profile />);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The order-history API route was not found. The API on port 5000 may be outdated'
  );
  expect(screen.getByRole('alert')).toHaveTextContent('npm run server');
});

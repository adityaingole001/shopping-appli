import { fireEvent, render, screen } from '@testing-library/react';
import Contact from './Contact';

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({ message: 'Your message has been received.' })
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('submits contact details and shows confirmation', async () => {
  render(<Contact />);

  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Taylor Shopper' } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'taylor@example.com' } });
  fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Please help with my order.' } });
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));

  expect(await screen.findByRole('status')).toHaveTextContent('Your message has been received.');
  expect(global.fetch).toHaveBeenCalledWith('/api/contact', expect.objectContaining({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Taylor Shopper',
      email: 'taylor@example.com',
      message: 'Please help with my order.'
    })
  }));
  expect(screen.getByLabelText(/name/i)).toHaveValue('');
});

test('shows an error when the contact submission cannot be saved', async () => {
  global.fetch.mockResolvedValue({
    ok: false,
    status: 503,
    text: async () => JSON.stringify({ error: 'Your message could not be saved right now. Please try again.' })
  });

  render(<Contact />);
  fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Taylor Shopper' } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'taylor@example.com' } });
  fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Please help with my order.' } });
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Your message could not be saved');
});

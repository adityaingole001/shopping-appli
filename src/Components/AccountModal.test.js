import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AccountModal from './AccountModal';
import { useAuth } from '../Context/AuthContext';

jest.mock('../Context/AuthContext', () => ({
  useAuth: jest.fn()
}));

const authActions = {
  signIn: jest.fn(),
  createAccount: jest.fn(),
  signInWithGoogle: jest.fn()
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({
    configured: true,
    ...authActions
  });
});

test('switches to account creation and submits the entered profile and credentials', async () => {
  const onClose = jest.fn();
  render(<AccountModal initialMode="signin" onClose={onClose} />);

  fireEvent.click(screen.getByRole('button', { name: /create account/i }));
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Taylor Shopper' } });
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'taylor@example.com' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secure-password' } });
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));

  await waitFor(() => {
    expect(authActions.createAccount).toHaveBeenCalledWith(
      'Taylor Shopper',
      'taylor@example.com',
      'secure-password'
    );
  });
  expect(onClose).toHaveBeenCalled();
});
test('offers Google sign-in and displays Firebase errors', async () => {
  const onClose = jest.fn();
  authActions.signInWithGoogle.mockRejectedValueOnce({
    code: 'auth/unauthorized-domain'
  });
  render(<AccountModal initialMode="signin" onClose={onClose} />);

  fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/authorized domains/i);
  expect(onClose).not.toHaveBeenCalled();
});
test('explains how to fix Firebase request-origin restrictions', async () => {
  authActions.signInWithGoogle.mockRejectedValueOnce({
    code: 'auth/internal-error',
    message: 'Request origin is not allowed.'
  });
  render(<AccountModal initialMode="signin" onClose={jest.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/authorized domains/i);
  expect(screen.getByRole('alert')).toHaveTextContent(/HTTP referrer restrictions/i);
});

test('disables account actions and explains setup when Firebase is not configured', () => {
  useAuth.mockReturnValue({
    configured: false,
    ...authActions
  });
  render(<AccountModal initialMode="signin" onClose={jest.fn()} />);

  expect(screen.getByRole('alert')).toHaveTextContent(/root .*\.env\.local/i);
  expect(screen.getByRole('button', { name: /continue with google/i })).toBeDisabled();
  expect(screen.getByRole('button', { name: /^sign in$/i })).toBeDisabled();
});

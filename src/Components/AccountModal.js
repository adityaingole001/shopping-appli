import { useState } from 'react';
import { useAuth } from '../Context/AuthContext';

function getAuthErrorMessage(error) {
  const errorMessage = error.message || '';
  if (/request origin is not allowed|referer.*blocked|referrer.*blocked/i.test(errorMessage)) {
    return 'Firebase blocked this site origin. Add its hostname in Firebase Authentication → Settings → Authorized domains. If it is already listed, check the Firebase API key HTTP referrer restrictions in Google Cloud Console.';
  }

  const messages = {
    'auth/email-already-in-use': 'An account already exists for this email. Try signing in.',
    'auth/invalid-credential': 'That email and password combination was not recognized.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
    'auth/too-many-requests': 'Too many attempts. Wait a little and try again.',
    'auth/weak-password': 'Choose a password with at least 6 characters.',
    'auth/network-request-failed': 'Could not connect to Firebase. Check your internet connection and try again.',
    'auth/unauthorized-domain': 'Firebase blocked this site origin. Add its hostname in Firebase Authentication → Settings → Authorized domains. If it is already listed, check the Firebase API key HTTP referrer restrictions in Google Cloud Console.',
    'firestore/permission-denied': 'Your account was signed in, but its profile could not be saved. Check that Firestore is enabled and firestore.rules are published.',
    'permission-denied': 'Your account was signed in, but its profile could not be saved. Check that Firestore is enabled and firestore.rules are published.',
    'unavailable': 'Could not save your account profile because Firestore is unavailable. Check your connection and try again.'
  };

  return messages[error.code] || error.message || 'Account authentication failed. Please try again.';
}

function AccountModal({ initialMode, onClose, onSuccess }) {
  const { configured, signIn, createAccount, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);

    try {
      let credential;
      if (mode === 'signup') {
        credential = await createAccount(name, email, password);
      } else {
        credential = await signIn(email, password);
      }
      if (onSuccess) onSuccess(credential?.user);
      onClose();
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setBusy(true);
    try {
      const credential = await signInWithGoogle();
      if (onSuccess) onSuccess(credential?.user);
      onClose();
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="account-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
      >
        <button
          type="button"
          className="account-modal-close"
          aria-label="Close account dialog"
          disabled={busy}
          onClick={onClose}
        >
          <i className="bi bi-x-lg" aria-hidden="true" />
        </button>
        <div className="account-modal-heading">
          <span className="brand-mark account-modal-mark">
            <i className="bi bi-bag-heart" aria-hidden="true" />
          </span>
          <p className="eyebrow">WELCOME TO SHOPFUSION</p>
          <h2 id="account-modal-title">
            {mode === 'signup' ? 'Join ShopFusion' : 'Welcome back'}
          </h2>
          <p className="account-modal-subtitle">
            {mode === 'signup'
              ? 'Create an account for a more personal shopping experience.'
              : 'Sign in to continue to your account.'}
          </p>
        </div>

        <div className="account-mode-tabs" role="tablist" aria-label="Account options">
          <button
            type="button"
            role="tab"
            id="account-signin-tab"
            aria-controls="account-auth-panel"
            aria-selected={mode === 'signin'}
            className={mode === 'signin' ? 'active' : ''}
            disabled={busy}
            onClick={() => {
              setError('');
              setMode('signin');
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            id="account-signup-tab"
            aria-controls="account-auth-panel"
            aria-selected={mode === 'signup'}
            className={mode === 'signup' ? 'active' : ''}
            disabled={busy}
            onClick={() => {
              setError('');
              setMode('signup');
            }}
          >
            Create account
          </button>
        </div>

        <div
          id="account-auth-panel"
          role="tabpanel"
          aria-labelledby={mode === 'signup' ? 'account-signup-tab' : 'account-signin-tab'}
        >
        {!configured && (
          <div className="alert alert-warning text-start" role="alert">
            Account sign-in is not configured yet. Add the Firebase web app settings to the project’s root <code>.env.local</code>, then restart the app. See the Firebase setup steps in README.
          </div>
        )}
        {error && <div className="alert alert-danger text-start" role="alert">{error}</div>}

        <button
          type="button"
          className="btn google-signin-button w-100"
          disabled={busy || !configured}
          onClick={handleGoogleSignIn}
        >
          <span className="google-g" aria-hidden="true">G</span>
          Continue with Google
        </button>

        <div className="account-divider"><span>or continue with email</span></div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="mb-3 account-name-field">
              <label className="form-label" htmlFor="account-name">Full name</label>
              <input
                className="form-control"
                id="account-name"
                autoComplete="name"
                minLength="2"
                maxLength="100"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          )}
          <div className="mb-3">
            <label className="form-label" htmlFor="account-email">Email address</label>
            <input
              className="form-control"
              id="account-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="account-password">Password</label>
            <input
              className="form-control"
              id="account-password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength="6"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-brand w-100" disabled={busy || !configured}>
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="account-mode-switch">
          {mode === 'signup'
            ? 'Your account keeps your orders and delivery details together.'
            : 'Your bag is saved while you sign in.'}
        </p>
        </div>
      </section>
    </div>
  );
}

export default AccountModal;

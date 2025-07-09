import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { login } from '../redux/authSlice';

function LoginForm({ onClose, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();

  const handleSubmit = (e) => {
    e.preventDefault();


    if (email === 'aditya@gmail.com' && password === '12345') {
      dispatch(login({ email }));

  
      localStorage.setItem('user', JSON.stringify({ email }));

      onLoginSuccess(); 
    } else {
      alert('Invalid credentials');
    }
  };

  return (
    <div>
      <h5 className="mb-3">Login to Checkout</h5>
      <form onSubmit={handleSubmit}>
        <div className="mb-2">
          <input
            type="email"
            className="form-control"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <input
            type="password"
            className="form-control"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="d-flex justify-content-between">
          <button type="submit" className="btn btn-dark">Login</button>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default LoginForm;

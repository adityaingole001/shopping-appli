// src/redux/cartSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: loadCart()
};

function loadCart() {
  try {
    const storedCart = localStorage.getItem('cart');
    const items = storedCart ? JSON.parse(storedCart) : [];
    if (!Array.isArray(items)) throw new Error('Stored cart must be an array.');
    return items
      .filter((item) =>
        item &&
        Number.isFinite(item.id) &&
        Number.isFinite(item.price) &&
        typeof item.title === 'string' &&
        typeof item.image === 'string'
      )
      .map((item) => ({
        ...item,
        quantity: Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1
      }));
  } catch (error) {
    console.error('Unable to restore the saved cart:', error);
    return [];
  }
}

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart(state, action) {
      const existingItem = state.items.find((item) => item.id === action.payload.id);
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        state.items.push({ ...action.payload, quantity: 1 });
      }
    },
    removeFromCart(state, action) {
      state.items = state.items.filter(item => item.id !== action.payload);
    },
    updateQuantity(state, action) {
      const item = state.items.find((cartItem) => cartItem.id === action.payload.id);
      if (!item) return;
      if (action.payload.quantity <= 0) {
        state.items = state.items.filter((cartItem) => cartItem.id !== action.payload.id);
      } else {
        item.quantity = action.payload.quantity;
      }
    },
    clearCart(state) {
      state.items = [];
    }
  }
});

export const { addToCart, removeFromCart, updateQuantity, clearCart } = cartSlice.actions;
export default cartSlice.reducer;

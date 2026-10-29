import { act, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import Home from './Home';
import store from '../redux/store';
import { clearCart } from '../redux/cartSlice';

beforeEach(() => {
  store.dispatch(clearCart());
  global.fetch = jest.fn((url) => {
    if (url === '/api/pricing') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          baseCurrency: 'USD',
          currency: 'INR',
          usdToInrRate: 83.5
        })
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => [{
        id: 1,
        title: 'Test item',
        price: 24.5,
        description: 'A test product.',
        category: 'test',
        image: 'https://example.com/item.jpg'
      }]
    });
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('converts USD catalog prices to INR before showing or adding them to the cart', async () => {
  render(<Provider store={store}><Home /></Provider>);

  expect(await screen.findByText('₹2,045.75')).toBeInTheDocument();
  await act(async () => {
    screen.getByRole('button', { name: /add test item to cart/i }).click();
  });

  await waitFor(() => {
    expect(store.getState().cart.items[0].price).toBe(2045.75);
  });
});

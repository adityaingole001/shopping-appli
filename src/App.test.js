import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import App from './App';
import store from './redux/store';
import { clearCart } from './redux/cartSlice';

const product = {
  id: 1,
  title: 'Everyday Shopper Tote',
  price: 24.5,
  description: 'A practical bag for everyday use.',
  category: 'accessories',
  image: 'https://example.com/tote.jpg'
};

beforeEach(() => {
  localStorage.clear();
  store.dispatch(clearCart());
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([product])
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('shopper can add an item, complete demo checkout, and see confirmation', async () => {
  render(
    <Provider store={store}>
      <App />
    </Provider>
  );

  expect(await screen.findByText(product.title)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /view details/i }));
  fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));
  expect(JSON.parse(localStorage.getItem('cart'))[0].quantity).toBe(1);
  fireEvent.click(screen.getByRole('link', { name: /shopping bag, 1 item/i }));

  expect(await screen.findByRole('heading', { name: /your shopping bag/i })).toBeInTheDocument();
  expect(screen.getAllByText('$24.50')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: /continue to demo checkout/i }));

  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Taylor Shopper' } });
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'taylor@example.com' } });
  fireEvent.change(screen.getByLabelText(/delivery address/i), { target: { value: '123 Market Street' } });
  fireEvent.click(screen.getByRole('button', { name: /confirm demo order/i }));

  expect(await screen.findByRole('heading', { name: /thanks, taylor shopper/i })).toBeInTheDocument();
  expect(screen.getByText(/no payment was taken/i)).toBeInTheDocument();
  await waitFor(() => expect(store.getState().cart.items).toHaveLength(0));
  expect(JSON.parse(localStorage.getItem('cart'))).toEqual([]);
});

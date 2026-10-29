import { downloadInvoice } from './invoicePdf';

test('refuses to create an invoice for an order without captured payment', async () => {
  await expect(downloadInvoice({
    paymentStatus: 'paid',
    payment: { status: 'authorized' }
  })).rejects.toThrow('An invoice is available only for a successfully paid order.');
});

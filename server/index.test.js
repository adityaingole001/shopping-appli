const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { getApp } = require('./index');

const testPaymentConfiguration = {
  keyId: 'rzp_test_fixture',
  keySecret: 'test_server_secret',
  webhookSecret: 'test_webhook_secret',
  allowLivePayments: false
};

test('creates INR orders from server prices and verifies captured payment signatures', async () => {
  let orderRequest;
  let paymentFetchCount = 0;
  let paymentStatus = 'captured';
  let captureCount = 0;
  const savedOrders = new Map();
  const savedPayments = new Map();
  const orderStore = {
    savePending: async (uid, savedOrder) => savedOrders.set(`${uid}/${savedOrder.orderId}`, savedOrder),
    save: async (uid, savedOrder, payment) => {
      savedOrders.set(`${uid}/${savedOrder.orderId}`, savedOrder);
      savedPayments.set(`${uid}/${payment.paymentId}`, payment);
    },
    list: async (uid) => [...savedOrders.entries()]
      .filter(([key]) => key.startsWith(`${uid}/`))
      .map(([, savedOrder]) => ({
        ...savedOrder,
        payment: savedPayments.get(`${uid}/${savedOrder.paymentId}`) || null
      })),
    getDeliveryAddresses: async (uid) => {
      const latestPaidOrder = [...savedOrders.entries()]
        .filter(([key, savedOrder]) => key.startsWith(`${uid}/`) && savedOrder.paymentStatus === 'paid')
        .map(([, savedOrder]) => savedOrder)
        .sort((left, right) => right.createdAt - left.createdAt)[0];
      return latestPaidOrder ? [latestPaidOrder.customer] : [];
    }
  };
  const razorpay = {
    orders: {
      create: async (request) => {
        orderRequest = request;
        return { id: 'order_test_server_1' };
      }
    },
    payments: {
      fetch: async (paymentId) => {
        paymentFetchCount += 1;
        return {
          id: paymentId,
          order_id: 'order_test_server_1',
          amount: 4900,
          currency: 'INR',
          status: paymentStatus,
          method: 'card',
          created_at: 1793270000
        };
      },
      capture: async (paymentId, amount, currency) => {
        captureCount += 1;
        assert.equal(amount, 4900);
        assert.equal(currency, 'INR');
        return {
          id: paymentId,
          order_id: 'order_test_server_1',
          amount,
          currency,
          status: 'captured'
        };
      }
    }
  };

  const app = getApp({
    razorpayFactory: () => razorpay,
    paymentConfigLoader: async () => testPaymentConfiguration,
    exchangeRateFetcher: async () => 1,
    verifyFirebaseToken: async (token) => {
      if (token === 'invalid-token') throw new Error('Invalid Firebase token.');
      return { uid: token === 'other-user-token' ? 'other-user' : 'test-user' };
    },
    productFetcher: async () => ({
      ok: true,
      json: async () => ({ id: 1, title: 'Test item', price: 24.5 })
    }),
    orderStore
  });

  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const unauthenticatedResponse = await fetch(`${baseUrl}/api/checkout/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: 1, quantity: 2 }],
        customer: {
          name: 'Test Shopper',
          email: 'shopper@example.com',
          phone: '+15551234567',
          address: '123 Test Street',
          city: 'Test City',
          state: 'Test State',
          postalCode: '12345',
          country: 'Test Country'
        }
      })
    });
    assert.equal(unauthenticatedResponse.status, 401);

    const unauthenticatedCustomerResponse = await fetch(`${baseUrl}/api/checkout/customer`);
    assert.equal(unauthenticatedCustomerResponse.status, 401);

    const orderResponse = await fetch(`${baseUrl}/api/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer currency-test-token'
      },
      body: JSON.stringify({
        items: [{ id: 1, quantity: 2 }],
        customer: {
          name: 'Test Shopper',
          email: 'shopper@example.com',
          phone: '+15551234567',
          address: '123 Test Street',
          city: 'Test City',
          state: 'Test State',
          postalCode: '12345',
          country: 'Test Country'
        },
        total: 1
      })
    });
    const order = await orderResponse.json();

    assert.equal(orderResponse.status, 201, JSON.stringify(order));
    assert.equal(order.amount, 4900);
    assert.equal(order.currency, 'INR');
    assert.equal(order.keyId, testPaymentConfiguration.keyId);
    assert.equal(orderRequest.amount, 4900);
    assert.equal(orderRequest.currency, 'INR');
    assert.equal(Object.prototype.hasOwnProperty.call(order, 'keySecret'), false);
    const pendingHistoryOrder = savedOrders.get(`test-user/${order.orderId}`);
    assert.equal(pendingHistoryOrder.paymentStatus, 'pending');
    assert.equal(Object.prototype.hasOwnProperty.call(pendingHistoryOrder, 'invoiceNumber'), false);
    assert.equal(savedPayments.size, 0);

    const otherAccountSignature = crypto
      .createHmac('sha256', testPaymentConfiguration.keySecret)
      .update(`${order.orderId}|pay_other_account`)
      .digest('hex');
    const otherAccountResponse = await fetch(`${baseUrl}/api/checkout/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer other-user-token'
      },
      body: JSON.stringify({
        razorpay_order_id: order.orderId,
        razorpay_payment_id: 'pay_other_account',
        razorpay_signature: otherAccountSignature
      })
    });
    assert.equal(otherAccountResponse.status, 403);
    assert.equal(paymentFetchCount, 0);

    const invalidSignatureResponse = await fetch(`${baseUrl}/api/checkout/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-firebase-token'
      },
      body: JSON.stringify({
        razorpay_order_id: order.orderId,
        razorpay_payment_id: 'pay_test_server_1',
        razorpay_signature: 'invalid'
      })
    });
    assert.equal(invalidSignatureResponse.status, 400);
    assert.equal(paymentFetchCount, 0);

    const signature = crypto
      .createHmac('sha256', testPaymentConfiguration.keySecret)
      .update(`${order.orderId}|pay_test_server_1`)
      .digest('hex');
    const verifyResponse = await fetch(`${baseUrl}/api/checkout/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-firebase-token'
      },
      body: JSON.stringify({
        razorpay_order_id: order.orderId,
        razorpay_payment_id: 'pay_test_server_1',
        razorpay_signature: signature
      })
    });
    const verified = await verifyResponse.json();

    assert.equal(verifyResponse.status, 200);
    assert.equal(verified.status, 'paid');
    assert.equal(verified.orderId, order.orderId);
    assert.equal(verified.paymentId, 'pay_test_server_1');
    assert.equal(verified.amount, 4900);
    assert.equal(verified.customer.name, 'Test Shopper');
    assert.match(verified.invoiceNumber, /^SF-/);
    assert.equal(verified.payment.method, 'card');
    assert.equal(verified.payment.paymentDate, new Date(1793270000 * 1000).toISOString());
    assert.equal(paymentFetchCount, 1);
    assert.equal(captureCount, 0);

    const unauthenticatedHistory = await fetch(`${baseUrl}/api/orders`);
    assert.equal(unauthenticatedHistory.status, 401);

    savedOrders.set('test-user/order_test_pending', {
      orderId: 'order_test_pending',
      paymentStatus: 'pending',
      status: 'pending',
      createdAt: Date.now()
    });

    const historyResponse = await fetch(`${baseUrl}/api/orders`, {
      headers: { Authorization: 'Bearer test-user-token' }
    });
    const history = await historyResponse.json();
    assert.equal(historyResponse.status, 200);
    assert.equal(history.orders.length, 1);
    assert.equal(history.orders[0].orderId, order.orderId);
    assert.equal(history.orders[0].paymentStatus, 'paid');
    assert.equal(history.orders[0].status, 'confirmed');
    assert.equal(history.orders[0].customer.phone, '+15551234567');
    assert.equal(history.orders[0].payment.status, 'captured');
    assert.equal(history.orders[0].payment.paymentId, 'pay_test_server_1');
    assert.equal(history.orders.some((savedOrder) => savedOrder.orderId === 'order_test_pending'), false);
    assert.equal(savedPayments.size, 1);

    const savedCustomerResponse = await fetch(`${baseUrl}/api/checkout/customer`, {
      headers: { Authorization: 'Bearer test-firebase-token' }
    });
    const savedCustomer = await savedCustomerResponse.json();
    assert.equal(savedCustomerResponse.status, 200);
    assert.equal(savedCustomer.customer.phone, '+15551234567');
    assert.equal(savedCustomer.addresses.length, 1);
    assert.equal(savedCustomer.addresses[0].address, '123 Test Street');

    const otherAccountCustomerResponse = await fetch(`${baseUrl}/api/checkout/customer`, {
      headers: { Authorization: 'Bearer other-user-token' }
    });
    assert.deepEqual(await otherAccountCustomerResponse.json(), { customer: null, addresses: [] });

    const otherAccountHistory = await fetch(`${baseUrl}/api/orders`, {
      headers: { Authorization: 'Bearer other-user-token' }
    });
    assert.deepEqual(await otherAccountHistory.json(), { orders: [] });

    paymentStatus = 'authorized';
    const authorizedPaymentId = 'pay_test_authorized';
    const authorizedSignature = crypto
      .createHmac('sha256', testPaymentConfiguration.keySecret)
      .update(`${order.orderId}|${authorizedPaymentId}`)
      .digest('hex');
    const captureResponse = await fetch(`${baseUrl}/api/checkout/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-firebase-token'
      },
      body: JSON.stringify({
        razorpay_order_id: order.orderId,
        razorpay_payment_id: authorizedPaymentId,
        razorpay_signature: authorizedSignature
      })
    });
    assert.equal(captureResponse.status, 200);
    assert.equal(captureCount, 1);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('allows local development origins while rejecting unconfigured remote origins', async () => {
  const previousClientOrigin = process.env.CLIENT_ORIGIN;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.CLIENT_ORIGIN = 'http://localhost:3000/';
  process.env.NODE_ENV = 'development';

  const app = getApp();
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const localResponse = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://127.0.0.1:3001' }
    });
    assert.equal(localResponse.headers.get('access-control-allow-origin'), 'http://127.0.0.1:3001');

    const remoteResponse = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://shop.example.com' }
    });
    assert.equal(remoteResponse.status, 403);
    assert.deepEqual(await remoteResponse.json(), { error: 'Request origin is not allowed.' });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (previousClientOrigin === undefined) delete process.env.CLIENT_ORIGIN;
    else process.env.CLIENT_ORIGIN = previousClientOrigin;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('stores valid contact submissions separately and rejects invalid input', async () => {
  const submissions = [];
  const app = getApp({
    contactStore: {
      save: async (submission) => {
        submissions.push(submission);
        return 'contact_submission_1';
      }
    }
  });
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: ' Taylor Shopper ',
        email: ' taylor@example.com ',
        message: ' Please help with my order. '
      })
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      message: 'Your message has been received.',
      submissionId: 'contact_submission_1'
    });
    assert.deepEqual(submissions, [{
      name: 'Taylor Shopper',
      email: 'taylor@example.com',
      message: 'Please help with my order.'
    }]);

    const invalidResponse = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'T', email: 'invalid', message: 'Hi' })
    });
    assert.equal(invalidResponse.status, 400);
    assert.equal(submissions.length, 1);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('uses the same live USD to INR rate for displayed prices and server-calculated orders', async () => {
  let createdOrder;
  let savedPendingOrder;
  let rateFetchCount = 0;
  const app = getApp({
    razorpayFactory: () => ({
      orders: {
        create: async (request) => {
          createdOrder = request;
          return { id: 'order_test_currency' };
        }
      }
    }),
    paymentConfigLoader: async () => testPaymentConfiguration,
    exchangeRateFetcher: async () => {
      rateFetchCount += 1;
      return 83.5;
    },
    productFetcher: async () => ({
      ok: true,
      json: async () => ({ id: 1, title: 'Test item', price: 24.5 })
    }),
    orderStore: {
      savePending: async (uid, order) => { savedPendingOrder = { uid, ...order }; }
    },
    verifyFirebaseToken: async () => ({ uid: 'test-user' })
  });
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const pricingResponse = await fetch(`${baseUrl}/api/pricing`);
    const pricing = await pricingResponse.json();
    assert.equal(pricingResponse.status, 200);
    assert.deepEqual(pricing, {
      baseCurrency: 'USD',
      currency: 'INR',
      usdToInrRate: 83.5
    });

    const orderResponse = await fetch(`${baseUrl}/api/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: ['Bearer', 'currency-test-token'].join(' ')
      },
      body: JSON.stringify({
        items: [{ id: 1, quantity: 1 }],
        customer: {
          name: 'Test Shopper',
          email: 'shopper@example.com',
          phone: '+15551234567',
          address: '123 Test Street',
          city: 'Test City',
          state: 'Test State',
          postalCode: '12345',
          country: 'India'
        }
      })
    });
    const order = await orderResponse.json();
    if (orderResponse.status !== 201) console.error('Currency checkout test response:', order);
    assert.equal(orderResponse.status, 201, JSON.stringify(order));
    assert.equal(createdOrder.amount, 204575);
    assert.equal(createdOrder.currency, 'INR');
    assert.equal(order.amount, 204575);
    assert.equal(savedPendingOrder.items[0].unitAmount, 204575);
    assert.equal(rateFetchCount, 1);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('reports rejected Razorpay credentials without exposing provider details', async () => {
  const app = getApp({
    exchangeRateFetcher: async () => 1,
    paymentConfigLoader: async () => testPaymentConfiguration,
    razorpayFactory: () => ({
      orders: {
        create: async () => {
          const error = new Error('Provider response details');
          error.statusCode = 401;
          error.error = { code: 'AUTHENTICATION_ERROR' };
          throw error;
        }
      }
    }),
    verifyFirebaseToken: async () => ({ uid: 'test-user' }),
    productFetcher: async () => ({
      ok: true,
      json: async () => ({ id: 1, title: 'Test item', price: 24.5 })
    })
  });
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token'
      },
      body: JSON.stringify({
        items: [{ id: 1, quantity: 1 }],
        customer: {
          name: 'Test Shopper',
          email: 'shopper@example.com',
          phone: '+15551234567',
          address: '123 Test Street',
          city: 'Test City',
          state: 'Test State',
          postalCode: '12345',
          country: 'Test Country'
        }
      })
    });

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      error: 'Razorpay rejected the server credentials. Check that the Key ID and Key Secret are a matching pair from Razorpay Test Mode.'
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('reports rejected Razorpay order details without exposing provider details', async () => {
  const app = getApp({
    exchangeRateFetcher: async () => 1,
    paymentConfigLoader: async () => testPaymentConfiguration,
    razorpayFactory: () => ({
      orders: {
        create: async () => {
          const error = new Error('Provider response details');
          error.statusCode = 400;
          error.error = { code: 'BAD_REQUEST_ERROR' };
          throw error;
        }
      }
    }),
    verifyFirebaseToken: async () => ({ uid: 'test-user' }),
    productFetcher: async () => ({
      ok: true,
      json: async () => ({ id: 1, title: 'Test item', price: 24.5 })
    })
  });
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token'
      },
      body: JSON.stringify({
        items: [{ id: 1, quantity: 1 }],
        customer: {
          name: 'Test Shopper',
          email: 'shopper@example.com',
          phone: '+15551234567',
          address: '123 Test Street',
          city: 'Test City',
          state: 'Test State',
          postalCode: '12345',
          country: 'Test Country'
        }
      })
    });

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      error: 'Razorpay rejected the order details. Check the API terminal for the provider error code.'
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('returns a specific validation error for incomplete delivery details', async () => {
  const app = getApp({
    paymentConfigLoader: async () => testPaymentConfiguration,
    razorpayFactory: () => ({ orders: { create: async () => ({ id: 'order_test_validation' }) } }),
    verifyFirebaseToken: async () => ({ uid: 'test-user' })
  });
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token'
      },
      body: JSON.stringify({
        items: [{ id: 1, quantity: 1 }],
        customer: {
          name: 'Test Shopper',
          email: 'shopper@example.com',
          phone: '+15551234567',
          address: '',
          city: 'Test City',
          state: 'Test State',
          postalCode: '12345',
          country: 'Test Country'
        }
      })
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'Enter a delivery address between 5 and 500 characters.'
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

const crypto = require('crypto');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const Razorpay = require('razorpay');
const { applicationDefault, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

const PORT = Number(process.env.PORT) || 5000;
const CURRENCY = 'INR';
const PRODUCT_API = 'https://fakestoreapi.com/products';
const EXCHANGE_RATE_API = 'https://open.er-api.com/v6/latest/USD';
const EXCHANGE_RATE_CACHE_MS = 60 * 60 * 1000;
const RAZORPAY_CONFIG_CACHE_MS = 60 * 1000;
const ORDER_TTL_MS = 30 * 60 * 1000;
const MAX_PENDING_ORDERS = 1000;
const pendingOrders = new Map();
const processedWebhookEvents = new Set();
let firebaseAdminAuth;

function getFirebaseAdminApp() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath || !fs.existsSync(path.resolve(process.cwd(), credentialsPath))) return null;

  return getApps().length > 0
    ? getApps()[0]
    : initializeApp({ credential: applicationDefault() });
}

function safeCompareHex(expected, received) {
  if (typeof received !== 'string' || !/^[a-f0-9]+$/i.test(received)) return false;
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(received, 'hex');
  return expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

async function getFirebaseRazorpayConfiguration() {
  const app = getFirebaseAdminApp();
  if (!app) throw new Error('Firebase Admin credentials are not configured.');

  const snapshot = await getFirestore(app).collection('razorpay').limit(2).get();
  if (snapshot.size !== 1) {
    throw new Error('The razorpay collection must contain exactly one configuration document.');
  }

  const settings = snapshot.docs[0].data();
  return {
    keyId: typeof settings.RAZORPAY_KEY_ID === 'string' ? settings.RAZORPAY_KEY_ID.trim() : '',
    keySecret: typeof settings.RAZORPAY_KEY_SECRET === 'string' ? settings.RAZORPAY_KEY_SECRET.trim() : '',
    webhookSecret: typeof settings.RAZORPAY_WEBHOOK_SECRET === 'string'
      ? settings.RAZORPAY_WEBHOOK_SECRET.trim()
      : '', 
    allowLivePayments: settings.ALLOW_LIVE_PAYMENTS === true
  };
}

function isValidRazorpayConfiguration(configuration) {
  return Boolean(
    configuration &&
    typeof configuration.keyId === 'string' &&
    typeof configuration.keySecret === 'string' &&
    configuration.keyId &&
    configuration.keySecret &&
    (configuration.keyId.startsWith('rzp_test_') || configuration.allowLivePayments === true)
  );
}

function getRazorpayClient(configuration) {
  if (!isValidRazorpayConfiguration(configuration)) return null;
  return new Razorpay({
    key_id: configuration.keyId,
    key_secret: configuration.keySecret
  });
}

function firebaseAdminCredentialsConfigured() {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  return Boolean(credentialsPath && fs.existsSync(path.resolve(process.cwd(), credentialsPath)));
}

function getFirebaseAdminAuth() {
  if (firebaseAdminAuth) return firebaseAdminAuth;
  const app = getFirebaseAdminApp();
  if (!app) return null;
  firebaseAdminAuth = getAuth(app);
  return firebaseAdminAuth;
}

function getFirebaseOrderStore() {
  return {
    async savePending(uid, order) {
      const app = getFirebaseAdminApp();
      if (!app) throw new Error('Firebase Admin credentials are not configured.');
      const db = getFirestore(app);
      await db.collection('users').doc(uid).collection('orders').doc(order.orderId).set({
        ...order,
        uid,
        createdAt: new Date(order.createdAt)
      });
    },
    async save(uid, order, payment) {
      const app = getFirebaseAdminApp();
      if (!app) throw new Error('Firebase Admin credentials are not configured.');
      const db = getFirestore(app);
      const userRef = db.collection('users').doc(uid);
      await db.runTransaction(async (transaction) => {
        const userSnapshot = await transaction.get(userRef);
        const userData = userSnapshot.exists ? userSnapshot.data() : {};
        const storedAddresses = Array.isArray(userData.deliveryAddresses)
          ? userData.deliveryAddresses.filter((address) => address && typeof address === 'object')
          : [];
        const savedAddresses = storedAddresses.length > 0
          ? storedAddresses
          : userData.lastDeliveryDetails
            ? [userData.lastDeliveryDetails]
            : [];
        const addressKey = (customer) => [
          customer.phone,
          customer.address,
          customer.city,
          customer.state,
          customer.postalCode,
          customer.country
        ].map((value) => String(value || '').trim().toLowerCase()).join('|');
        const currentAddressKey = addressKey(order.customer);
        const deliveryAddresses = [
          order.customer,
          ...savedAddresses.filter((address) => addressKey(address) !== currentAddressKey)
        ];
        transaction.set(userRef.collection('orders').doc(order.orderId), {
          ...order,
          uid,
          createdAt: new Date(order.createdAt),
          paidAt: FieldValue.serverTimestamp()
        });
        transaction.set(userRef.collection('payments').doc(payment.paymentId), {
          ...payment,
          uid,
          paidAt: FieldValue.serverTimestamp()
        });
        transaction.set(userRef, {
          lastDeliveryDetails: order.customer,
          lastDeliveryDetailsUpdatedAt: FieldValue.serverTimestamp(),
          deliveryAddresses,
          deliveryAddressesUpdatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      });
    },
    async saveFailed(uid, order, payment) {
      const app = getFirebaseAdminApp();
      if (!app) throw new Error('Firebase Admin credentials are not configured.');
      const db = getFirestore(app);
      const userRef = db.collection('users').doc(uid);
      await db.runTransaction(async (transaction) => {
        transaction.set(userRef.collection('orders').doc(order.orderId), {
          ...order,
          uid,
          createdAt: new Date(order.createdAt)
        });
        transaction.set(userRef.collection('payments').doc(payment.paymentId), {
          ...payment,
          uid
        });
      });
    },
    async list(uid) {
      const app = getFirebaseAdminApp();
      if (!app) throw new Error('Firebase Admin credentials are not configured.');
      const db = getFirestore(app);
      const userRef = db.collection('users').doc(uid);
      const snapshot = await userRef.collection('orders')
        .where('paymentStatus', '==', 'paid')
        .get();
      const paidDocuments = snapshot.docs
        .sort((left, right) => {
          const getCreatedAt = (document) => {
            const value = document.data().createdAt;
            if (value && typeof value.toMillis === 'function') return value.toMillis();
            const timestamp = new Date(value).getTime();
            return Number.isFinite(timestamp) ? timestamp : 0;
          };
          return getCreatedAt(right) - getCreatedAt(left);
        })
        .slice(0, 50);
      const orders = await Promise.all(paidDocuments.map(async (document) => {
        const order = document.data();
        const paymentSnapshot = order.paymentId
          ? await userRef.collection('payments').doc(order.paymentId).get()
          : null;
        const payment = paymentSnapshot && paymentSnapshot.exists ? paymentSnapshot.data() : {};
        const orderFields = { ...order };
        const createdAt = order.createdAt;
        delete orderFields.uid;
        delete orderFields.paidAt;
        const paymentFields = { ...payment };
        const paymentDate = paymentFields.paymentDate;
        delete paymentFields.uid;
        delete paymentFields.paidAt;
        delete paymentFields.paymentDate;
        return {
          ...orderFields,
          orderId: document.id,
          createdAt: createdAt && typeof createdAt.toDate === 'function'
            ? createdAt.toDate().toISOString()
            : null,
          payment: paymentSnapshot && paymentSnapshot.exists ? {
            ...paymentFields,
            paymentDate: paymentDate && typeof paymentDate.toDate === 'function'
              ? paymentDate.toDate().toISOString()
              : null
          } : null
        };
      }));
      return orders.filter((order) => (
        order.paymentStatus === 'paid' &&
        order.payment?.status === 'captured'
      ));
    },
    async getDeliveryAddresses(uid) {
      const app = getFirebaseAdminApp();
      if (!app) throw new Error('Firebase Admin credentials are not configured.');
      const userRef = getFirestore(app).collection('users').doc(uid);
      const userSnapshot = await userRef.get();
      const userData = userSnapshot.exists ? userSnapshot.data() : {};
      if (Array.isArray(userData.deliveryAddresses) && userData.deliveryAddresses.length > 0) {
        return userData.deliveryAddresses;
      }
      if (userData.lastDeliveryDetails) return [userData.lastDeliveryDetails];

      const paidOrders = await userRef.collection('orders')
        .where('paymentStatus', '==', 'paid')
        .get();
      const latestOrder = paidOrders.docs
        .map((document) => document.data())
        .sort((left, right) => {
          const leftTime = left.createdAt && typeof left.createdAt.toMillis === 'function'
            ? left.createdAt.toMillis()
            : Number(left.createdAt) || 0;
          const rightTime = right.createdAt && typeof right.createdAt.toMillis === 'function'
            ? right.createdAt.toMillis()
            : Number(right.createdAt) || 0;
          return rightTime - leftTime;
        })[0];
      return latestOrder && latestOrder.customer ? [latestOrder.customer] : [];
    }
  };
}

function getFirebaseContactStore() {
  return {
    async save(submission) {
      const app = getFirebaseAdminApp();
      if (!app) throw new Error('Firebase Admin credentials are not configured.');
      const db = getFirestore(app);
      const document = await db.collection('contactSubmissions').add({
        ...submission,
        status: 'new',
        createdAt: FieldValue.serverTimestamp()
      });
      return document.id;
    }
  };
}

function createInvoiceNumber(orderId, createdAt) {
  const date = new Date(createdAt).toISOString().slice(0, 10).replace(/-/g, '');
  return `SF-${date}-${orderId.slice(-8).toUpperCase()}`;
}

function createPaidOrderRecords(orderId, order, payment) {
  const subtotal = order.items.reduce((total, item) => total + item.unitAmount * item.quantity, 0);
  const invoiceNumber = order.invoiceNumber || createInvoiceNumber(orderId, order.createdAt);
  const paymentDate = Number.isFinite(payment.created_at)
    ? new Date(payment.created_at * 1000)
    : new Date();
  return {
    order: {
      orderId,
      invoiceNumber,
      paymentId: payment.id,
      status: 'confirmed',
      paymentStatus: 'paid',
      amount: order.amount,
      subtotal,
      currency: order.currency,
      customer: order.customer,
      items: order.items.map((item) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        unitAmount: item.unitAmount
      })),
      createdAt: order.createdAt
    },
    payment: {
      paymentId: payment.id,
      orderId,
      amount: order.amount,
      currency: order.currency,
      status: 'captured',
      method: payment.method || 'Not provided by Razorpay',
      paymentDate,
      invoiceNumber
    }
  };
}

function requireFirebaseUser(verifyFirebaseToken) {
  return async (req, res, next) => {
    const authorization = req.get('authorization') || '';
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({ error: 'Sign in to your account before checkout.' });
    }

    try {
      const decodedToken = await verifyFirebaseToken(match[1]);
      if (!decodedToken || typeof decodedToken.uid !== 'string' || !decodedToken.uid) {
        return res.status(401).json({ error: 'Your sign-in session is invalid. Sign in again.' });
      }
      req.firebaseUser = decodedToken;
      return next();
    } catch (error) {
      if (
        error.code === 'auth/configuration-not-found' ||
        error.code === 'app/invalid-credential' ||
        error.code === 'app/no-app'
      ) {
        return res.status(503).json({ error: 'Firebase server authentication is not configured.' });
      }
      return res.status(401).json({ error: 'Your sign-in session is invalid or expired. Sign in again.' });
    }
  };
}

function getApp({
  razorpayFactory = getRazorpayClient,
  paymentConfigLoader = getFirebaseRazorpayConfiguration,
  productFetcher = fetch,
  exchangeRateFetcher = async () => {
    const response = await fetch(EXCHANGE_RATE_API, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Exchange-rate service returned ${response.status}.`);
    const data = await response.json();
    if (data.result !== 'success') throw new Error('Exchange-rate service returned an unsuccessful result.');
    return data.rates && data.rates.INR;
  },
  orderStore = getFirebaseOrderStore(),
  contactStore = getFirebaseContactStore(),
  verifyFirebaseToken = (token) => {
    const auth = getFirebaseAdminAuth();
    if (!auth) {
      const error = new Error('Firebase Admin credentials are not configured.');
      error.code = 'auth/configuration-not-found';
      throw error;
    }
    return auth.verifyIdToken(token);
  }
} = {}) {
  const app = express();
  let cachedUsdToInrRate;
  let exchangeRateFetchedAt = 0;
  let cachedRazorpayConfiguration;
  let razorpayConfigurationFetchedAt = 0;
  const getUsdToInrRate = async () => {
    if (cachedUsdToInrRate && Date.now() - exchangeRateFetchedAt < EXCHANGE_RATE_CACHE_MS) {
      return cachedUsdToInrRate;
    }
    const rate = await exchangeRateFetcher();
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('Exchange-rate service returned an invalid USD to INR rate.');
    }
    cachedUsdToInrRate = rate;
    exchangeRateFetchedAt = Date.now();
    return rate;
  };
  const getRazorpayConfiguration = async () => {
    if (
      cachedRazorpayConfiguration &&
      Date.now() - razorpayConfigurationFetchedAt < RAZORPAY_CONFIG_CACHE_MS
    ) {
      return cachedRazorpayConfiguration;
    }

    const configuration = await paymentConfigLoader();
    if (!isValidRazorpayConfiguration(configuration)) {
      throw new Error('Razorpay configuration is missing or invalid.');
    }
    cachedRazorpayConfiguration = configuration;
    razorpayConfigurationFetchedAt = Date.now();
    return configuration;
  };
  const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .map((origin) => origin.replace(/\/$/, ''))
    .filter(Boolean);

  app.use(cors({
    origin(origin, callback) {
      const normalizedOrigin = origin && origin.replace(/\/$/, '');
      const isLocalDevelopmentOrigin = process.env.NODE_ENV !== 'production' &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin || '');
      if (!origin || allowedOrigins.includes(normalizedOrigin) || isLocalDevelopmentOrigin) {
        return callback(null, true);
      }
      return callback(new Error('Origin is not allowed by CORS.'));
    }
  }));

  app.post('/api/webhooks/razorpay', express.raw({ type: 'application/json', limit: '100kb' }), async (req, res) => {
    let configuration;
    try {
      configuration = await getRazorpayConfiguration();
    } catch (error) {
      console.error('Unable to load Razorpay webhook configuration:', error.message);
      return res.status(503).json({ error: 'Payment webhooks are not configured in Firebase.' });
    }
    const webhookSecret = configuration.webhookSecret;
    const signature = req.get('x-razorpay-signature');
    const eventId = req.get('x-razorpay-event-id');

    if (!webhookSecret) {
      return res.status(503).json({ error: 'Payment webhooks are not configured.' });
    }
    if (!Buffer.isBuffer(req.body) || !signature || !eventId) {
      return res.status(400).json({ error: 'Invalid webhook request.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body)
      .digest('hex');
    if (!safeCompareHex(expectedSignature, signature)) {
      return res.status(400).json({ error: 'Invalid webhook signature.' });
    }
    if (processedWebhookEvents.has(eventId)) return res.status(200).json({ received: true });

    let event;
    try {
      event = JSON.parse(req.body.toString('utf8'));
    } catch (error) {
      return res.status(400).json({ error: 'Invalid webhook payload.' });
    }

    const payment = event.payload && event.payload.payment && event.payload.payment.entity;
    const orderId = payment && payment.order_id;
    const order = orderId && pendingOrders.get(orderId);
    if (order && payment.amount === order.amount && payment.currency === order.currency) {
      if (event.event === 'payment.captured' || event.event === 'order.paid') {
        order.status = 'paid';
        order.paymentId = payment.id;
        try {
          const records = createPaidOrderRecords(orderId, order, payment);
          await orderStore.save(order.userId, records.order, records.payment);
        } catch (error) {
          console.error('Unable to save webhook-confirmed order:', error.message);
          return res.status(503).json({ error: 'Order records could not be saved. Please retry the webhook.' });
        }
      } else if (event.event === 'payment.failed' && order.status !== 'paid') {
        order.status = 'failed';
        order.paymentId = payment.id;
        try {
          await orderStore.saveFailed(order.userId, {
            orderId,
            status: 'payment_failed',
            paymentStatus: 'failed',
            amount: order.amount,
            subtotal: order.amount,
            currency: order.currency,
            customer: order.customer,
            items: order.items,
            createdAt: order.createdAt,
            paymentId: payment.id
          }, {
            paymentId: payment.id,
            orderId,
            amount: order.amount,
            currency: order.currency,
            status: 'failed',
            method: payment.method || 'Not provided by Razorpay',
            paymentDate: Number.isFinite(payment.created_at)
              ? new Date(payment.created_at * 1000)
              : new Date()
          });
        } catch (error) {
          console.error('Unable to save failed payment record:', error.message);
          return res.status(503).json({ error: 'Payment status could not be saved. Please retry the webhook.' });
        }
      }
    }

    processedWebhookEvents.add(eventId);
    return res.status(200).json({ received: true });
  });

  app.use(express.json({ limit: '20kb' }));

  app.post('/api/contact', async (req, res) => {
    const { name, email, message } = req.body || {};
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    const trimmedMessage = typeof message === 'string' ? message.trim() : '';

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({ error: 'Enter a name between 2 and 100 characters.' });
    }
    if (
      trimmedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
    ) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (trimmedMessage.length < 10 || trimmedMessage.length > 5000) {
      return res.status(400).json({ error: 'Enter a message between 10 and 5000 characters.' });
    }

    try {
      const submissionId = await contactStore.save({
        name: trimmedName,
        email: trimmedEmail,
        message: trimmedMessage
      });
      return res.status(201).json({ message: 'Your message has been received.', submissionId });
    } catch (error) {
      console.error('Unable to save contact submission:', error.message);
      return res.status(503).json({ error: 'Your message could not be saved right now. Please try again.' });
    }
  });

  app.get('/api/health', async (req, res) => {
    let paymentConfiguration = null;
    try {
      paymentConfiguration = await getRazorpayConfiguration();
    } catch (error) {
      console.error('Unable to load Razorpay configuration:', error.message);
    }
    const paymentsConfigured = Boolean(paymentConfiguration);
    const authConfigured = firebaseAdminCredentialsConfigured();
    const ready = paymentsConfigured && authConfigured;
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'configuration_required',
      paymentsConfigured,
      authConfigured,
      mode: paymentConfiguration && paymentConfiguration.keyId.startsWith('rzp_live_')
        ? 'live'
        : 'test',
      currency: CURRENCY
    });
  });

  app.get('/api/pricing', async (req, res) => {
    try {
      const usdToInrRate = await getUsdToInrRate();
      return res.status(200).json({ baseCurrency: 'USD', currency: CURRENCY, usdToInrRate });
    } catch (error) {
      console.error('Unable to load USD to INR exchange rate:', error.message);
      return res.status(503).json({ error: 'Prices are temporarily unavailable because the USD to INR rate could not be loaded.' });
    }
  });

  app.get('/api/orders', requireFirebaseUser(verifyFirebaseToken), async (req, res) => {
    try {
      const orders = (await orderStore.list(req.firebaseUser.uid)).filter((order) => (
        order.paymentStatus === 'paid' &&
        order.payment?.status === 'captured'
      ));
      return res.status(200).json({ orders });
    } catch (error) {
      console.error('Unable to load order history:', error.message);
      return res.status(503).json({ error: 'Order history is temporarily unavailable. Please try again.' });
    }
  });

  app.get('/api/checkout/customer', requireFirebaseUser(verifyFirebaseToken), async (req, res) => {
    try {
      if (
        typeof orderStore.getDeliveryAddresses !== 'function' &&
        typeof orderStore.getLatestCustomer !== 'function'
      ) {
        throw new Error('Customer detail lookup is not supported by the order store.');
      }
      const addresses = typeof orderStore.getDeliveryAddresses === 'function'
        ? await orderStore.getDeliveryAddresses(req.firebaseUser.uid)
        : [await orderStore.getLatestCustomer(req.firebaseUser.uid)].filter(Boolean);
      return res.status(200).json({
        customer: addresses[0] || null,
        addresses
      });
    } catch (error) {
      console.error('Unable to load previous delivery details:', error.message);
      return res.status(503).json({ error: 'Saved delivery details are temporarily unavailable.' });
    }
  });

  app.post('/api/checkout/orders', requireFirebaseUser(verifyFirebaseToken), async (req, res) => {
    let paymentConfiguration;
    try {
      paymentConfiguration = await getRazorpayConfiguration();
    } catch (error) {
      console.error('Unable to load Razorpay configuration:', error.message);
      return res.status(503).json({ error: 'Razorpay credentials are unavailable from Firebase.' });
    }

    const razorpay = await razorpayFactory(paymentConfiguration);
    if (!razorpay) {
      return res.status(503).json({ error: 'Razorpay is not configured in Firebase.' });
    }

    const { items, customer } = req.body || {};
    if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
      return res.status(400).json({ error: 'Your cart is empty or contains too many different products.' });
    }
    if (!customer || typeof customer !== 'object') {
      return res.status(400).json({ error: 'Delivery details are missing. Enter a recipient name, contact email, and delivery address.' });
    }
    if (
      typeof customer.name !== 'string' ||
      customer.name.trim().length < 2 ||
      customer.name.trim().length > 100
    ) {
      return res.status(400).json({ error: 'Enter a valid delivery recipient name (2–100 characters).' });
    }
    if (
      typeof customer.email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim()) ||
      customer.email.length > 254
    ) {
      return res.status(400).json({ error: 'Enter a valid contact email address.' });
    }
    const phoneDigits = typeof customer.phone === 'string' ? customer.phone.replace(/\D/g, '') : '';
    if (
      typeof customer.phone !== 'string' ||
      !/^\+?[0-9\s()-]+$/.test(customer.phone.trim()) ||
      phoneDigits.length < 7 ||
      phoneDigits.length > 15
    ) {
      return res.status(400).json({ error: 'Enter a valid mobile number with 7–20 digits.' });
    }
    if (
      typeof customer.address !== 'string' ||
      customer.address.trim().length < 5 ||
      customer.address.trim().length > 500
    ) {
      return res.status(400).json({ error: 'Enter a delivery address between 5 and 500 characters.' });
    }
    for (const [field, label, maxLength] of [
      ['city', 'city', 100],
      ['state', 'state', 100],
      ['postalCode', 'postal/PIN code', 20],
      ['country', 'country', 100]
    ]) {
      if (typeof customer[field] !== 'string' || !customer[field].trim() || customer[field].trim().length > maxLength) {
        return res.status(400).json({ error: `Enter a valid ${label}.` });
      }
    }

    const quantities = new Map();
    for (const item of items) {
      if (!item || !Number.isInteger(item.id) || item.id < 1 ||
          !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
        return res.status(400).json({ error: 'Cart contains an invalid product or quantity.' });
      }
      quantities.set(item.id, (quantities.get(item.id) || 0) + item.quantity);
      if (quantities.get(item.id) > 10) {
        return res.status(400).json({ error: 'A product quantity cannot exceed 10.' });
      }
    }

    let serverItems;
    try {
      const usdToInrRate = await getUsdToInrRate();
      serverItems = await Promise.all([...quantities].map(async ([id, quantity]) => {
        const response = await productFetcher(`${PRODUCT_API}/${id}`, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error('Product lookup failed.');
        const product = await response.json();
        if (
          !product ||
          product.id !== id ||
          typeof product.title !== 'string' ||
          !Number.isFinite(product.price) ||
          product.price <= 0
        ) {
          throw new Error('Product data is invalid.');
        }
        return {
          id,
          title: product.title,
          quantity,
          unitAmount: Math.round(product.price * usdToInrRate * 100)
        };
      }));
    } catch (error) {
      console.error('Unable to validate checkout products:', error.message);
      return res.status(502).json({ error: 'Products could not be verified. Please try again.' });
    }

    const amount = serverItems.reduce((total, item) => total + item.unitAmount * item.quantity, 0);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: 'The cart total is invalid.' });
    }

    try {
      const order = await razorpay.orders.create({
        amount,
        currency: CURRENCY,
        receipt: `sf-${crypto.randomUUID().replace(/-/g, '')}`
      });

      const now = Date.now();
      const pendingOrder = {
        orderId: order.id,
        uid: req.firebaseUser.uid,
        status: 'pending',
        paymentStatus: 'pending',
        amount,
        subtotal: amount,
        currency: CURRENCY,
        customer: {
          name: customer.name.trim(),
          email: customer.email.trim(),
          phone: customer.phone.trim(),
          address: customer.address.trim(),
          city: customer.city.trim(),
          state: customer.state.trim(),
          postalCode: customer.postalCode.trim(),
          country: customer.country.trim()
        },
        items: serverItems,
        createdAt: now
      };
      await orderStore.savePending(req.firebaseUser.uid, pendingOrder);
      for (const [id, savedOrder] of pendingOrders) {
        if (now - savedOrder.createdAt > ORDER_TTL_MS) pendingOrders.delete(id);
      }
      if (pendingOrders.size >= MAX_PENDING_ORDERS) {
        const oldestOrderId = pendingOrders.keys().next().value;
        if (oldestOrderId) pendingOrders.delete(oldestOrderId);
      }

      pendingOrders.set(order.id, {
        amount,
        currency: CURRENCY,
        userId: req.firebaseUser.uid,
        items: serverItems,
        status: 'created',
        createdAt: now,
        customer: pendingOrder.customer
      });

      return res.status(201).json({
        keyId: paymentConfiguration.keyId,
        orderId: order.id,
        amount,
        currency: CURRENCY
      });
    } catch (error) {
      const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : null;
      const providerCode = error.error && typeof error.error.code === 'string'
        ? error.error.code
        : null;
      const networkCode = typeof error.code === 'string' ? error.code : null;
      console.error('Unable to create Razorpay order:', {
        statusCode,
        providerCode,
        networkCode
      });
      if (
        statusCode === 401 ||
        providerCode === 'AUTHENTICATION_ERROR'
      ) {
        return res.status(502).json({
          error: 'Razorpay rejected the server credentials. Check that the Key ID and Key Secret are a matching pair from Razorpay Test Mode.'
        });
      }
      if (statusCode === 400 || providerCode === 'BAD_REQUEST_ERROR') {
        return res.status(502).json({
          error: 'Razorpay rejected the order details. Check the API terminal for the provider error code.'
        });
      }
      if (statusCode === 429) {
        return res.status(502).json({
          error: 'Razorpay is receiving too many requests. Wait a moment, then try again.'
        });
      }
      if (networkCode) {
        return res.status(502).json({
          error: 'The server could not connect to Razorpay. Check your internet connection and try again.'
        });
      }
      return res.status(502).json({
        error: 'Unable to start payment. Check the API terminal for the Razorpay error code.'
      });
    }
  });

  app.post('/api/checkout/verify', requireFirebaseUser(verifyFirebaseToken), async (req, res) => {
    let paymentConfiguration;
    try {
      paymentConfiguration = await getRazorpayConfiguration();
    } catch (error) {
      console.error('Unable to load Razorpay configuration:', error.message);
      return res.status(503).json({ error: 'Razorpay credentials are unavailable from Firebase.' });
    }

    const razorpay = await razorpayFactory(paymentConfiguration);
    if (!razorpay) {
      return res.status(503).json({ error: 'Razorpay is not configured in Firebase.' });
    }

    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (
      typeof orderId !== 'string' ||
      typeof paymentId !== 'string' ||
      typeof signature !== 'string'
    ) {
      return res.status(400).json({ error: 'Payment verification details are incomplete.' });
    }

    const order = pendingOrders.get(orderId);
    if (!order || Date.now() - order.createdAt > ORDER_TTL_MS) {
      pendingOrders.delete(orderId);
      return res.status(404).json({ error: 'Checkout order was not found or has expired.' });
    }
    if (order.userId !== req.firebaseUser.uid) {
      return res.status(403).json({ error: 'This checkout belongs to a different account.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', paymentConfiguration.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    if (!safeCompareHex(expectedSignature, signature)) {
      return res.status(400).json({ error: 'Payment signature verification failed.' });
    }

    try {
      let payment = await razorpay.payments.fetch(paymentId);
      if (
        payment.order_id !== orderId ||
        payment.amount !== order.amount ||
        payment.currency !== order.currency
      ) {
        return res.status(400).json({ error: 'Payment details do not match this order.' });
      }
      if (payment.status === 'authorized') {
        payment = await razorpay.payments.capture(paymentId, order.amount, order.currency);
      }
      if (payment.status !== 'captured') {
        return res.status(202).json({
          status: 'pending',
          message: 'Payment is not captured yet. Please wait for confirmation.'
        });
      }

      order.status = 'paid';
      order.paymentId = payment.id;
      const { order: orderRecord, payment: paymentRecord } = createPaidOrderRecords(orderId, order, payment);
      try {
        await orderStore.save(req.firebaseUser.uid, orderRecord, paymentRecord);
      } catch (historyError) {
        console.error('Unable to save paid order to history:', historyError.message);
        return res.status(503).json({
          error: 'Payment was captured, but order history could not be saved. Contact support before trying to pay again.'
        });
      }
      return res.status(200).json({
        status: 'paid',
        orderId,
        invoiceNumber: orderRecord.invoiceNumber,
        paymentId: payment.id,
        amount: order.amount,
        subtotal: orderRecord.subtotal,
        currency: order.currency,   
        customer: order.customer,
        items: orderRecord.items,
        createdAt: new Date(order.createdAt).toISOString(),
        payment: {
          ...paymentRecord,
          paymentDate: paymentRecord.paymentDate.toISOString()
        },
        orderStatus: orderRecord.status,
        paymentStatus: orderRecord.paymentStatus
      });
    } catch (error) {
      console.error('Unable to verify Razorpay payment:', error.message);
      return res.status(502).json({ error: 'Unable to verify payment right now. Please retry.' });
    }
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.message === 'Origin is not allowed by CORS.') {
      return res.status(403).json({ error: 'Request origin is not allowed.' });
    }
    console.error('API request failed:', error.message);
    return res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  return app;
}

if (require.main === module) {
  const app = getApp();
  app.listen(PORT, () => {
    console.log(`ShopFusion payment API listening on port ${PORT}`);
    if (!firebaseAdminCredentialsConfigured()) {
      console.warn('Firebase Admin credentials are missing. Checkout and Firebase storage features are unavailable.');
    }
  });
}

module.exports = { getApp, safeCompareHex };

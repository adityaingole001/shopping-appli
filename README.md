# ShopFusion

ShopFusion is a React shopping demo with an Express API for Razorpay Checkout. The API creates orders from server-verified product prices and verifies captured payment signatures before the UI clears the cart.

## Run locally with Razorpay test mode

1. In the Razorpay Dashboard, enable **Test Mode** and generate API keys. The server captures authorized payments after validating the Checkout signature.
2. In the same Firebase project used by the app, create exactly one document in the top-level Firestore collection `razorpay` with these fields:

   ```json
   {
     "RAZORPAY_KEY_ID": "rzp_test_your_key_id",
     "RAZORPAY_KEY_SECRET": "your_test_key_secret",
     "RAZORPAY_WEBHOOK_SECRET": "your_webhook_secret",
     "ALLOW_LIVE_PAYMENTS": false
   }
   ```

   The webhook secret is optional unless webhooks are enabled, and `ALLOW_LIVE_PAYMENTS` is an optional boolean. Keep the collection private; Firestore rules deny client access. Only the server’s Firebase Admin service account reads these values. Test keys are accepted by default; live keys require `ALLOW_LIVE_PAYMENTS` set to `true` on that document. The Razorpay Key Secret is never returned to the browser or read from environment variables.

3. Copy `server/.env.example` to `server/.env` and set `PORT`, `CLIENT_ORIGIN`, and `GOOGLE_APPLICATION_CREDENTIALS`. These are server/Firebase settings, not Razorpay keys. Remove any older Razorpay key variables from an existing `server/.env`.

4. Install dependencies if needed:

   ```bash
   npm install
   ```

5. Create a Firebase Admin service account key for the same project and save its JSON file as `server/firebase-service-account.json`. Keep it private; this path is ignored by Git.
6. Start the API and frontend together from the project directory:

   ```bash
   npm run dev
   ```

   This launches the API on port 5000 and the React app on port 3000. If you already have the React app running with `npm start`, leave it running and start only `npm run server` in a second terminal. If port 5000 is already occupied, stop the other process using it and restart the API.

7. Add a Razorpay webhook for `http://localhost:5000/api/webhooks/razorpay` when using a public tunnel. Use the same webhook secret stored in the Firestore configuration document. Localhost is not reachable by Razorpay directly.
8. Open the app, create an account or sign in, and complete a test-mode checkout with a Razorpay test payment method.

The React development server proxies `/api` requests to `http://localhost:5000`. In deployment, serve the frontend and API on the same origin or set `CLIENT_ORIGIN` to the exact frontend origin.

## Configure account sign-in

The app allows browsing without an account. Use **Sign in** or **Create account** in the navigation to open Firebase Authentication.

1. Create a Firebase project and register a **Web app** in the Firebase console.
2. In **Build → Firestore Database**, create a database.
3. In **Authentication → Sign-in method**, enable **Email/Password** and **Google**.
4. In **Authentication → Settings → Authorized domains**, add `localhost` for local development and your deployed hostname before production. Add the hostname only (no protocol, path, or port); if you open the app as `127.0.0.1`, add that hostname too.
5. Copy the project root `.env.example` to `.env.local` and fill in the Firebase Web app configuration values:

   ```env
   REACT_APP_FIREBASE_API_KEY=your_firebase_web_api_key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your-project-id
   REACT_APP_FIREBASE_APP_ID=your_firebase_web_app_id
   ```

6. Publish the project-root `firestore.rules` using the Firebase console Rules tab or Firebase CLI.
7. Restart the React development server after saving `.env.local`.

If Firebase reports **“Request origin is not allowed”**, first confirm the hostname in the browser address bar is listed under **Authentication → Settings → Authorized domains**. If it is listed already, open **Google Cloud Console → APIs & Services → Credentials**, select the Firebase Web API key, and ensure its HTTP referrer restrictions allow your current local origin (for example, `http://localhost:3000/*`) or deployed hostname. Save the settings and reload the app.

Email/password account creation, sign-in, Google sign-in, and sign-out use Firebase Auth. After a successful sign-in, the app creates or updates `users/{uid}` in Cloud Firestore with the user's UID, display name, email, photo URL, and server timestamps. The `createdAt` timestamp is preserved for existing profiles. Browsing remains available when Firebase is not configured, and the account dialog explains the missing setup. Checkout requires a signed-in user, and the API verifies the Firebase ID token with Firebase Admin before creating an order or confirming payment. Order details are stored separately from captured payment records at `users/{uid}/orders/{orderId}` and `users/{uid}/payments/{paymentId}`. The signed-in **Profile** page loads both through the authenticated API, and users can download a PDF invoice only for orders whose payment was verified as captured. Firestore rules deny client writes to order and payment records; the Admin API writes verified records using the authenticated UID.

Contact form messages are validated by the API and saved by Firebase Admin to the separate `contactSubmissions` Firestore collection; direct client reads and writes to that collection are denied by Firestore rules.

After a successful purchase, the API saves that user's delivery address and mobile number on their private Firestore profile. At checkout, signed-in users can choose from saved addresses or enter a new address; the selected details apply only to that order. The details endpoint requires Firebase authentication and only reads the current user's data.

Checkout collects recipient name and email from the signed-in profile when available, plus mobile number and complete delivery address (street, city, state, postal/PIN code, and country). The backend validates these fields and calculates the INR subtotal from its own product lookup. A paid invoice is created only after the backend validates the Razorpay signature and confirms the captured payment. Payment method and payment date are included when Razorpay provides them.

## Payment and catalog behavior

- Fake Store product prices are denominated in USD. The frontend requests the current USD-to-INR rate from the API and converts catalog prices to INR before displaying them. The server uses the same cached rate to recalculate order totals from its own product lookup and creates Razorpay orders in INR; exchange rates are cached for one hour.
- Live keys are rejected by default. Keep `ALLOW_LIVE_PAYMENTS` unset or false in the private Firestore Razorpay configuration during integration and testing; live keys require explicit opt-in after production readiness work is complete.
- Fake Store API prices are sample values, not actual retail prices. Currency conversion makes the UI and checkout totals consistent, but replace the sample catalog with your own trusted, server-managed prices before accepting real payments.
- The cart is cleared only after the backend verifies the payment signature, confirms the payment is captured, and saves the order and payment records.
- Pending checkout state is cached in memory for local development and is lost on API restart, so an in-progress checkout cannot be verified after a restart. Paid order history and payment records are stored in Firestore. Before launch, persist pending payment state and webhook processing durably; add idempotency, rate limiting, HTTPS, monitoring, and operational handling.
- Payment verification failures do not clear the cart. Check the Razorpay Dashboard and server logs before asking a customer to retry, to avoid duplicate charges.

## Other scripts

```bash
npm run build
npm test -- --watchAll=false
npm run test:server
```

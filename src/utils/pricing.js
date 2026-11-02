
const API_BASE_URL = (
  process.env.REACT_APP_API_URL || ''
).trim().replace(/\/+$/, '');

const PRICING_API_URL = (() => {
  if (process.env.NODE_ENV === 'production' && !API_BASE_URL) {
    throw new Error(
      'REACT_APP_API_URL is not configured. Please add your Cloud Run backend URL in Vercel Environment Variables.'
    );
  }

  // Production: Cloud Run backend
  // Local development: React proxy (localhost:5000)
  return API_BASE_URL
    ? `${API_BASE_URL}/api/pricing`
    : '/api/pricing';
})();

export async function fetchUsdToInrRate(signal) {
  let response;

  try {
    response = await fetch(PRICING_API_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }

    console.error('Pricing API network error:', error);

    throw new Error(
      'Unable to connect to the pricing service. Please try again later.'
    );
  }

  const responseText = await response.text();

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    const contentType =
      response.headers.get('content-type') || '';

    const looksLikeHtml =
      /text\/html/i.test(contentType) ||
      /^\s*<!doctype html/i.test(responseText) ||
      /^\s*<html/i.test(responseText);

    console.error('Invalid pricing API response:', {
      url: PRICING_API_URL,
      status: response.status,
      contentType,
      responsePreview: responseText.slice(0, 300),
    });

    if (looksLikeHtml) {
      throw new Error(
        'Pricing service returned an HTML page instead of JSON. Check your backend API URL and deployment.'
      );
    }

    throw new Error(
      `Pricing API returned invalid JSON (HTTP ${response.status}).`
    );
  }

  if (!response.ok) {
    console.error('Pricing API HTTP error:', {
      status: response.status,
      data,
    });

    throw new Error(
      data.error ||
      `Pricing request failed (HTTP ${response.status}).`
    );
  }

  if (
    data.baseCurrency !== 'USD' ||
    data.currency !== 'INR' ||
    !Number.isFinite(data.usdToInrRate) ||
    data.usdToInrRate <= 0
  ) {
    console.error('Unexpected pricing API response:', data);

    throw new Error(
      'The exchange-rate service returned an invalid USD to INR rate.'
    );
  }

  return data.usdToInrRate;
}

export function convertUsdToInr(amount, rate) {
  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    throw new Error('Invalid amount or exchange rate.');
  }

  return Math.round(amount * rate * 100) / 100;
}

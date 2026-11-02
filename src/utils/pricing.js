export async function fetchUsdToInrRate(signal) {
  const response = await fetch('/api/pricing', { signal });
  const responseText = await response.text();
  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    const contentType = response.headers.get('content-type') || '';
    const looksLikeHtml = /text\/html/i.test(contentType) || /^\s*<!doctype html|^\s*<html/i.test(responseText);

    console.error('Invalid pricing API response:', {
      status: response.status,
      contentType,
      responsePreview: responseText.slice(0, 300),
    });

    if (looksLikeHtml) {
      throw new Error(
        'Pricing service is unavailable. Please try again later.'
      );
    }

    throw new Error(
      `Exchange-rate API returned a non-JSON response (HTTP ${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      data.error || `Exchange-rate request failed (HTTP ${response.status}).`
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
  return Math.round(amount * rate * 100) / 100;
}


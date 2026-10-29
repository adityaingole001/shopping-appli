export async function fetchUsdToInrRate(signal) {
  const response = await fetch('/api/pricing', { signal });
  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`Exchange-rate service returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(data.error || `Exchange-rate request failed (HTTP ${response.status}).`);
  }
  if (
    data.baseCurrency !== 'USD' ||
    data.currency !== 'INR' ||
    !Number.isFinite(data.usdToInrRate) ||
    data.usdToInrRate <= 0
  ) {
    throw new Error('The exchange-rate service returned an invalid USD to INR rate.');
  }
  return data.usdToInrRate;
}

export function convertUsdToInr(amount, rate) {
  return Math.round(amount * rate * 100) / 100;
}

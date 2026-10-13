// Centralized shipping calculation utility.
// All arithmetic is done in integer minor units (fils / øre equivalent for BAM)
// to avoid floating-point rounding errors with decimal KM amounts.

export type ShippingCalc = {
  subtotalCents: number;  // product total in minor units
  shippingCents: number;  // 0 when free shipping applies
  isFree: boolean;
  remainingCents: number; // cents needed to reach the free-shipping threshold; 0 when isFree
  totalCents: number;     // subtotal + shipping
};

export function kmToCents(km: number): number {
  return Math.round(km * 100);
}

export function centsToKm(cents: number): number {
  return cents / 100;
}

export function calcShipping(
  subtotalKm: number,
  shippingCostKm: number,
  thresholdKm: number,
): ShippingCalc {
  const subtotalCents  = kmToCents(subtotalKm);
  const shippingCents_ = kmToCents(shippingCostKm);
  const thresholdCents = kmToCents(thresholdKm);

  const isFree        = subtotalCents >= thresholdCents;
  const shippingCents = isFree ? 0 : shippingCents_;
  const remainingCents = isFree ? 0 : Math.max(0, thresholdCents - subtotalCents);

  return {
    subtotalCents,
    shippingCents,
    isFree,
    remainingCents,
    totalCents: subtotalCents + shippingCents,
  };
}

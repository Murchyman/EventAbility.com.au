import Stripe from 'stripe';
import { loadStripe } from '@stripe/stripe-js';

// Server-side Stripe instance
export const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
});

// Client-side Stripe promise
let stripePromise: Promise<any> | null = null;
export const getStripe = () => {
  if (!stripePromise) {
    const key = import.meta.env.PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      throw new Error('Stripe publishable key is not set in environment variables');
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
};

// Calculate booking fee (15% rounded to nearest 50c)
export function calculateBookingFee(baseCost: number): number {
  const fee = baseCost * 0.15;
  return Math.round(fee / 50) * 50;
}

// Calculate total amount including booking fee
export function calculateTotalAmount(baseCost: number): number {
  return baseCost + calculateBookingFee(baseCost);
} 
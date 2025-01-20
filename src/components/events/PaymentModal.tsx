'use client';

import React, { useState, useEffect } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripe } from '../../lib/stripe';

interface PaymentFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
  amount: number;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ clientSecret, onSuccess, onCancel, amount }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    const { error: paymentError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (paymentError) {
      setError(paymentError.message ?? 'An error occurred');
      setProcessing(false);
    } else if (paymentIntent.status === 'succeeded') {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Payment Details</h2>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700"
            type="button"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="text-lg font-medium">Amount: ${(amount / 100).toFixed(2)} AUD</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PaymentElement />
          
          {error && (
            <div className="bg-red-50 border-2 border-red-500 rounded-lg p-3 text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!stripe || processing}
            className="w-full bg-gradient-to-r from-[#FF5F1F] to-[#FF8F1F] text-white py-3 px-4 rounded-lg font-bold disabled:opacity-50"
          >
            {processing ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </div>
            ) : (
              'Pay Now'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  amount: number;
}

export const PaymentModal: React.FC<ModalProps> = ({ isOpen, onClose, onSuccess, amount }) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(isOpen);

  useEffect(() => {
    setModalOpen(isOpen);
    if (isOpen && !clientSecret) {
      fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
        .then((res) => res.json())
        .then((data) => {
          setClientSecret(data.clientSecret);
        })
        .catch(console.error);
    }
  }, [isOpen, amount]);

  if (!modalOpen || !clientSecret) return null;

  return (
    <Elements stripe={getStripe()} options={{ clientSecret }}>
      <PaymentForm
        clientSecret={clientSecret}
        onSuccess={() => {
          setModalOpen(false);
          onSuccess();
        }}
        onCancel={() => {
          setModalOpen(false);
          onClose();
        }}
        amount={amount}
      />
    </Elements>
  );
};

export default PaymentModal; 
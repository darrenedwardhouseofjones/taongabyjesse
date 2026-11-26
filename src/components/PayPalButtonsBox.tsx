import React, { useEffect, useRef, useState } from 'react';
import { loadScript, type PayPalButtonsComponent } from '@paypal/paypal-js';
import { AlertCircle } from 'lucide-react';

interface PayPalButtonsBoxProps {
  clientId: string;
  createPayPalOrderId: () => Promise<string> | string;
  onApprovePayPalOrder: (paypalOrderId: string) => Promise<void>;
  onCancel?: () => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export const PayPalButtonsBox: React.FC<PayPalButtonsBoxProps> = ({
  clientId,
  createPayPalOrderId,
  onApprovePayPalOrder,
  onCancel,
  onError,
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);

  const createOrderRef = useRef(createPayPalOrderId);
  const onApproveRef = useRef(onApprovePayPalOrder);
  const onCancelRef = useRef(onCancel);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    createOrderRef.current = createPayPalOrderId;
  }, [createPayPalOrderId]);

  useEffect(() => {
    onApproveRef.current = onApprovePayPalOrder;
  }, [onApprovePayPalOrder]);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const cleanClientId = clientId.trim();
    if (!cleanClientId) {
      setLoading(false);
      setSdkError('PayPal Client ID is missing.');
      return;
    }

    let active = true;
    let buttonsInstance: PayPalButtonsComponent | null = null;
    setLoading(true);
    setSdkError(null);

    loadScript({
      clientId: cleanClientId,
      currency: 'NZD',
      intent: 'capture',
      components: 'buttons',
    })
      .then((paypal) => {
        if (!active) return;
        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = '';

        if (!paypal?.Buttons) {
          setSdkError('PayPal Checkout SDK failed to initialize.');
          setLoading(false);
          return;
        }

        const buttons = paypal.Buttons({
          style: {
            layout: 'vertical',
            color: 'gold',
            shape: 'rect',
            label: 'paypal',
          },
          createOrder: async () => {
            const orderId = await createOrderRef.current();
            if (!orderId) {
              throw new Error('Could not resolve PayPal order ID.');
            }
            return orderId;
          },
          onApprove: async (data) => {
            if (!active) return;
            setCapturing(true);
            setSdkError(null);
            try {
              await onApproveRef.current(data.orderID);
            } catch (err) {
              if (!active) return;
              const msg =
                err instanceof Error
                  ? err.message
                  : 'PayPal payment capture failed. Please try again.';
              setSdkError(msg);
              onErrorRef.current?.(msg);
            } finally {
              if (active) setCapturing(false);
            }
          },
          onCancel: () => {
            if (!active) return;
            onCancelRef.current?.();
          },
          onError: (err) => {
            if (!active) return;
            const msg =
              err instanceof Error
                ? err.message
                : 'PayPal encountered an error loading payment options.';
            setSdkError(msg);
            onErrorRef.current?.(msg);
          },
        });

        buttonsInstance = buttons;

        if (!buttons.isEligible()) {
          setSdkError('PayPal Checkout buttons are not eligible in this browser.');
          setLoading(false);
          return;
        }

        return buttons.render(container).then(() => {
          if (active) setLoading(false);
        });
      })
      .catch((err) => {
        if (!active) return;
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to load PayPal JavaScript SDK. Check your Client ID and network.';
        setSdkError(msg);
        setLoading(false);
        onErrorRef.current?.(msg);
      });

    return () => {
      active = false;
      if (buttonsInstance) {
        try {
          void buttonsInstance.close();
        } catch {
          // Ignore close errors during unmount
        }
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [clientId]);

  return (
    <div className="space-y-3">
      {loading && !sdkError && (
        <div className="p-4 rounded-xl border border-[#E8E2D6] bg-[#FAF9F6] flex items-center justify-center gap-2 text-xs text-[#526058]">
          <div className="w-4 h-4 border-2 border-[#1B382B] border-t-transparent rounded-full animate-spin" />
          <span>Loading PayPal Checkout buttons...</span>
        </div>
      )}

      {capturing && (
        <div className="p-3.5 rounded-xl border border-[#2D5A46]/30 bg-[#F7F9F8] flex items-center justify-center gap-2 text-xs font-semibold text-[#1B382B]">
          <div className="w-4 h-4 border-2 border-[#1B382B] border-t-transparent rounded-full animate-spin" />
          <span>Capturing PayPal payment &amp; verifying stone stock...</span>
        </div>
      )}

      {sdkError && (
        <div className="p-3 rounded-xl bg-[#A63A2A]/10 border border-[#A63A2A]/30 text-[#A63A2A] flex items-start gap-2 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{sdkError}</span>
        </div>
      )}

      <div
        ref={containerRef}
        className={disabled || capturing ? 'pointer-events-none opacity-60' : ''}
      />
    </div>
  );
};

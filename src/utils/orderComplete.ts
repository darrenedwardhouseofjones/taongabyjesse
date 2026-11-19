import { useCallback, useState } from 'react';
import type { Order, OrderEmailLog } from '../types';
import { apiFetch } from './api';

export interface OrderCompleteEmailResult {
  emailLog: OrderEmailLog;
  alreadySent: boolean;
}

/**
 * Helper triggered during the OrderComplete process to dispatch an automated
 * order confirmation email to the customer's registered profile email.
 */
export async function triggerOrderCompleteConfirmationEmail(
  order: Order
): Promise<OrderCompleteEmailResult | null> {
  try {
    return await apiFetch<OrderCompleteEmailResult>(
      `/api/orders/${encodeURIComponent(order.id)}/order-complete`,
      {
        method: 'POST',
        body: JSON.stringify({
          customerEmail: order.customerEmail,
        }),
      }
    );
  } catch {
    return null;
  }
}

/**
 * React hook encapsulating the OrderComplete confirmation email trigger and status state.
 */
export function useOrderCompleteEmailHook() {
  const [confirmationEmailLog, setConfirmationEmailLog] = useState<OrderEmailLog | null>(null);
  const [sendingConfirmationEmail, setSendingConfirmationEmail] = useState(false);

  const runOrderCompleteHook = useCallback(async (confirmedOrder: Order) => {
    setSendingConfirmationEmail(true);
    try {
      const result = await triggerOrderCompleteConfirmationEmail(confirmedOrder);
      if (result?.emailLog) {
        setConfirmationEmailLog(result.emailLog);
      }
      return result;
    } finally {
      setSendingConfirmationEmail(false);
    }
  }, []);

  const resetConfirmationEmailLog = useCallback(() => {
    setConfirmationEmailLog(null);
  }, []);

  return {
    confirmationEmailLog,
    sendingConfirmationEmail,
    runOrderCompleteHook,
    resetConfirmationEmailLog,
  };
}

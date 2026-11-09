
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type OrderItem = {
  product_name: string;
  colour: string;
  size: string;
  quantity: number;
};

type Order = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: any;
  total_cents: number;
  shipping_cents: number;
  payment_status: string;
  fulfilment_status: string;
  confirmation_email_status?: string;
  admin_email_status?: string;
  order_items: OrderItem[];
};

const statuses = [
  'unfulfilled',
  'printing',
  'ready',
  'dispatched',
  'completed'
];

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState('');
  const [verifying, setVerifying] = useState('');

  async function request(
    method: 'GET' | 'PATCH' | 'POST',
    body?: any,
    path = '/api/admin/orders'
  ) {
    if (!supabase) throw Error('Supabase unavailable.');

    const { data: { session } } =
      await supabase.auth.getSession();

    if (!session) throw Error('Please sign in again.');

    const res = await fetch(path, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw Error(result.error || result.message || 'Request failed');
    }

    return result;
  }

  async function refresh() {
    setBusy(true);
    try {
      const result = await request('GET');
      setOrders(result.orders || []);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function change(id: string, status: string) {
    setBusy(true);
    try {
      await request('PATCH', { id, status });
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyPayment(order: Order) {
    if (order.payment_status === 'paid') return;

    setVerifying(order.id);
    setError('');
    setMessage('');

    try {
      const result = await request(
        'POST',
        { orderId: order.id },
        '/api/admin/verify-payment'
      );

      if (result.paid === true) {
        await refresh();
        setMessage(
          `Order #${order.id.slice(0, 8).toUpperCase()}: ` +
          'Payment verified. Email controls are now unlocked.'
        );
      } else {
        setError(
          result.message ||
          'Yoco has not confirmed this payment.'
        );
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setVerifying('');
    }
  }

  async function resend(
    order: Order,
    recipient: 'customer' | 'admin'
  ) {
    if (order.payment_status !== 'paid') {
      setError(
        'Payment must be verified before sending a paid confirmation.'
      );
      return;
    }

    const label =
      recipient === 'customer' ? 'customer' : 'shop admin';

    if (!window.confirm(
      `Send another order confirmation to the ${label}?`
    )) return;

    setSending(`${order.id}-${recipient}`);
    setError('');
    setMessage('');

    try {
      const result = await request(
        'POST',
        { id: order.id, recipient },
        '/api/admin/resend-email'
      );

      setMessage(result.message || 'Email sent successfully.');
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending('');
    }
  }

  return (
    <section className="admin-form" style={{ marginBottom: 32 }}>
      <h2>ORDERS / PRINT QUEUE</h2>

      <p>
        View orders, payment status, production progress
        and resend confirmations for verified payments.
      </p>

      <button
        className="cta full"
        disabled={busy || !!verifying || !!sending}
        onClick={refresh}
      >
        {busy ? 'REFRESHING…' : 'REFRESH ORDERS'}
      </button>

      {error && <p className="notice">{error}</p>}
      {message && <p className="notice">{message}</p>}

      {!busy && orders.length === 0 && (
        <p>No orders yet.</p>
      )}

      {orders.map(o => (
        <article
          key={o.id}
          style={{
            padding: '20px 0',
            borderBottom: '1px solid #999'
          }}
        >
          <strong>
            #{o.id.slice(0, 8).toUpperCase()}
            {' — '}
            R {(o.total_cents / 100).toFixed(2)}
          </strong>

          <p>
            {new Date(o.created_at).toLocaleString('en-ZA')}
          </p>

          <p>
            <strong>
              PAYMENT: {o.payment_status.toUpperCase()}
            </strong>
          </p>

          {o.payment_status !== 'paid' && (
            <div style={{
              padding: 16,
              background: '#e8e1d7',
              marginTop: 14,
              marginBottom: 18
            }}>
              <strong>PAYMENT VERIFICATION</strong>

              <p style={{ fontSize: 13 }}>
                Check this order directly with Yoco.
                The order will only be marked paid if
                Yoco confirms the payment.
              </p>

              <button
                className="cta full"
                disabled={busy || !!verifying || !!sending}
                onClick={() => verifyPayment(o)}
              >
                {verifying === o.id
                  ? 'VERIFYING WITH YOCO…'
                  : 'VERIFY PAYMENT WITH YOCO'}
              </button>
            </div>
          )}

          <p>
            <strong>Customer:</strong> {o.customer_name}
            <br />
            {o.customer_email}
            <br />
            {o.customer_phone}
          </p>

          <p>
            <strong>Delivery:</strong>
            <br />
            {typeof o.delivery_address === 'object'
              ? o.delivery_address?.address
              : String(o.delivery_address || '')}
          </p>

          <strong>Items:</strong>

          {(o.order_items || []).map((item, i) => (
            <p key={i}>
              {item.quantity} × {item.product_name}
              {' — '}
              {item.colour} / {item.size}
            </p>
          ))}

          <div style={{
            padding: 16,
            background: '#e8e1d7',
            marginTop: 18,
            marginBottom: 18
          }}>
            <strong>EMAIL CONTROLS</strong>

            <p>
              Customer: {o.confirmation_email_status || 'pending'}
              <br />
              Admin: {o.admin_email_status || 'pending'}
            </p>

            <button
              className="cta full"
              disabled={
                busy ||
                !!sending ||
                !!verifying ||
                o.payment_status !== 'paid'
              }
              onClick={() => resend(o, 'customer')}
              style={{ marginBottom: 10 }}
            >
              {sending === `${o.id}-customer`
                ? 'SENDING…'
                : 'RESEND CUSTOMER EMAIL'}
            </button>

            <button
              className="cta full"
              disabled={
                busy ||
                !!sending ||
                !!verifying ||
                o.payment_status !== 'paid'
              }
              onClick={() => resend(o, 'admin')}
            >
              {sending === `${o.id}-admin`
                ? 'SENDING…'
                : 'RESEND ADMIN EMAIL'}
            </button>

            {o.payment_status !== 'paid' && (
              <p style={{ fontSize: 12 }}>
                Email sending unlocks after payment verification.
              </p>
            )}
          </div>

          <label>
            PRODUCTION STATUS
            <select
              value={o.fulfilment_status || 'unfulfilled'}
              disabled={
                busy ||
                !!sending ||
                !!verifying ||
                o.payment_status !== 'paid'
              }
              onChange={e => change(o.id, e.target.value)}
            >
              {statuses.map(s => (
                <option value={s} key={s}>
                  {s === 'unfulfilled'
                    ? 'Awaiting printing'
                    : s.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        </article>
      ))}
    </section>
  );
}

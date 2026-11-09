
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type OrderItem = {
  product_name: string;
  colour: string;
  size: string;
  quantity: number;
  unit_price_cents: number;
};

type Order = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: any;
  subtotal_cents: number;
  discount_cents: number;
  shipping_cents: number;
  total_cents: number;
  coupon_code: string | null;
  payment_status: string;
  payment_reference: string | null;
  payment_mode: string;
  fulfilment_status: string;
  confirmation_email_status: string | null;
  admin_email_status: string | null;
  order_items: OrderItem[];
};

const statuses = [
  'unfulfilled',
  'printing',
  'ready',
  'dispatched',
  'completed'
];

const money = (cents: number) =>
  `R ${(Number(cents || 0) / 100).toFixed(2)}`;

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');

  async function request(
    method: 'GET' | 'PATCH',
    body?: any
  ) {
    if (!supabase) throw Error('Supabase is unavailable.');

    const { data: { session } } =
      await supabase.auth.getSession();

    if (!session) throw Error('Please sign in again.');

    const response = await fetch('/api/admin/orders', {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });

    const result = await response.json();

    if (!response.ok) {
      throw Error(result.error || 'Request failed');
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
    void refresh();
  }, []);

  async function change(id: string, status: string) {
    setBusy(true);

    try {
      await request('PATCH', { id, status });
      const result = await request('GET');
      setOrders(result.orders || []);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const paid = orders.filter(o => o.payment_status === 'paid');
  const pending = orders.filter(o => o.payment_status !== 'paid');

  const visible = orders.filter(o =>
    filter === 'all' ||
    (filter === 'paid' && o.payment_status === 'paid') ||
    (filter === 'pending' && o.payment_status !== 'paid')
  );

  return (
    <section className="admin-form" style={{ marginBottom: 32 }}>
      <h2>ORDER MANAGEMENT</h2>
      <p>All store orders, payment status, emails and print queue.</p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        marginBottom: 20
      }}>
        {[
          ['ALL', orders.length, 'all'],
          ['PAID', paid.length, 'paid'],
          ['PENDING', pending.length, 'pending']
        ].map(([label, count, value]) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => setFilter(String(value))}
            style={{
              padding: '14px 6px',
              background: filter === value ? '#171717' : '#e4ded5',
              color: filter === value ? '#fff' : '#171717',
              border: '1px solid #999',
              cursor: 'pointer'
            }}
          >
            <strong>{count}</strong>
            <div style={{ fontSize: 11 }}>{label}</div>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="cta full"
        disabled={busy}
        onClick={refresh}
      >
        {busy ? 'LOADING…' : 'REFRESH ORDERS'}
      </button>

      {error && <p className="notice">{error}</p>}

      {!busy && visible.length === 0 &&
        <p>No orders in this category.</p>}

      {visible.map(order => {
        const isPaid = order.payment_status === 'paid';

        const address =
          typeof order.delivery_address === 'string'
            ? order.delivery_address
            : order.delivery_address?.address || '';

        return (
          <article
            key={order.id}
            style={{
              padding: '22px 0',
              borderBottom: '1px solid #aaa',
              overflowWrap: 'anywhere'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'flex-start'
            }}>
              <strong>
                #{order.id.slice(0, 8).toUpperCase()}
              </strong>
              <strong>{money(order.total_cents)}</strong>
            </div>

            <p style={{ fontSize: 12 }}>
              {new Date(order.created_at).toLocaleString('en-ZA')}
            </p>

            <p>
              <strong>PAYMENT: </strong>
              <span style={{
                fontWeight: 700,
                color: isPaid ? '#21713b' : '#a05217'
              }}>
                {order.payment_status.toUpperCase()}
              </span>
            </p>

            <p>
              <strong>Customer:</strong> {order.customer_name}
              <br />
              {order.customer_email}
              <br />
              {order.customer_phone}
            </p>

            <p>
              <strong>Delivery:</strong>
              <br />
              {address}
            </p>

            <p>
              <strong>Items:</strong>
            </p>

            {(order.order_items || []).map((item, index) => (
              <p key={index}>
                {item.quantity} × {item.product_name}
                <br />
                {item.colour} / {item.size}
                {' — '}
                {money(item.unit_price_cents * item.quantity)}
              </p>
            ))}

            <p>
              <strong>Subtotal:</strong> {money(order.subtotal_cents)}
              <br />
              <strong>Discount:</strong> {money(order.discount_cents)}
              <br />
              <strong>Delivery fee:</strong> {money(order.shipping_cents)}
              <br />
              <strong>Total:</strong> {money(order.total_cents)}
            </p>

            <p style={{ fontSize: 12 }}>
              <strong>Yoco checkout:</strong>
              <br />
              {order.payment_reference || 'Not assigned'}
              <br />
              <strong>Mode:</strong> {order.payment_mode}
            </p>

            <div style={{
              background: '#e9e3da',
              padding: 14,
              margin: '14px 0'
            }}>
              <strong>EMAIL STATUS</strong>
              <p>
                Customer: {order.confirmation_email_status || 'pending'}
                <br />
                Admin: {order.admin_email_status || 'pending'}
              </p>
            </div>

            {isPaid ? (
              <label>
                PRODUCTION STATUS
                <select
                  value={order.fulfilment_status || 'unfulfilled'}
                  disabled={busy}
                  onChange={e =>
                    change(order.id, e.target.value)
                  }
                >
                  {statuses.map(status => (
                    <option key={status} value={status}>
                      {status === 'unfulfilled'
                        ? 'Awaiting printing'
                        : status.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p style={{ fontSize: 12, fontWeight: 700 }}>
                Awaiting verified Yoco payment.
                Printing and dispatch are disabled.
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}

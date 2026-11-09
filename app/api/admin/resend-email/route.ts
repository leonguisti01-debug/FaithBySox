
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { database } from '../../../../lib/server';

export const runtime = 'nodejs';

async function verifyAdmin(request: Request): Promise<boolean> {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : '';

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!token || !url || !anonKey) return false;

  const client = createClient(url, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const { data: { user }, error } = await client.auth.getUser(token);

  if (error || !user) return false;

  const { data: allowed, error: adminError } =
    await client.rpc('is_store_admin');

  return !adminError && allowed === true;
}

export async function POST(request: Request) {
  try {
    if (!(await verifyAdmin(request))) {
      return NextResponse.json(
        { error: 'Administrator access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const orderId = body?.orderId;
    const recipient = body?.recipient;

    if (
      typeof orderId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)
    ) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    if (!['customer', 'admin'].includes(recipient)) {
      return NextResponse.json(
        { error: 'Choose customer or admin' },
        { status: 400 }
      );
    }

    const db = database();

    const { data: order, error: orderError } = await db
      .from('orders')
      .select(`
        id,
        customer_name,
        customer_email,
        customer_phone,
        delivery_address,
        subtotal_cents,
        shipping_cents,
        total_cents,
        payment_status,
        order_items (
          product_name,
          colour,
          size,
          quantity,
          unit_price_cents
        )
      `)
      .eq('id', orderId)
      .eq('payment_status', 'paid')
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order is not confirmed as paid. Email not sent.' },
        { status: 409 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Resend API key is not configured' },
        { status: 500 }
      );
    }

    const money = (cents: number) =>
      `R${(Number(cents || 0) / 100).toFixed(2)}`;

    const escapeHtml = (value: unknown) =>
      String(value ?? '').replace(/[&<>"']/g, char => (
        {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        } as Record<string, string>
      )[char] || char);

    const items = order.order_items || [];

    const address =
      typeof order.delivery_address === 'string'
        ? order.delivery_address
        : typeof order.delivery_address?.address === 'string'
          ? order.delivery_address.address
          : JSON.stringify(order.delivery_address || {});

    const isCustomer = recipient === 'customer';

    if (isCustomer && !order.customer_email) {
      return NextResponse.json(
        { error: 'Customer email address missing' },
        { status: 400 }
      );
    }

    const to = isCustomer
      ? order.customer_email
      : 'orders@faithbysox.co.za';

    const subject = isCustomer
      ? `FAITH BY SOX — Order confirmation (${order.id.slice(0, 8).toUpperCase()})`
      : `FAITH BY SOX — Paid order (${order.id.slice(0, 8).toUpperCase()})`;

    const itemText = items.map(item =>
      `${item.quantity} x ${item.product_name} - ${item.colour} / ${item.size} - ${money(item.quantity * item.unit_price_cents)}`
    ).join('\n');

    const text = [
      'FAITH BY SOX',
      '',
      isCustomer
        ? `Hi ${order.customer_name}, thank you for your order.`
        : 'PAID ORDER - ADMIN COPY',
      '',
      'Payment confirmed.',
      `Order: ${order.id}`,
      '',
      itemText,
      '',
      `Subtotal: ${money(order.subtotal_cents)}`,
      `Delivery: ${money(order.shipping_cents)}`,
      `Total paid: ${money(order.total_cents)}`,
      '',
      `Customer: ${order.customer_name}`,
      `Email: ${order.customer_email}`,
      `Phone: ${order.customer_phone || ''}`,
      '',
      'Delivery address:',
      address,
      '',
      'Your items are printed to order.',
      '',
      'FAITH BY SOX'
    ].join('\n');

    const html = `
      <!doctype html>
      <html>
      <body style="margin:0;background:#111;font-family:Arial,sans-serif">
        <div style="max-width:600px;margin:auto;background:#fff;padding:30px;color:#222">
          <h1 style="color:#a88440">FAITH BY SOX</h1>
          <h2>${isCustomer ? 'Order confirmation' : 'Paid order - Admin copy'}</h2>
          <p><strong>Payment confirmed</strong></p>
          <p>Order: ${escapeHtml(order.id)}</p>
          <p>Customer: ${escapeHtml(order.customer_name)}</p>
          <p>Email: ${escapeHtml(order.customer_email)}</p>
          <p>Phone: ${escapeHtml(order.customer_phone)}</p>
          <hr/>
          ${items.map(item => `
            <p>
              ${Number(item.quantity)} × ${escapeHtml(item.product_name)}
              <br/>
              ${escapeHtml(item.colour)} / ${escapeHtml(item.size)}
              <br/>
              ${money(item.quantity * item.unit_price_cents)}
            </p>
          `).join('')}
          <hr/>
          <p>Subtotal: ${money(order.subtotal_cents)}</p>
          <p>Delivery: ${money(order.shipping_cents)}</p>
          <h3>Total paid: ${money(order.total_cents)}</h3>
          <p><strong>Delivery address</strong></p>
          <p>${escapeHtml(address).replace(/\n/g, '<br>')}</p>
          <p>Printed to order.</p>
          <p>FAITH BY SOX</p>
        </div>
      </body>
      </html>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `faithbysox-manual-${recipient}-${order.id}-${crypto.randomUUID()}`
      },
      body: JSON.stringify({
        from: 'FAITH BY SOX <orders@faithbysox.co.za>',
        to: [to],
        reply_to: 'orders@faithbysox.co.za',
        subject,
        text,
        html
      }),
      cache: 'no-store'
    });

    if (!response.ok) {
      console.error('Resend email failed', response.status, await response.text());
      return NextResponse.json(
        { error: 'Email provider rejected the request' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Email submitted to ${to}`
    });

  } catch (error) {
    console.error('Admin resend email failed', error);

    return NextResponse.json(
      { error: 'Could not resend email' },
      { status: 500 }
    );
  }
}


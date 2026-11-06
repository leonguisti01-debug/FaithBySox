
import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { database, testKey } from '../../../lib/server';
import { sendPaidOrderConfirmation } from '../../../lib/order-email';
import { sendAdminOrderNotification } from '../../../lib/admin-order-email';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    testKey();

    const secret = process.env.YOCO_WEBHOOK_SECRET;
    if (!secret?.startsWith('whsec_')) {
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 503 }
      );
    }

    const id = request.headers.get('webhook-id') || '';
    const stamp = request.headers.get('webhook-timestamp') || '';
    const signature = request.headers.get('webhook-signature') || '';
    const ts = Number(stamp);

    if (
      !id ||
      !stamp ||
      !Number.isFinite(ts) ||
      Math.abs(Date.now() / 1000 - ts) > 180
    ) {
      return NextResponse.json(
        { error: 'Invalid timestamp' },
        { status: 401 }
      );
    }

    const raw = await request.text();
    const key = Buffer.from(secret.slice(6), 'base64');

    const expected = createHmac('sha256', key)
      .update(`${id}.${stamp}.${raw}`)
      .digest();

    const valid = signature.split(' ').some((entry) => {
      const parts = entry.split(',');
      if (parts.length !== 2 || parts[0] !== 'v1') return false;

      const candidate = Buffer.from(parts[1], 'base64');
      return (
        candidate.length === expected.length &&
        timingSafeEqual(candidate, expected)
      );
    });

    if (!valid) {
      console.warn('Yoco webhook signature invalid');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event = JSON.parse(raw);

    if (
      event.type !== 'payment.succeeded' &&
      event.type !== 'payment.failed'
    ) {
      return NextResponse.json({ ok: true });
    }

    const payload = event.payload || {};
    const orderId = payload.metadata?.orderId;

    if (
      typeof orderId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)
    ) {
      console.warn('Yoco webhook missing valid order ID');
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    const db = database();

    const { data: order, error } = await db
      .from('orders')
      .select('id,total_cents,payment_status,payment_reference')
      .eq('id', orderId)
      .maybeSingle();

    if (error) throw error;

    if (!order) {
      console.warn('Yoco webhook order not found', { orderId });
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 400 }
      );
    }

    if (order.payment_status === 'paid') {
      await sendPaidOrderConfirmation(orderId);
      await sendAdminOrderNotification(orderId);
      return NextResponse.json({ ok: true });
    }

    const amount = Number(payload.amount);
    const currency = String(payload.currency || '').toUpperCase();
    const mode = String(payload.mode || '').toLowerCase();
    const paymentStatus = String(payload.status || '').toLowerCase();

    const expectedStatus =
      event.type === 'payment.succeeded' ? 'succeeded' : 'failed';

    const matches =
      Number.isSafeInteger(amount) &&
      amount === order.total_cents &&
      currency === 'ZAR' &&
      mode === 'test' &&
      paymentStatus === expectedStatus &&
      typeof order.payment_reference === 'string' &&
      order.payment_reference.startsWith('ch_');

    if (!matches) {
      console.warn('Yoco webhook payment mismatch', {
        orderId,
        amountMatches: amount === order.total_cents,
        currencyMatches: currency === 'ZAR',
        modeMatches: mode === 'test',
        statusMatches: paymentStatus === expectedStatus,
        checkoutRecorded:
          typeof order.payment_reference === 'string' &&
          order.payment_reference.startsWith('ch_')
      });

      return NextResponse.json(
        { error: 'Payment mismatch' },
        { status: 400 }
      );
    }

    const status =
      event.type === 'payment.succeeded' ? 'paid' : 'failed';

    const { error: updateError } = await db
      .from('orders')
      .update({ payment_status: status })
      .eq('id', orderId)
      .neq('payment_status', 'paid');

    if (updateError) throw updateError;

    console.info('Yoco webhook order status updated', {
      orderId,
      status
    });

    // TEST ONLY: No stock decrement or fulfilment.
    if (status === 'paid') {
      await sendPaidOrderConfirmation(orderId);
      await sendAdminOrderNotification(orderId);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}


import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { database } from '../../../lib/server';
import { sendPaidOrderConfirmation } from '../../../lib/order-email';
import { sendAdminOrderNotification } from '../../../lib/admin-order-email';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const secrets = [
      { mode: 'test', value: process.env.YOCO_WEBHOOK_SECRET },
      { mode: 'live', value: process.env.YOCO_LIVE_WEBHOOK_SECRET }
    ].filter((s): s is {mode: string; value: string} => Boolean(s.value?.startsWith('whsec_')));
    if (!secrets.length) {
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
    let verifiedMode: string | null = null;
    for (const secret of secrets) {
      const key = Buffer.from(secret.value.slice(6), 'base64');
      const expected = createHmac('sha256', key)
        .update(`${id}.${stamp}.${raw}`)
        .digest();
      const valid = signature.split(' ').some((entry) => {
        const parts = entry.split(',');
        if (parts.length !== 2 || parts[0] !== 'v1') return false;
        const candidate = Buffer.from(parts[1], 'base64');
        return candidate.length === expected.length && timingSafeEqual(candidate, expected);
      });
      if (valid) { verifiedMode = secret.mode; break; }
    }
    if (!verifiedMode) {
      console.warn('Yoco webhook signature invalid');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(raw);

    if (event.type !== 'payment.succeeded') {
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
      .select('id,total_cents,payment_status,payment_reference,payment_mode')
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

    const amount = payload.amount;
    const currency = String(payload.currency || '').toUpperCase();
    const eventMode = String(payload.mode || payload.processingMode || '').toLowerCase();
    const paymentStatus = String(payload.status || '').toLowerCase();

    // The signing secret establishes the trusted environment; the optional
    // payload mode must not contradict it. Some Yoco events omit mode.
    if (order.payment_mode !== verifiedMode ||
        (eventMode && eventMode !== verifiedMode) ||
        !Number.isSafeInteger(amount) || amount !== order.total_cents ||
        currency !== 'ZAR' ||
        (paymentStatus && paymentStatus !== ('succeeded'))) {
      console.warn('Yoco payment amount, currency, status or mode mismatch', { orderId });
      return NextResponse.json({ error: 'Payment mismatch' }, { status: 400 });
    }

    // Never credit an order until its own checkout reference is stored.
    // A webhook can arrive before the checkout API response is persisted;
    // a 503 asks Yoco to retry instead of permanently discarding the event.
    const checkoutId = order.payment_reference;
    if (typeof checkoutId !== 'string' || !/^ch_[a-zA-Z0-9_-]+$/.test(checkoutId)) {
      return NextResponse.json({ error: 'Checkout reference pending' }, { status: 503 });
    }

    const reportedCheckoutId = payload.checkoutId || payload.checkout_id ||
      payload.checkout?.id || payload.metadata?.checkoutId;
    if (reportedCheckoutId && reportedCheckoutId !== checkoutId) {
      return NextResponse.json({ error: 'Checkout mismatch' }, { status: 400 });
    }

    // Confirm that the signed event belongs to this checkout, not merely an
    // order with the same amount. Yoco can omit checkoutId from payment events.
    // Re-fetch the recorded checkout using the server-only key for its mode.
    const checkoutKey = verifiedMode === 'live'
      ? process.env.YOCO_LIVE_SECRET_KEY : process.env.YOCO_SECRET_KEY;
    if (!checkoutKey || !checkoutKey.startsWith(verifiedMode === 'live' ? 'sk_live_' : 'sk_test_')) {
      return NextResponse.json({ error: 'Checkout verification unavailable' }, { status: 503 });
    }
    const verification = await fetch(`https://payments.yoco.com/api/checkouts/${encodeURIComponent(checkoutId)}`, {
      headers: { Authorization: `Bearer ${checkoutKey}` }, cache: 'no-store'
    });
    if (!verification.ok) {
      console.error('Yoco checkout verification request failed', { orderId, status: verification.status });
      return NextResponse.json({ error: 'Checkout verification unavailable' }, { status: 503 });
    }
    const checkout = await verification.json();
    const checkoutMode = String(checkout.processingMode || checkout.mode || '').toLowerCase();
    const checkoutStatus = String(checkout.status || '').toLowerCase();
    if (checkout.id !== checkoutId || checkout.metadata?.orderId !== orderId ||
        checkout.amount !== order.total_cents ||
        String(checkout.currency || '').toUpperCase() !== 'ZAR' ||
        (checkoutMode && checkoutMode !== verifiedMode)) {
      console.warn('Yoco checkout verification mismatch', { orderId });
      return NextResponse.json({ error: 'Checkout mismatch' }, { status: 400 });
    }
    if (event.type === 'payment.succeeded' &&
        !['completed', 'succeeded', 'paid'].includes(checkoutStatus)) {
      return NextResponse.json({ error: 'Checkout payment not confirmed yet' }, { status: 503 });
    }

    if (order.payment_status === 'paid') {
      await sendPaidOrderConfirmation(orderId);
      await sendAdminOrderNotification(orderId);
      return NextResponse.json({ ok: true });
    }

    const status = 'paid';

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

    // Print on demand: no stock decrement or automatic fulfilment.
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

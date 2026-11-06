
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
    ].filter((s): s is {mode: string; value: string} => Boolean(s.value?.trim().startsWith('whsec_')));
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
      const key = Buffer.from(secret.value.trim().slice(6), 'base64');
      const expected = createHmac('sha256', key)
        .update(`${id}.${stamp}.${raw}`)
        .digest();
      // Svix signs the exact raw request body. Accept multiple v1 signatures,
      // including comma/whitespace-separated entries during key rotation.
      const candidates = [...signature.matchAll(/(?:^|[\s,])v1,([A-Za-z0-9+/_=-]+)/g)];
      const valid = candidates.some((match) => {
        const candidate = Buffer.from(match[1], 'base64url');
        return candidate.length === expected.length && timingSafeEqual(candidate, expected);
      });
      if (valid) { verifiedMode = secret.mode; break; }
    }
    if (!verifiedMode) {
      console.warn('Yoco webhook signature invalid', {
        configuredModes: secrets.map(s => s.mode),
        hasWebhookId: Boolean(id),
        hasWebhookTimestamp: Boolean(stamp),
        hasWebhookSignature: Boolean(signature),
        signatureVersions: [...signature.matchAll(/(?:^|[\s,])v([0-9]+),/g)].map(m => m[1]),
        // No secrets, signatures, or customer details are logged.
      });
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

    // Yoco signs payment.succeeded events; its status field may be absent or
    // use the provider's "successful" spelling rather than "succeeded".
    // Keep amount, currency, order and signing-environment checks mandatory.
    const amount = payload.amount;
    const currency = String(payload.currency || '').toUpperCase();
    const eventMode = String(payload.mode || payload.processingMode || '').toLowerCase();
    const paymentStatus = String(payload.status || '').toLowerCase();
    const normalizedEventMode = eventMode === 'production' ? 'live' :
      eventMode === 'sandbox' ? 'test' : eventMode;
    const validStatus = !paymentStatus ||
      ['succeeded', 'successful', 'success', 'approved', 'completed', 'paid'].includes(paymentStatus);
    const checks = {
      orderModeMatchesSignature: order.payment_mode === verifiedMode,
      eventModeMatchesSignature: !normalizedEventMode || normalizedEventMode === verifiedMode,
      amountMatches: Number.isSafeInteger(amount) && amount === order.total_cents,
      currencyMatches: currency === 'ZAR',
      statusMatches: validStatus
    };
    if (Object.values(checks).some(ok => !ok)) {
      console.warn('Yoco payment verification mismatch', { orderId, checks,
        receivedStatus: paymentStatus, receivedMode: eventMode,
        receivedCurrency: currency, receivedAmount: amount,
        expectedAmount: order.total_cents });
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

    // The verified Yoco webhook signature, matching payment mode, order ID,
    // amount and currency establish the payment. The payment's checkout ID,
    // when included, must match the checkout we created for this order.
    // Do not call an undocumented checkout retrieval endpoint here: doing so
    // can reject legitimate paid orders and prevent their fulfilment.

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

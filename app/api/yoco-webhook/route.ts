
import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { database } from '../../../lib/server';
import { sendPaidOrderConfirmation } from '../../../lib/order-email';
import { sendAdminOrderNotification } from '../../../lib/admin-order-email';

export const runtime = 'nodejs';

type PaymentMode = 'test' | 'live';

function verifySignature(
  raw: string,
  id: string,
  timestamp: string,
  header: string
): PaymentMode | null {
  const secrets: Array<[PaymentMode, string | undefined]> = [
    ['test', process.env.YOCO_WEBHOOK_SECRET],
    ['live', process.env.YOCO_LIVE_WEBHOOK_SECRET]
  ];

  const signatures = header
    .split(/\s+/)
    .filter(s => /^v1,[A-Za-z0-9+/_=-]+$/.test(s))
    .map(s => Buffer.from(s.substring(3), 'base64'));

  for (const [mode, secret] of secrets) {
    if (!secret?.trim().startsWith('whsec_')) continue;

    const key = Buffer.from(secret.trim().slice(6), 'base64');
    if (!key.length) continue;

    const expected = createHmac('sha256', key)
      .update(`${id}.${timestamp}.${raw}`, 'utf8')
      .digest();

    for (const signature of signatures) {
      if (
        signature.length === expected.length &&
        timingSafeEqual(signature, expected)
      ) {
        return mode;
      }
    }
  }

  return null;
}

async function sendEmails(orderId: string) {
  const results = await Promise.allSettled([
    sendPaidOrderConfirmation(orderId),
    sendAdminOrderNotification(orderId)
  ]);

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Order email error', result.reason);
    }
  }
}

export async function POST(request: Request) {
  try {
    const id = request.headers.get('webhook-id') || '';
    const timestamp = request.headers.get('webhook-timestamp') || '';
    const signature = request.headers.get('webhook-signature') || '';

    const ts = Number(timestamp);

    if (
      !id ||
      !/^\d+$/.test(timestamp) ||
      !Number.isSafeInteger(ts) ||
      Math.abs(Date.now() / 1000 - ts) > 180
    ) {
      return NextResponse.json(
        { error: 'Invalid timestamp' },
        { status: 401 }
      );
    }

    const raw = await request.text();
    const mode = verifySignature(raw, id, timestamp, signature);

    if (!mode) {
      console.warn('Yoco signature verification failed');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    let event: any;

    try {
      event = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    if (event?.type !== 'payment.succeeded') {
      return NextResponse.json({ ok: true });
    }

    const payload = event.payload || {};
    const metadata = payload.metadata || {};

    const orderId =
      typeof metadata.orderId === 'string'
        ? metadata.orderId
        : null;

    const checkoutId =
      metadata.checkoutId ||
      payload.checkoutId ||
      payload.checkout_id ||
      payload.checkout?.id ||
      null;

    const validOrderId =
      orderId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(orderId);

    const validCheckoutId =
      typeof checkoutId === 'string' &&
      /^ch_[A-Za-z0-9_-]+$/.test(checkoutId);

    if (!validOrderId && !validCheckoutId) {
      console.warn('Yoco event missing order reference');
      return NextResponse.json(
        { error: 'Missing order reference' },
        { status: 400 }
      );
    }

    const db = database();

    let query = db.from('orders').select(
      'id,total_cents,payment_status,payment_reference,payment_mode'
    );

    if (validCheckoutId) {
      query = query.eq('payment_reference', checkoutId);
    } else {
      query = query.eq('id', orderId!);
    }

    const { data: order, error } = await query.maybeSingle();

    if (error) throw error;

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (validOrderId && order.id !== orderId) {
      return NextResponse.json(
        { error: 'Order ID mismatch' },
        { status: 400 }
      );
    }

    if (
      validCheckoutId &&
      order.payment_reference !== checkoutId
    ) {
      return NextResponse.json(
        { error: 'Checkout mismatch' },
        { status: 400 }
      );
    }

    if (
      typeof order.payment_reference !== 'string' ||
      !/^ch_[A-Za-z0-9_-]+$/.test(order.payment_reference)
    ) {
      return NextResponse.json(
        { error: 'Checkout reference missing' },
        { status: 503 }
      );
    }

    const eventMode = String(
      payload.mode || payload.processingMode || ''
    ).toLowerCase();

    const normalizedMode =
      eventMode === 'production' ? 'live' :
      eventMode === 'sandbox' ? 'test' :
      eventMode;

    const status = String(payload.status || '').toLowerCase();

    const validStatus =
      !status ||
      ['succeeded', 'successful', 'success',
       'approved', 'completed', 'paid'].includes(status);

    const checks = {
      mode: order.payment_mode === mode,
      eventMode: !normalizedMode || normalizedMode === mode,
      amount:
        Number.isSafeInteger(payload.amount) &&
        payload.amount === order.total_cents,
      currency:
        String(payload.currency || '').toUpperCase() === 'ZAR',
      status: validStatus
    };

    if (Object.values(checks).some(v => !v)) {
      console.warn('Yoco payment mismatch', {
        orderId: order.id,
        checks
      });

      return NextResponse.json(
        { error: 'Payment verification mismatch' },
        { status: 400 }
      );
    }

    if (order.payment_status !== 'paid') {
      const { data: updated, error: updateError } = await db
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', order.id)
        .eq('payment_reference', order.payment_reference)
        .eq('payment_mode', mode)
        .neq('payment_status', 'paid')
        .select('id');

      if (updateError) throw updateError;

      if (!updated?.length) {
        const { data: current, error: readError } = await db
          .from('orders')
          .select('payment_status')
          .eq('id', order.id)
          .single();

        if (readError) throw readError;

        if (current?.payment_status !== 'paid') {
          return NextResponse.json(
            { error: 'Payment update not completed' },
            { status: 503 }
          );
        }
      }
    }

    console.info('Yoco payment confirmed', {
      orderId: order.id,
      mode
    });

    await sendEmails(order.id);

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('Yoco webhook error', error);

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

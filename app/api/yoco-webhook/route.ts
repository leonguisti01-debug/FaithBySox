
import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { database } from '../../../lib/server';

export const runtime = 'nodejs';

type PaymentMode = 'test' | 'live';

function verifySignature(
  raw: string,
  id: string,
  timestamp: string,
  signatureHeader: string
): PaymentMode | null {
  const secrets: { mode: PaymentMode; value: string | undefined }[] = [
    { mode: 'test', value: process.env.YOCO_WEBHOOK_SECRET },
    { mode: 'live', value: process.env.YOCO_LIVE_WEBHOOK_SECRET }
  ];

  const signatures = signatureHeader
    .split(/\s+/)
    .filter(Boolean)
    .map((entry) => {
      const match = /^v1,([A-Za-z0-9+/]+={0,2})$/.exec(entry);
      return match ? Buffer.from(match[1], 'base64') : null;
    })
    .filter((entry): entry is Buffer => entry !== null);

  for (const secret of secrets) {
    const value = secret.value?.trim();

    if (!value?.startsWith('whsec_')) continue;

    const key = Buffer.from(value.slice(6), 'base64');

    const expected = createHmac('sha256', key)
      .update(`${id}.${timestamp}.${raw}`, 'utf8')
      .digest();

    const valid = signatures.some(
      (candidate) =>
        candidate.length === expected.length &&
        timingSafeEqual(candidate, expected)
    );

    if (valid) return secret.mode;
  }

  return null;
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
        { error: 'Invalid webhook timestamp' },
        { status: 401 }
      );
    }

    const raw = await request.text();

    const verifiedMode = verifySignature(
      raw,
      id,
      timestamp,
      signature
    );

    if (!verifiedMode) {
      console.warn('Yoco webhook signature invalid', {
        testSecretConfigured:
          Boolean(process.env.YOCO_WEBHOOK_SECRET?.trim().startsWith('whsec_')),
        liveSecretConfigured:
          Boolean(process.env.YOCO_LIVE_WEBHOOK_SECRET?.trim().startsWith('whsec_')),
        signaturePresent: Boolean(signature)
      });

      return NextResponse.json(
        { error: 'Invalid webhook signature' },
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
    const orderId = payload.metadata?.orderId;

    if (
      typeof orderId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)
    ) {
      return NextResponse.json(
        { error: 'Invalid order ID' },
        { status: 400 }
      );
    }

    const db = database();

    const { data: order, error } = await db
      .from('orders')
      .select(
        'id,total_cents,payment_status,payment_reference,payment_mode'
      )
      .eq('id', orderId)
      .maybeSingle();

    if (error) throw error;

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 400 }
      );
    }

    const eventMode = String(
      payload.mode || payload.processingMode || ''
    ).toLowerCase();

    const normalizedMode =
      eventMode === 'production'
        ? 'live'
        : eventMode === 'sandbox'
          ? 'test'
          : eventMode;

    const paymentStatus = String(
      payload.status || ''
    ).toLowerCase();

    const validStatus =
      !paymentStatus ||
      [
        'succeeded',
        'successful',
        'success',
        'approved',
        'completed',
        'paid'
      ].includes(paymentStatus);

    const checks = {
      orderModeMatchesSignature:
        order.payment_mode === verifiedMode,

      eventModeMatchesSignature:
        !normalizedMode || normalizedMode === verifiedMode,

      amountMatches:
        Number.isSafeInteger(payload.amount) &&
        payload.amount === order.total_cents,

      currencyMatches:
        String(payload.currency || '').toUpperCase() === 'ZAR',

      statusMatches: validStatus
    };

    if (Object.values(checks).some((valid) => !valid)) {
      console.warn('Yoco payment verification mismatch', {
        orderId,
        checks,
        verifiedMode,
        orderMode: order.payment_mode,
        eventMode: normalizedMode
      });

      return NextResponse.json(
        { error: 'Payment verification mismatch' },
        { status: 400 }
      );
    }

    const checkoutId = order.payment_reference;

    if (
      typeof checkoutId !== 'string' ||
      !/^ch_[a-zA-Z0-9_-]+$/.test(checkoutId)
    ) {
      return NextResponse.json(
        { error: 'Checkout reference pending' },
        { status: 503 }
      );
    }

    const reportedCheckoutId =
      payload.checkoutId ||
      payload.checkout_id ||
      payload.checkout?.id ||
      payload.metadata?.checkoutId;

    if (
      reportedCheckoutId &&
      reportedCheckoutId !== checkoutId
    ) {
      return NextResponse.json(
        { error: 'Checkout mismatch' },
        { status: 400 }
      );
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({ ok: true });
    }

    const { error: updateError } = await db
      .from('orders')
      .update({ payment_status: 'paid' })
      .eq('id', orderId)
      .eq('payment_mode', verifiedMode)
      .neq('payment_status', 'paid');

    if (updateError) throw updateError;

    console.info('Yoco payment confirmed', {
      orderId,
      mode: verifiedMode,
      status: 'paid'
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Yoco webhook processing error', error);

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

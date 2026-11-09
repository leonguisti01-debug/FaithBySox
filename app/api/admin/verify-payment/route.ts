
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { database } from '../../../../lib/server';

export const runtime = 'nodejs';

async function verifyAdmin(request: Request): Promise<boolean> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!token || !url || !key) return false;

  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return false;

  const { data: allowed, error: rpcError } =
    await client.rpc('is_store_admin');

  return !rpcError && allowed === true;
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
    const orderId = body?.orderId || body?.id;

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

    const { data: order, error: orderError } = await db
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({
        ok: true,
        paid: true,
        message: 'Order is already marked as paid.'
      });
    }

    const checkoutId =
      order.yoco_checkout_id ||
      order.checkout_id ||
      order.payment_checkout_id;

    if (
      typeof checkoutId !== 'string' ||
      !/^[a-zA-Z0-9_-]{3,150}$/.test(checkoutId)
    ) {
      return NextResponse.json(
        { error: 'This order has no valid Yoco checkout ID.' },
        { status: 409 }
      );
    }

    const storedMode = String(
      order.yoco_mode || order.payment_mode || order.mode || 'live'
    ).toLowerCase();

    if (!['live', 'test'].includes(storedMode)) {
      return NextResponse.json(
        { error: 'Unknown payment mode' },
        { status: 409 }
      );
    }

    const secretKey = storedMode === 'live'
      ? process.env.YOCO_LIVE_SECRET_KEY
      : process.env.YOCO_TEST_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json(
        { error: `Yoco ${storedMode} secret key is not configured` },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://payments.yoco.com/api/checkouts/${encodeURIComponent(checkoutId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          Accept: 'application/json'
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(12000)
      }
    );

    if (!response.ok) {
      console.error('Yoco checkout lookup failed', {
        status: response.status,
        checkoutId
      });

      return NextResponse.json(
        { error: `Yoco could not verify this checkout (${response.status}).` },
        { status: 502 }
      );
    }

    const checkout = await response.json();

    const status = String(checkout.status || '').toLowerCase();
    const paymentStatus = String(
      checkout.payment?.status ||
      checkout.paymentStatus ||
      ''
    ).toLowerCase();

    const successful =
      status === 'completed' ||
      status === 'succeeded' ||
      status === 'successful' ||
      (
        ['paid', 'approved', 'succeeded', 'successful'].includes(paymentStatus) &&
        !['failed', 'cancelled', 'canceled', 'refunded'].includes(status)
      );

    const verified =
      checkout.id === checkoutId &&
      successful &&
      Number.isSafeInteger(checkout.amount) &&
      checkout.amount === order.total_cents &&
      String(checkout.currency || '').toUpperCase() === 'ZAR' &&
      checkout.metadata?.orderId === order.id &&
      (
        !checkout.mode ||
        String(checkout.mode).toLowerCase() === storedMode
      ) &&
      (
        !checkout.processingMode ||
        String(checkout.processingMode).toLowerCase() === storedMode
      );

    if (!verified) {
      console.warn('Manual Yoco verification did not pass', {
        orderId,
        checkoutId,
        status,
        paymentStatus,
        amountMatches: checkout.amount === order.total_cents,
        currencyMatches: checkout.currency === 'ZAR',
        orderMatches: checkout.metadata?.orderId === order.id
      });

      return NextResponse.json(
        {
          paid: false,
          message: 'Yoco has not confirmed a matching successful payment. Order remains pending.'
        },
        { status: 409 }
      );
    }

    const { data: updated, error: updateError } = await db
      .from('orders')
      .update({ payment_status: 'paid' })
      .eq('id', order.id)
      .eq('payment_status', 'pending')
      .select('id')
      .maybeSingle();

    if (updateError) throw updateError;

    if (!updated) {
      const { data: latest } = await db
        .from('orders')
        .select('payment_status')
        .eq('id', order.id)
        .single();

      return NextResponse.json({
        ok: latest?.payment_status === 'paid',
        paid: latest?.payment_status === 'paid',
        message: latest?.payment_status === 'paid'
          ? 'Payment already confirmed.'
          : 'Order status changed. Please refresh.'
      });
    }

    console.info('Payment verified directly with Yoco', {
      orderId,
      checkoutId
    });

    return NextResponse.json({
      ok: true,
      paid: true,
      message: 'Payment verified with Yoco. Order marked PAID.'
    });

  } catch (error) {
    console.error('Manual Yoco verification failed', error);

    return NextResponse.json(
      { error: 'Could not verify payment with Yoco' },
      { status: 500 }
    );
  }
}


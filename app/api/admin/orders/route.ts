
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { database } from '../../../../lib/server';

export const runtime = 'nodejs';

async function admin(request: Request) {
  const bearer = request.headers.get('authorization') || '';
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!token || !url || !anon) return false;

  const client = createClient(url, anon, {
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

  const { data: allowed, error: rpcError } =
    await client.rpc('is_store_admin');

  return !rpcError && allowed === true;
}

export async function GET(request: Request) {
  try {
    if (!(await admin(request))) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { data, error } = await database()
      .from('orders')
      .select(`
        id,
        created_at,
        customer_name,
        customer_email,
        customer_phone,
        delivery_address,
        subtotal_cents,
        discount_cents,
        shipping_cents,
        total_cents,
        coupon_code,
        payment_status,
        payment_reference,
        payment_mode,
        fulfilment_status,
        confirmation_email_status,
        admin_email_status,
        order_items(
          product_name,
          colour,
          size,
          quantity,
          unit_price_cents
        )
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    return NextResponse.json({
      orders: data || []
    });
  } catch (error) {
    console.error('Admin orders GET failed', error);
    return NextResponse.json(
      { error: 'Could not load orders' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await admin(request))) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const statuses = [
      'unfulfilled',
      'printing',
      'ready',
      'dispatched',
      'completed'
    ];

    if (
      typeof body.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id) ||
      !statuses.includes(body.status)
    ) {
      return NextResponse.json(
        { error: 'Invalid update' },
        { status: 400 }
      );
    }

    const { data, error } = await database()
      .from('orders')
      .update({
        fulfilment_status: body.status
      })
      .eq('id', body.id)
      .eq('payment_status', 'paid')
      .select('id')
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json(
        { error: 'Only verified paid orders can be processed' },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Admin order PATCH failed', error);
    return NextResponse.json(
      { error: 'Could not update order' },
      { status: 500 }
    );
  }
}

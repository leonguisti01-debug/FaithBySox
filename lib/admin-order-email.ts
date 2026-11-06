import { database } from './server';

type Item = { product_name: string; colour: string; size: string; quantity: number; unit_price_cents: number };
const money = (cents: number) => `R${(Number(cents || 0) / 100).toFixed(2)}`;
const escapeHtml = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c));

/** Independent admin notification; customer confirmations are unaffected by failures here. */
export async function sendAdminOrderNotification(orderId: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('Admin notification not configured: RESEND_API_KEY missing');
    return;
  }
  const db = database();
  const { data: claimed, error: claimError } = await db.rpc('claim_admin_order_notification', { p_order_id: orderId });
  if (claimError) {
    console.error('Admin notification claim failed: apply setup/05-admin-order-notification.sql', claimError);
    return;
  }
  if (!claimed) return;
  try {
    const { data: order, error } = await db.from('orders')
      .select('id,customer_name,customer_email,customer_phone,delivery_address,subtotal_cents,shipping_cents,total_cents,payment_status,order_items(product_name,colour,size,quantity,unit_price_cents)')
      .eq('id', orderId).eq('payment_status', 'paid').single();
    if (error || !order) throw error || new Error('Paid order not found');
    const items = (order.order_items || []) as Item[];
    const address = typeof order.delivery_address === 'string' ? order.delivery_address :
      typeof order.delivery_address?.address === 'string' ? order.delivery_address.address :
      JSON.stringify(order.delivery_address || {});
    const shortId = order.id.slice(0, 8).toUpperCase();
    const itemLines = items.map(i => `${i.product_name} | ${i.colour} | ${i.size} | Qty ${i.quantity} | ${money(i.unit_price_cents * i.quantity)}`);
    const text = [
      'NEW PAID ORDER — FAITH BY SOX', '',
      `Order number: ${order.id}`, 'Payment status: PAID', '',
      `Customer: ${order.customer_name || ''}`,
      `Email: ${order.customer_email || ''}`,
      `Phone: ${order.customer_phone || ''}`, '',
      'ITEMS', ...itemLines, '',
      `Shirts: ${money(order.subtotal_cents)}`,
      `Nationwide delivery: ${money(order.shipping_cents)}`,
      `Total paid: ${money(order.total_cents)}`, '',
      'DELIVERY ADDRESS', address, '',
      'These shirts are printed to order. Please arrange printing and fulfilment.'
    ].join('\n');
    const html = `<!doctype html><html><body style="margin:0;background:#111;font-family:Arial,sans-serif;color:#222"><div style="max-width:600px;margin:auto;background:#fff;padding:32px"><h1 style="color:#a88440">FAITH BY SOX</h1><h2>New paid order</h2><p><strong>Order:</strong> ${escapeHtml(order.id)}<br><strong>Status:</strong> PAID</p><h3>Customer</h3><p>${escapeHtml(order.customer_name)}<br>${escapeHtml(order.customer_email)}<br>${escapeHtml(order.customer_phone)}</p><h3>Items to print</h3><table style="border-collapse:collapse;width:100%">${items.map(i => `<tr><td style="padding:10px 0;border-bottom:1px solid #ddd">${escapeHtml(i.product_name)}<br><small>${escapeHtml(i.colour)} · ${escapeHtml(i.size)} · Qty ${Number(i.quantity)}</small></td><td style="text-align:right;border-bottom:1px solid #ddd">${money(i.unit_price_cents * i.quantity)}</td></tr>`).join('')}</table><p>Shirts: ${money(order.subtotal_cents)}<br>Nationwide delivery: ${money(order.shipping_cents)}<br><strong>Total paid: ${money(order.total_cents)}</strong></p><h3>Delivery address</h3><p>${escapeHtml(address).replace(/\n/g,'<br>')}</p><p>Print on demand — arrange printing and fulfilment.</p></div></body></html>`;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `faithbysox-admin-${order.id}`
      },
      body: JSON.stringify({
        from: 'FAITH BY SOX <orders@faithbysox.co.za>',
        to: ['orders@faithbysox.co.za'],
        reply_to: order.customer_email || 'orders@faithbysox.co.za',
        subject: `NEW PAID ORDER — ${shortId} — ${money(order.total_cents)}`,
        text,
        html
      }),
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Resend API error ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const { error: markError } = await db.from('orders').update({ admin_email_status: 'sent', admin_email_sent_at: new Date().toISOString() }).eq('id', orderId).eq('admin_email_status', 'sending');
    if (markError) throw markError;
    console.info('Admin order notification sent', { orderId });
  } catch (err) {
    console.error('Admin order notification failed', { orderId, error: err });
    // Retain claim until retry window expires; Resend idempotency key limits duplicates.
  }
}

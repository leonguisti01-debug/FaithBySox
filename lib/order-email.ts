import { database } from './server';

type OrderItem = { product_name: string; colour: string; size: string; quantity: number; unit_price_cents: number };
const money = (cents: number) => `R${(cents / 100).toFixed(2)}`;
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c));

/** Called only after the signed Yoco payment has passed all existing checks. */
export async function sendPaidOrderConfirmation(orderId: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('Customer confirmation not configured: RESEND_API_KEY missing');
    return;
  }
  const db = database();
  // Atomic claim prevents two concurrent webhook deliveries from sending twice.
  // A stale claim can be retried after ten minutes.
  const { data: claimed, error: claimError } = await db.rpc('claim_order_confirmation', { p_order_id: orderId });
  if (claimError) {
    console.error('Confirmation claim failed: apply setup/04-order-confirmation.sql', claimError);
    return;
  }
  if (!claimed) return;
  try {
    const { data: order, error } = await db.from('orders')
      .select('id,customer_name,customer_email,delivery_address,subtotal_cents,shipping_cents,total_cents,payment_status,order_items(product_name,colour,size,quantity,unit_price_cents)')
      .eq('id', orderId).eq('payment_status', 'paid').single();
    if (error || !order) throw error || new Error('Paid order not found');
    const items = (order.order_items || []) as OrderItem[];
    const address = typeof order.delivery_address?.address === 'string' ? order.delivery_address.address : '';
    const lines = items.map(item => `${item.product_name} | ${item.colour} | ${item.size} | Qty ${item.quantity} | ${money(item.unit_price_cents * item.quantity)}`);
    const plain = [
      `Hi ${order.customer_name},`, '',
      'Thank you for your FAITH BY SOX order. Your payment has been received.',
      'Your shirts are printed to order. We will prepare your order for dispatch.', '',
      `Order number: ${order.id}`, '', ...lines, '',
      `Shirts: ${money(order.subtotal_cents)}`,
      `Nationwide delivery: ${money(order.shipping_cents)}`,
      `Total paid: ${money(order.total_cents)}`, '',
      'Delivery address:', address, '',
      'If you need help, reply to orders@faithbysox.co.za.',
      'FAITH BY SOX'
    ].join('\n');
    const html = `<!doctype html><html><body style="margin:0;background:#111;color:#222;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;background:#fff;padding:32px"><h1 style="color:#a88440">FAITH BY SOX</h1><h2>Order confirmed</h2><p>Hi ${escapeHtml(order.customer_name)},</p><p>Thank you for your order. <strong>Your payment has been received.</strong></p><p>Your shirts are printed to order. We'll prepare them for dispatch.</p><p><strong>Order number:</strong> ${escapeHtml(order.id)}</p><table style="border-collapse:collapse;width:100%">${items.map(item => `<tr><td style="padding:10px 0;border-bottom:1px solid #ddd">${escapeHtml(item.product_name)}<br><small>${escapeHtml(item.colour)} · ${escapeHtml(item.size)} · Qty ${item.quantity}</small></td><td style="text-align:right;border-bottom:1px solid #ddd">${money(item.unit_price_cents * item.quantity)}</td></tr>`).join('')}</table><p>Shirts: ${money(order.subtotal_cents)}<br>Nationwide delivery: ${money(order.shipping_cents)}<br><strong>Total paid: ${money(order.total_cents)}</strong></p><p><strong>Delivery address</strong><br>${escapeHtml(address).replace(/\n/g,'<br>')}</p><p>Questions? Reply to this email.</p><p>FAITH BY SOX</p></div></body></html>`;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `faithbysox-confirm-${order.id}`
      },
      body: JSON.stringify({
        from: 'FAITH BY SOX <orders@faithbysox.co.za>',
        to: [order.customer_email],
        reply_to: 'orders@faithbysox.co.za',
        subject: `FAITH BY SOX — Order confirmed (${order.id.slice(0, 8).toUpperCase()})`,
        text: plain,
        html
      }),
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Resend API error ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const { error: markError } = await db.from('orders').update({ confirmation_email_status: 'sent', confirmation_email_sent_at: new Date().toISOString() }).eq('id', orderId).eq('confirmation_email_status', 'sending');
    if (markError) throw markError;
    console.info('Customer confirmation sent', { orderId });
  } catch (err) {
    console.error('Customer confirmation failed', { orderId, error: err });
    // Retain the claim until the retry window expires. The Resend idempotency
    // key also guards against duplicates during provider/network retries.
  }
}

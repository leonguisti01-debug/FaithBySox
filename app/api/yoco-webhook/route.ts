import {createHmac,timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {database,testKey} from '../../../lib/server';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  testKey();
  console.info('Yoco webhook received', {method:'POST'});
  const secret=process.env.YOCO_WEBHOOK_SECRET;
  if(!secret?.startsWith('whsec_')){console.error('Yoco webhook configuration missing');return NextResponse.json({error:'Webhook not configured'},{status:503});}
  const id=request.headers.get('webhook-id')||'';
  const stamp=request.headers.get('webhook-timestamp')||'';
  const signature=request.headers.get('webhook-signature')||'';
  const ts=Number(stamp);
  if(!id||!Number.isFinite(ts)||Math.abs(Date.now()/1000-ts)>180){console.warn('Yoco webhook timestamp/headers invalid',{hasId:!!id,hasTimestamp:!!stamp,hasSignature:!!signature});return NextResponse.json({error:'Invalid timestamp'},{status:401});}
  const raw=await request.text();
  const key=Buffer.from(secret.slice(6),'base64');
  const expected=createHmac('sha256',key).update(`${id}.${stamp}.${raw}`).digest();
  const valid=signature.split(' ').some(s=>{const parts=s.split(',');if(parts.length!==2||parts[0]!=='v1')return false;const candidate=Buffer.from(parts[1],'base64');return candidate.length===expected.length&&timingSafeEqual(candidate,expected)});
  if(!valid){console.warn('Yoco webhook signature invalid');return NextResponse.json({error:'Invalid signature'},{status:401});}
  const event=JSON.parse(raw);
  console.info('Yoco webhook verified event',{type:event.type,payloadKeys:Object.keys(event.payload||{})});
  if(event.type!=='payment.succeeded'&&event.type!=='payment.failed')return NextResponse.json({ok:true});
  const payload=event.payload||{};
  const orderId=payload.metadata?.orderId||payload.metadata?.order_id||event.metadata?.orderId;
  if(typeof orderId!=='string'||!/^[0-9a-f-]{36}$/i.test(orderId)){console.warn('Yoco webhook missing order ID');return NextResponse.json({ok:true});}
  const db=database();
  const {data:order,error}=await db.from('orders').select('id,total_cents,payment_status,payment_reference').eq('id',orderId).maybeSingle();
  if(error)throw error;
  if(!order){console.warn('Yoco webhook order not found',{orderId});return NextResponse.json({ok:true});}
  if(order.payment_status==='paid')return NextResponse.json({ok:true});
  const amount=Number(payload.amount);
  const currency=String(payload.currency||'').toUpperCase();
  // Fail closed if the event does not supply verifiable amount/currency/reference.
  if(amount!==order.total_cents||currency!=='ZAR'||(order.payment_reference&&String(payload.checkoutId||payload.checkout_id||'')!==order.payment_reference)){console.warn('Yoco webhook payment mismatch',{orderId,amountMatches:amount===order.total_cents,currencyMatches:currency==='ZAR',referenceMatches:!order.payment_reference||String(payload.checkoutId||payload.checkout_id||'')===order.payment_reference,payloadKeys:Object.keys(payload)});return NextResponse.json({error:'Payment mismatch'},{status:400});}
  const status=event.type==='payment.succeeded'?'paid':'failed';
  const {error:updateError}=await db.from('orders').update({payment_status:status}).eq('id',orderId).neq('payment_status','paid');
  if(updateError)throw updateError;
  console.info('Yoco webhook order status updated',{orderId,status});
  // TEST ONLY: no stock decrement or fulfilment. Live mode is explicitly blocked.
  return NextResponse.json({ok:true});
 }catch(error){console.error('Webhook error',error);return NextResponse.json({error:'Webhook processing failed'},{status:500});}
}

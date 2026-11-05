import {createHmac,timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {database,testKey} from '../../../lib/server';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  testKey();
  const secret=process.env.YOCO_WEBHOOK_SECRET;
  if(!secret?.startsWith('whsec_'))return NextResponse.json({error:'Webhook not configured'},{status:503});
  const id=request.headers.get('webhook-id')||'';
  const stamp=request.headers.get('webhook-timestamp')||'';
  const signature=request.headers.get('webhook-signature')||'';
  const ts=Number(stamp);
  if(!id||!Number.isFinite(ts)||Math.abs(Date.now()/1000-ts)>180)return NextResponse.json({error:'Invalid timestamp'},{status:401});
  const raw=await request.text();
  const key=Buffer.from(secret.slice(6),'base64');
  const expected=createHmac('sha256',key).update(`${id}.${stamp}.${raw}`).digest();
  const valid=signature.split(' ').some(s=>{const parts=s.split(',');if(parts.length!==2||parts[0]!=='v1')return false;const candidate=Buffer.from(parts[1],'base64');return candidate.length===expected.length&&timingSafeEqual(candidate,expected)});
  if(!valid)return NextResponse.json({error:'Invalid signature'},{status:401});
  const event=JSON.parse(raw);
  if(event.type!=='payment.succeeded'&&event.type!=='payment.failed')return NextResponse.json({ok:true});
  const payload=event.payload||{};
  const orderId=payload.metadata?.orderId||payload.metadata?.order_id||event.metadata?.orderId;
  if(typeof orderId!=='string'||!/^[0-9a-f-]{36}$/i.test(orderId))return NextResponse.json({ok:true});
  const db=database();
  const {data:order,error}=await db.from('orders').select('id,total_cents,payment_status,payment_reference').eq('id',orderId).maybeSingle();
  if(error)throw error;
  if(!order)return NextResponse.json({ok:true});
  if(order.payment_status==='paid')return NextResponse.json({ok:true});
  const amount=Number(payload.amount);
  const currency=String(payload.currency||'').toUpperCase();
  // Fail closed if the event does not supply verifiable amount/currency/reference.
  if(amount!==order.total_cents||currency!=='ZAR'||(order.payment_reference&&String(payload.checkoutId||payload.checkout_id||'')!==order.payment_reference))return NextResponse.json({error:'Payment mismatch'},{status:400});
  const status=event.type==='payment.succeeded'?'paid':'failed';
  const {error:updateError}=await db.from('orders').update({payment_status:status}).eq('id',orderId).neq('payment_status','paid');
  if(updateError)throw updateError;
  // TEST ONLY: no stock decrement or fulfilment. Live mode is explicitly blocked.
  return NextResponse.json({ok:true});
 }catch(error){console.error('Webhook error',error);return NextResponse.json({error:'Webhook processing failed'},{status:500});}
}

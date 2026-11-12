import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {database} from '../../../../lib/server';
export const runtime='nodejs';
async function authorized(request:Request){
 const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!token||!url||!anon)return false;
 const client=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await client.auth.getUser(token);
 if(error||!user)return false;
 const {data,error:rpcError}=await client.rpc('is_store_admin');
 return !rpcError&&data===true;
}
export async function GET(request:Request){
 if(!await authorized(request))return NextResponse.json({error:'Unauthorized'},{status:403});
 const {data,error}=await database().from('store_settings').select('offline').eq('id',1).single();
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({offline:data.offline});
}
export async function POST(request:Request){
 if(!await authorized(request))return NextResponse.json({error:'Unauthorized'},{status:403});
 const body=await request.json().catch(()=>null);
 if(typeof body?.offline!=='boolean')return NextResponse.json({error:'Invalid setting'},{status:400});
 const {data,error}=await database().from('store_settings').update({offline:body.offline,updated_at:new Date().toISOString()}).eq('id',1).select('offline').single();
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({offline:data.offline});
}

import {NextRequest,NextResponse} from 'next/server';
export async function proxy(request:NextRequest){
 const path=request.nextUrl.pathname;
 if(path==='/maintenance'||path.startsWith('/maintenance/')||path==='/admin'||path.startsWith('/admin/')||path==='/api'||path.startsWith('/api/')||path.startsWith('/_next/')||/\.[^/]+$/.test(path))return NextResponse.next();
 const base=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!base||!anon)return NextResponse.next();
 try{
  const r=await fetch(`${base}/rest/v1/store_settings?id=eq.1&select=offline`,{headers:{apikey:anon,Authorization:`Bearer ${anon}`},cache:'no-store'});
  if(!r.ok)return NextResponse.next();
  const settings=await r.json();
  if(settings?.[0]?.offline===true){const url=request.nextUrl.clone();url.pathname='/maintenance';return NextResponse.rewrite(url)}
 }catch(e){console.error('Store mode check failed',e)}
 return NextResponse.next();
}
export const config={matcher:['/((?!_next/static|_next/image).*)']};

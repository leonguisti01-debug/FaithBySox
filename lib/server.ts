import {createClient} from '@supabase/supabase-js';
export function database(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Server database credentials are not configured');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function testKey(){const key=process.env.YOCO_SECRET_KEY;if(!key?.startsWith('sk_test_'))throw new Error('Only Yoco TEST keys are permitted in this version');return key;}

export function checkoutCredentials(){
 const live=process.env.YOCO_LIVE_SECRET_KEY;
 if(!live?.startsWith('sk_live_'))throw new Error('Live Yoco checkout key is not configured');
 return {key:live,mode:'live' as const};
}

import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anon||!service)return NextResponse.json({error:'Supabase server credentials missing.'},{status:503});
  const bearer=request.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer '))return NextResponse.json({error:'Sign in required.'},{status:401});
  const client=createClient(url,anon);
  const {data:{user},error:userError}=await client.auth.getUser(bearer.slice(7));
  if(userError||!user)return NextResponse.json({error:'Invalid session.'},{status:401});
  // Use authenticated user's JWT for admin permission check, not anon context.
  const authed=createClient(url,anon,{global:{headers:{Authorization:bearer}}});
  const {data:isAdmin,error:roleError}=await authed.rpc('is_store_admin');
  if(roleError||isAdmin!==true)return NextResponse.json({error:'Admin access required.'},{status:403});
  const form=await request.formData();const image=form.get('image');
  if(!(image instanceof File)||!image.type.startsWith('image/')||image.size>5_000_000||image.size===0)return NextResponse.json({error:'Upload an image under 5 MB.'},{status:400});
  const ext=image.type==='image/png'?'png':image.type==='image/webp'?'webp':image.type==='image/gif'?'gif':image.type==='image/jpeg'?'jpg':null;
  if(!ext)return NextResponse.json({error:'Use JPG, PNG, WebP or GIF.'},{status:400});
  const db=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
  const bucket='product-images';
  const {data:found,error:bucketError}=await db.storage.getBucket(bucket);
  if(!found){const {error:createError}=await db.storage.createBucket(bucket,{public:true,fileSizeLimit:5_000_000,allowedMimeTypes:['image/jpeg','image/png','image/webp','image/gif']});if(createError&&!/already exists|duplicate/i.test(createError.message))return NextResponse.json({error:'Could not prepare image storage: '+createError.message},{status:500});}
  const path=`${crypto.randomUUID()}.${ext}`;
  const {error:uploadError}=await db.storage.from(bucket).upload(path,image,{contentType:image.type,upsert:false});
  if(uploadError)return NextResponse.json({error:uploadError.message},{status:500});
  return NextResponse.json({url:db.storage.from(bucket).getPublicUrl(path).data.publicUrl});
 }catch(e){console.error('Admin image upload failed',e);return NextResponse.json({error:'Photo upload failed.'},{status:500});}
}

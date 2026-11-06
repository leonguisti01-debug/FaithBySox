export type Product={id:string;name:string;verse:string;price:number;description:string;colors:string[];sizes:string[];stock:Record<string,number>;image:string;active:boolean;range:string};
export type CartLine={id:string;color:string;size:string;qty:number};
export const defaults:Product[]=[
{id:'faith-over-fear',name:'FAITH OVER FEAR',verse:'PSALM 118:6',price:299,description:'The Lord is on my side; I will not fear.',colors:['Black','White','Cream','Brown'],sizes:['XS','S','M','L','XL','2XL','3XL','4XL','5XL'],stock:{},image:'/faith-cream.webp',active:true,range:'Faith'},
{id:'forgiven',name:'FORGIVEN',verse:'PSALM 32:1',price:299,description:'Blessed is the one whose transgressions are forgiven.',colors:['Black','White','Cream','Brown'],sizes:['XS','S','M','L','XL','2XL','3XL','4XL','5XL'],stock:{},image:'/forgiven-back.webp',active:true,range:'Faith'},
{id:'glory',name:'FOR HIS GLORY',verse:'1 CORINTHIANS 10:31',price:299,description:'Whatever you do, do it all for the glory of God.',colors:['Black','White','Cream','Brown'],sizes:['XS','S','M','L','XL','2XL','3XL','4XL','5XL'],stock:{},image:'/glory-back.webp',active:true,range:'Faith'}];
export const colorHex:Record<string,string>={Black:'#171717',White:'#fff',Cream:'#eadbc4',Brown:'#68402e','Green Melange':'#a8b9a1',Terracotta:'#c66b5b',Yellow:'#f2d9a0','Grey Melange':'#d6d6d6'};
export function getProducts():Product[]{if(typeof window==='undefined')return defaults;try{const s=localStorage.getItem('fbs-products');return s?JSON.parse(s):defaults}catch{return defaults}}
export function saveProducts(v:Product[]){localStorage.setItem('fbs-products',JSON.stringify(v));window.dispatchEvent(new Event('fbs-update'))}
export async function loadProducts():Promise<Product[]>{
 const {supabase}=await import('./supabase');
 if(!supabase)return [];
 const {data,error}=await supabase.from('products').select('id,name,slug,description,collection_name,price_cents,images,active,product_variants(id,colour,size,stock_quantity)').order('created_at',{ascending:true});
 if(error)throw error;
 return (data||[]).map((p:any)=>{
  const variants=p.product_variants||[];
  const stock:Record<string,number>={};
  for(const v of variants)stock[`${v.colour}|${v.size}`]=v.stock_quantity;
  return {id:p.slug,name:p.name,verse:'',price:p.price_cents/100,description:p.description,colors:[...new Set(variants.map((v:any)=>v.colour))] as string[],sizes:[...new Set(variants.map((v:any)=>v.size))] as string[],stock,image:p.images?.[0]||'',active:p.active,range:p.collection_name==='FOR HIS GLORY'?'Faith':(p.collection_name||'Faith')};
 });
}
export function getCart():CartLine[]{if(typeof window==='undefined')return [];try{return JSON.parse(localStorage.getItem('fbs-cart')||'[]')}catch{return []}}
export function saveCart(v:CartLine[]){localStorage.setItem('fbs-cart',JSON.stringify(v));window.dispatchEvent(new Event('fbs-update'))}

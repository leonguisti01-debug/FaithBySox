import {database} from './server';
export async function storeIsOffline():Promise<boolean>{
 const {data,error}=await database().from('store_settings').select('offline').eq('id',1).single();
 if(error)throw error;
 return data?.offline===true;
}

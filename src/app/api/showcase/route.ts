import {NextResponse} from 'next/server';
import {buildManagementData} from '@/lib/pc-kpis-server';

export const runtime='nodejs';

export async function GET(){
 try{
  const data=await buildManagementData();
  return NextResponse.json(data,{headers:{
   'Cache-Control':'no-store, max-age=0',
   'X-Content-Type-Options':'nosniff',
   'X-Robots-Tag':'noindex, nofollow',
  }});
 }catch(error){
  console.error('[Showcase] Unable to build KPI dashboard',error);
  return NextResponse.json({error:'SHOWCASE_UNAVAILABLE'},{status:503,headers:{
   'Cache-Control':'no-store',
   'X-Content-Type-Options':'nosniff',
   'X-Robots-Tag':'noindex, nofollow',
  }});
 }
}

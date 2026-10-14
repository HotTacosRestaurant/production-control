import {NextRequest,NextResponse} from 'next/server';
import {requireOperationalViewer} from '@/lib/pc-server';
import {GET as getSnapshot} from '../[action]/route';

export const runtime='nodejs';
/** Restricted viewer entry point. Never exposes Management KPI data. */
export async function GET(request:NextRequest){
 try {
  await requireOperationalViewer(request);
  return getSnapshot(request,{params:Promise.resolve({action:'snapshot'})});
 } catch(error) {
  const message=error instanceof Error?error.message:'FORBIDDEN';
  return NextResponse.json({error:message},{status:message==='ADMIN_AUTH_REQUIRED'?401:403});
 }
}

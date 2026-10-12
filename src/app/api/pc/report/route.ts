import {NextRequest,NextResponse} from 'next/server';
import {getConfig} from '@/lib/pc-report-params';
import {loadReport} from '@/lib/pc-reports-server';
import {requireSuperAdmin} from '@/lib/pc-server';
export const runtime='nodejs';
export async function GET(req:NextRequest){try{await requireSuperAdmin(req);const config=getConfig(req.nextUrl.searchParams);const report=await loadReport(config);return NextResponse.json(report,{headers:{'Cache-Control':'no-store'}});}catch(e){const m=e instanceof Error?e.message:'ERROR';return NextResponse.json({error:m},{status:m.includes('AUTH')?401:m.includes('ADMIN')?403:400});}}

import {pcOperationalDate} from '@/lib/pc-date';
import {NextResponse} from 'next/server';
import {demoReport} from '@/lib/pc-reports-server';
import {addDays} from '@/lib/pc-forecast';
import type {ManagementData,ManagementSummary,TrendPoint} from '@/lib/pc-management';
export const runtime='nodejs';
/** Fully numerical demo sharing its inputs with the forecast; no private data. */
export async function GET(){
 const to=pcOperationalDate();
 const from=addDays(to,-29);
 const report=demoReport({historyFrom:from,historyTo:to,baseFrom:from,baseTo:to,siteId:'htw',productId:'protein-01',forecastDays:14,excluded:[],events:[]});
 const historical=report.scenario.historical;
 const output=report.metrics.outputKg,labor=report.metrics.laborHours,completed=report.metrics.completedBatches;
 const dailyConsumption=historical.reduce((sum,d)=>sum+(d.consumptionKg??0),0);
 const round1=(v:number)=>Math.round(v*10)/10;
 const summary:ManagementSummary={completedCountPairs:historical.length,observedCountDays:historical.length,countPairCompletionPct:100,singleCountDays:0,lateEntries:0,signerMismatches:0,countCorrections:0,activeBatches:0,completedBatches:completed,bagsProduced:round1(output/5),outputKg:output,trackedLaborHours:labor,runningTimers:0,ingredientEntries:report.metrics.ingredientEntries,estimatedConsumptionKg:round1(dailyConsumption)};
 const trend:TrendPoint[]=[];
 for(let i=0;i<4;i++){
  const records=historical.slice(i*7,i===3?undefined:i*7+7);
  const produced=records.reduce((s,d)=>s+d.productionKg,0);
  trend.push({month:`P-${3-i}`,completedBatches:records.filter(d=>d.productionKg>0).length,outputKg:round1(produced),trackedLaborHours:round1(produced*.25),completedCountPairs:records.length,singleCountDays:0});
 }
 const data:ManagementData={generatedAt:new Date().toISOString(),summary,productCatalog:[{id:'protein-01',name:'Proteína P-01 (demo)',siteIds:['htw','htl','htft']}],
  bySite:[{...summary,siteId:'htw',siteName:'Operación de demostración'}],
  byEmployee:[{employeeId:'demo',employeeName:'Equipo de cocina',trackedLaborHours:labor,batchesTouched:completed,ingredientEntries:report.metrics.ingredientEntries,runningTimers:0}],
  byProduct:[{productId:'protein-01',productName:'Proteína P-01 (demostración)',completedBatches:completed,bagsProduced:round1(output/5),outputKg:output,trackedLaborHours:labor,estimatedConsumptionKg:round1(dailyConsumption)}],trend,alerts:[]};
 return NextResponse.json(data,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}

/** Pure, testable planning engine. No database or identifying customer information. */
import {lineKg} from './pc-weights';
export type CountRecord={siteId?:unknown;operationalDate?:unknown;period?:unknown;lines?:unknown};
export type MovementRecord={siteId?:unknown;operationalDate?:unknown;productId?:unknown;movementKind?:unknown;quantityKg?:unknown};
export type BatchRecord={id?:string;siteId?:unknown;productId?:unknown;operationalDate?:unknown;status?:unknown;outputKg?:unknown;bagCount?:unknown;bagWeightKgSnapshot?:unknown;partialKg?:unknown};
export type ProductConfig={id:string;name:string;bagWeightKg:number;targetDays?:number;minDays?:number;leadDays?:number;supplierLeadDays?:number;wholeUnitRawKg?:number;expectedYieldPct?:number;primaryIngredientId?:string};
export type DateRange={from:string;to:string};
export type ScenarioConfig={siteId:string;productId:string;historyFrom:string;historyTo:string;baseFrom:string;baseTo:string;forecastDays:number;excluded:DateRange[];blockedUntil?:string;blockReason?:string;events:Array<{from:string;to:string;growthPct:number;extraKg:number;label?:string}>};
export type HistoryDay={date:string;openingKg:number|null;closingKg:number|null;productionKg:number;consumptionKg:number|null;validForAverage:boolean;excluded:boolean;extraordinaryKg:number};
export type ForecastDay={date:string;openingKg:number;closingKg:number;productionKg:number;demandKg:number;targetKg:number;minimumKg:number;event:string};
export type PlanRow={date:string;startDate:string;purchaseByDate:string;productId:string;productName:string;siteId:string;plannedKg:number;rawKg:number|null;wholeUnits:number|null;openingKg:number;afterProductionKg:number;afterConsumptionKg:number;laborHours:number|null;status:string;alert:string;requirements:Array<{name:string;quantity:number;unit:string}>};
export type ScenarioResult={historical:HistoryDay[];forecast:ForecastDay[];plan:PlanRow[];meanDailyKg:number|null;sampleDays:number;targetKg:number|null;minimumKg:number|null;alerts:string[]};
const round=(n:number)=>Math.round(n*1000)/1000;
const asNumber=(n:unknown)=>Number.isFinite(Number(n))?Number(n):0;
export function addDays(ymd:string,days:number){const d=new Date(`${ymd}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function inRange(day:string,r:DateRange){return day>=r.from&&day<=r.to;}
export function deriveDaily(counts:CountRecord[],batches:BatchRecord[],siteId:string,productId:string,movements:MovementRecord[]=[]):HistoryDay[]{
 const byDay=new Map<string,HistoryDay>();
 const ensure=(date:string):HistoryDay=>{let d=byDay.get(date);if(!d){d={date,openingKg:null,closingKg:null,productionKg:0,consumptionKg:null,validForAverage:false,excluded:false,extraordinaryKg:0};byDay.set(date,d);}return d;};
 for(const row of counts){if(row.siteId!==siteId||typeof row.operationalDate!=='string')continue;
  if(!['opening','closing'].includes(String(row.period)))continue;
  const line=(Array.isArray(row.lines)?row.lines:[]).find((v:unknown)=>v!==null&&typeof v==='object'&&(v as {productId?:unknown}).productId===productId) as {bagCount?:unknown;bagWeightKgSnapshot?:unknown;openKg?:unknown}|undefined;
  if(!line)continue;
  const d=ensure(row.operationalDate);const kg=lineKg(line);
  if(row.period==='opening')d.openingKg=kg;else d.closingKg=kg;
 }
 for(const batch of batches){if(batch.siteId!==siteId||batch.productId!==productId||batch.status!=='completed'||typeof batch.operationalDate!=='string')continue;
  const d=ensure(batch.operationalDate);
  const kg=batch.outputKg===undefined?asNumber(batch.bagCount)*asNumber(batch.bagWeightKgSnapshot)+asNumber(batch.partialKg):asNumber(batch.outputKg);
  d.productionKg=round(d.productionKg+kg);
 }
 for(const m of movements){if(m.siteId!==siteId||m.productId!==productId||typeof m.operationalDate!=='string')continue;const d=ensure(m.operationalDate);d.extraordinaryKg=round(d.extraordinaryKg+asNumber(m.quantityKg));}
 for(const d of byDay.values()){
  if(d.openingKg!==null&&d.closingKg!==null){const result=round(d.openingKg+d.productionKg-d.closingKg-d.extraordinaryKg);
   d.consumptionKg=result;d.validForAverage=result>=0;
  }
 }
 return [...byDay.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function buildScenario(days:HistoryDay[],product:ProductConfig,config:ScenarioConfig,options?:{laborHoursPerKg?:number|null;ingredientsPerKg?:Array<{name:string;quantity:number;unit:string}>}):ScenarioResult{
 const exclusions=config.excluded;
 const base=days.filter(d=>d.date>=config.baseFrom&&d.date<=config.baseTo).map(d=>({...d,excluded:exclusions.some(r=>inRange(d.date,r))}));
 const samples=base.filter(d=>d.validForAverage&&!d.excluded&&d.consumptionKg!==null);
 const mean=samples.length?round(samples.reduce((sum,d)=>sum+(d.consumptionKg??0),0)/samples.length):null;
 const historical=days.filter(d=>d.date>=config.historyFrom&&d.date<=config.historyTo).map(d=>({...d,excluded:exclusions.some(r=>inRange(d.date,r))}));
 const latest=[...days].filter(d=>d.date<=config.historyTo&&d.closingKg!==null).at(-1);
 const alerts:string[]=[];
 if(!samples.length)alerts.push('No hay días completos válidos en el periodo base. No se puede proyectar un consumo confiable.');
 if(!latest)alerts.push('Falta inventario de cierre; no se puede proyectar existencias futuras.');
 if(historical.some(d=>d.consumptionKg!==null&&!d.validForAverage))alerts.push('Se detectaron consumos negativos; revisar conteos, transferencias o ajustes.');
 if(mean===null||latest?.closingKg===null||latest===undefined)return {historical,forecast:[],plan:[],meanDailyKg:mean,sampleDays:samples.length,targetKg:null,minimumKg:null,alerts};
 const target=round(mean*(product.targetDays??10));const minimum=round(mean*(product.minDays??3));
 const forecast:ForecastDay[]=[],plan:PlanRow[]=[];
 let inventory=latest.closingKg;
 for(let i=1;i<=config.forecastDays;i++){
  const date=addDays(config.historyTo,i);
  const events=config.events.filter(e=>inRange(date,e));
  // Growth percentages combine additively against the baseline, rather than compounding duplicate events.
  const pct=events.reduce((sum,e)=>sum+e.growthPct,0);
  const demand=round(Math.max(0,mean*(1+pct/100)+events.reduce((sum,e)=>sum+e.extraKg,0)));
  let production=0;
  const start=inventory;
  let alert='';
  if(inventory-demand<minimum&&(!config.blockedUntil||date>config.blockedUntil)){
   const needed=Math.max(0,target-inventory);
   const wholeUnit=(product.wholeUnitRawKg??0)>0?product.wholeUnitRawKg??0:0;
   const expectedYield=(product.expectedYieldPct??100)/100;
   const unitOutput=wholeUnit*expectedYield;
   const units=unitOutput>0?Math.ceil(needed/unitOutput):null;
   production=units!==null?round(units*unitOutput):round(needed);
   const rawKg=units!==null?round(units*wholeUnit):null;
   if(production<=0&&inventory-demand<0)alert='Sin producción suficiente para cubrir la demanda.';
   const startDate=addDays(date,-(product.leadDays??0));const purchaseByDate=addDays(startDate,-(product.supplierLeadDays??0));
   if(startDate<=config.historyTo)alert='URGENTE: el lote debió iniciarse antes del horizonte de pronóstico.';
   if(start+production-demand<0)alert='CRÍTICO: agotamiento probable.';
   if(production>0){
    const laborRate=options?.laborHoursPerKg;
    const requirements=(options?.ingredientsPerKg??[]).map(r=>({name:r.name,unit:r.unit,quantity:round(r.quantity*production)}));
    plan.push({date,startDate,purchaseByDate,productId:product.id,productName:product.name,siteId:config.siteId,plannedKg:production,rawKg,wholeUnits:units,openingKg:start,afterProductionKg:round(start+production),afterConsumptionKg:round(start+production-demand),laborHours:typeof laborRate==='number'&&laborRate>0?round(production*laborRate):null,status:'Simulado · pendiente de aprobación',alert,requirements});
   }
  }
  if(inventory-demand<minimum&&config.blockedUntil&&date<=config.blockedUntil){alert=`Retraso por compras hasta ${config.blockedUntil}: ${config.blockReason||'sin motivo'}`;if(!alerts.some(a=>a.includes(date)))alerts.push(`${date}: ${alert}`);}
  const closing=round(inventory+production-demand);
  if(closing<0&&!alert)alerts.push(`Riesgo de agotamiento el ${date}`);
  forecast.push({date,openingKg:round(inventory),closingKg:closing,productionKg:production,demandKg:demand,targetKg:target,minimumKg:minimum,event:events.map(e=>e.label||'Evento').join(', ')});
  inventory=closing;
 }
 if(samples.length<7)alerts.push('Pronóstico preliminar: menos de 7 días válidos en el periodo de referencia.');
 return {historical,forecast,plan,meanDailyKg:mean,sampleDays:samples.length,targetKg:target,minimumKg:minimum,alerts};
}

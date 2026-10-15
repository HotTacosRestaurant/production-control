/** Read-only operational series by individual finished product. No Management KPI access. */
import {packUnitLabel} from './pc-presentation';

export type ViewProduct={id:string;name:string;kind?:string;bagWeightKg?:number|null;bagSize?:number;bagUnit?:string;targetDays?:number;minDays?:number};
export type ViewCountLine={productId:string;productName?:string;bagCount?:number;openAmount?:number|null;openKg?:number|null;bagSizeSnapshot?:number;bagUnitSnapshot?:string;bagWeightKgSnapshot?:number|null;quantityUnit?:string;totalAmount?:number;totalKg?:number|null};
export type ViewCount={id:string;operationalDate:string;period:string;lines:ViewCountLine[];startedByName?:string;signedByName?:string;isLateEntry?:boolean;capturedAt?:{_seconds?:number;seconds?:number}};
export type ViewBatch={id:string;productId:string;operationalDate:string;productName:string;status:string;bagCount?:number;outputAmount?:number|null;outputKg?:number|null;outputUnit?:string;bagUnitSnapshot?:string;bagSizeSnapshot?:number;bagWeightKgSnapshot?:number|null;createdByName?:string};
export type ViewMovement={id:string;productId:string;operationalDate:string;productName:string;movementKind:string;quantity?:number|null;unit?:string;quantityKg?:number|null};
export type ViewDay={date:string;opening:number|null;closing:number|null;production:number;extraordinary:number;consumption:number|null;validConsumption:boolean;hasProduction:boolean};
export type ViewProjection={date:string;closing:number;production:number;consumption:number};
export type ViewSeries={unit:string;unitName:string;days:ViewDay[];sampleDays:number;average:number|null;minimum:number|null;target:number|null;lastClose:{date:string;value:number}|null;projection:ViewProjection[];warnings:string[]};
const round=(v:number)=>Math.round(v*1000)/1000;
const numeric=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null;
const unitFamily=(unit:string)=>unit==='kg'||unit==='g'||unit==='lb'?'mass':unit==='l'||unit==='ml'?'volume':unit==='portion'?'portion':unit==='unit'?'unit':'unknown';
const toBase=(value:number,unit:string)=>unit==='kg'?value:unit==='g'?value/1000:unit==='lb'?value*0.45359237:unit==='ml'?value/1000:value;
const fromBase=(value:number,unit:string)=>unit==='kg'?value:unit==='g'?value*1000:unit==='lb'?value/0.45359237:unit==='ml'?value*1000:value;
/** Don't turn portions into kg, or silently combine unlike kinds. */
function convert(value:number,from:string,to:string):number|null{
 const family=unitFamily(from);
 if(family==='unknown'||family!==unitFamily(to))return null;
 return round(fromBase(toBase(value,from),to));
}
function countQuantity(line:ViewCountLine,unit:string):number|null{
 const from=line.quantityUnit??line.bagUnitSnapshot??'kg';
 const savedTotal=numeric(line.totalAmount);
 if(savedTotal!==null)return convert(savedTotal,from,unit);
 const bagSize=numeric(line.bagSizeSnapshot)??numeric(line.bagWeightKgSnapshot);
 if(bagSize!==null)return convert((numeric(line.bagCount)??0)*bagSize+(numeric(line.openAmount)??numeric(line.openKg)??0),from,unit);
 const savedKg=numeric(line.totalKg);
 return savedKg===null?null:convert(savedKg,'kg',unit);
}
function batchQuantity(batch:ViewBatch,unit:string):number|null{
 const snapshot=batch.outputUnit??batch.bagUnitSnapshot??'kg';
 if(numeric(batch.outputAmount)!==null)return convert(batch.outputAmount!,snapshot,unit);
 if(numeric(batch.outputKg)!==null)return convert(batch.outputKg!,'kg',unit);
 const weight=numeric(batch.bagSizeSnapshot)??numeric(batch.bagWeightKgSnapshot);
 return weight===null?null:convert((numeric(batch.bagCount)??0)*weight,snapshot,unit);
}
function movementQuantity(movement:ViewMovement,unit:string):number|null{
 if(numeric(movement.quantity)!==null)return convert(movement.quantity!,movement.unit??'kg',unit);
 if(numeric(movement.quantityKg)!==null)return convert(movement.quantityKg!,'kg',unit);
 return null;
}
export const shiftDay=(ymd:string,n:number)=>new Date(Date.parse(`${ymd}T12:00:00Z`)+n*86400000).toISOString().slice(0,10);
export function dailySeries(product:ViewProduct,counts:ViewCount[],batches:ViewBatch[],movements:ViewMovement[],from:string,to:string):ViewSeries{
 const unit=product.bagUnit??'kg';
 const warnings:string[]=[];
 const result:ViewDay[]=[];
 const byDate=new Map<string,ViewDay>();
 const length=Math.round((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86400000);
 for(let i=0;i<=length&&i<=90;i++){
  const date=shiftDay(from,i);
  const row:ViewDay={date,opening:null,closing:null,production:0,extraordinary:0,consumption:null,validConsumption:false,hasProduction:false};
  byDate.set(date,row);result.push(row);
 }
 let incompatible=0;
 for(const count of counts){
  const row=byDate.get(count.operationalDate);
  if(!row||!['opening','closing'].includes(count.period))continue;
  const line=count.lines?.find(x=>x.productId===product.id);
  if(!line)continue;
  const value=countQuantity(line,unit);
  if(value===null){incompatible++;continue;}
  if(count.period==='opening')row.opening=value;else row.closing=value;
 }
 for(const batch of batches){
  if(batch.productId!==product.id||batch.status!=='completed')continue;
  const row=byDate.get(batch.operationalDate);if(!row)continue;
  const value=batchQuantity(batch,unit);
  if(value===null){incompatible++;continue;}
  row.production=round(row.production+value);row.hasProduction=true;
 }
 for(const movement of movements){
  if(movement.productId!==product.id)continue;
  const row=byDate.get(movement.operationalDate);if(!row)continue;
  const value=movementQuantity(movement,unit);
  if(value===null){incompatible++;continue;}
  row.extraordinary=round(row.extraordinary+value);
 }
 for(const day of result){
  if(day.opening!==null&&day.closing!==null){
   day.consumption=round(day.opening+day.production-day.closing-day.extraordinary);
   day.validConsumption=day.consumption>=0;
  }
 }
 const valid=result.filter(d=>d.validConsumption&&d.consumption!==null);
 // Two reconciled days prevent generating confident-looking thresholds from one sample.
 const average=valid.length>=2?round(valid.reduce((sum,d)=>sum+(d.consumption??0),0)/valid.length):null;
 const minimum=average===null?null:round(average*(product.minDays??3));
 const target=average===null?null:round(average*(product.targetDays??10));
 const closeDay=[...result].reverse().find(d=>d.closing!==null);
 const lastClose=closeDay?{date:closeDay.date,value:closeDay.closing!}:null;
 if(incompatible)warnings.push(`${incompatible} registro(s) tienen unidades incompatibles con la presentación actual y no se sumaron.`);
 if(result.some(d=>d.consumption!==null&&!d.validConsumption))warnings.push('Algunos días presentan consumo negativo; verifica el conteo y las salidas especiales. No se utilizaron para el promedio.');
 if(average===null)warnings.push('Se requieren al menos 2 días con apertura y cierre válidos para calcular los niveles mínimo y objetivo.');
 else if(valid.length<7)warnings.push('Promedio preliminar: menos de 7 días de consumo válido en el periodo.');
 if(!lastClose)warnings.push('No hay cierre físico registrado para estimar existencias actuales.');
 const projection:ViewProjection[]=[];
 // Explicitly theoretical replenishment: not a production order or real stock balance.
 if(lastClose&&average!==null&&valid.length>=3&&minimum!==null&&target!==null){
  let inventory=lastClose.value;
  for(let i=1;i<=14;i++){
   const date=shiftDay(lastClose.date,i);
   let replenishment=0;
   if(inventory-average<minimum){replenishment=round(Math.max(0,target-inventory));}
   inventory=round(inventory+replenishment-average);
   projection.push({date,closing:inventory,production:replenishment,consumption:average});
  }
 }
 return {unit,unitName:packUnitLabel(unit),days:result,sampleDays:valid.length,average,minimum,target,lastClose,projection,warnings};
}

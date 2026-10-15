/** Operational export: physical counts and recorded labor, not Management KPIs. */
import {packUnitLabel,presentation} from './pc-presentation';
import {type ReportCell,type ReportSheet} from './pc-operational-files';

export type DocumentRow=Record<string,unknown>&{id:string};
export type ExportSource={products:DocumentRow[];staff:DocumentRow[];counts:DocumentRow[];batches:DocumentRow[];inputs:DocumentRow[];activities:DocumentRow[];movements:DocumentRow[]};
export type ExportConfig={site:string;from:string;to:string;productId?:string;generatedAt:string};
export type CsvTable={file:string;headers:string[];rows:ReportCell[][]};
const txt=(v:unknown)=>typeof v==='string'?v:'';
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
const val=(v:unknown)=>num(v)??0;
// Firestore documents contain unknown values (timestamps, nested maps, etc.).
// Export only scalar values; never pass opaque Firestore objects into Excel/CSV.
const reportCell=(v:unknown):ReportCell=>{
 if(typeof v==='string')return v;
 if(typeof v==='number')return Number.isFinite(v)?v:null;
 if(typeof v==='boolean')return v?'true':'false';
 return null;
};
const dataRow=(...values:unknown[]):ReportCell[]=>values.map(reportCell);
const rounded=(v:number)=>Math.round(v*1000)/1000;
const iso=(v:unknown):string=>{
 if(!v)return '';
 if(typeof v==='string')return v;
 if(v instanceof Date)return v.toISOString();
 if(typeof v==='object'){
  const t=v as {_seconds?:number;seconds?:number;toDate?:()=>Date};
  if(typeof t.toDate==='function')return t.toDate().toISOString();
  const seconds=t._seconds??t.seconds;
  if(typeof seconds==='number')return new Date(seconds*1000).toISOString();
 }
 return '';
};
const dayPlus=(date:string,days:number)=>new Date(Date.parse(`${date}T12:00:00Z`)+days*86400000).toISOString().slice(0,10);
const clock=(hours:number)=>{const mins=Math.round(hours*60);return `${Math.floor(mins/60)}:${String(mins%60).padStart(2,'0')}`;};
const countAmount=(line:Record<string,unknown>)=>{
 const pack=presentation({bagSize:line.bagSizeSnapshot,bagUnit:line.bagUnitSnapshot,bagWeightKg:line.bagWeightKgSnapshot});
 const bags=val(line.bagCount),partial=val(line.openAmount??line.openKg);
 return {bags,partial,size:pack.bagSize,unit:txt(line.quantityUnit)||pack.bagUnit,total:num(line.totalAmount)??rounded(bags*pack.bagSize+partial)};
};
const batchAmount=(batch:DocumentRow)=>{
 const pack=presentation({bagSize:batch.bagSizeSnapshot,bagUnit:batch.bagUnitSnapshot,bagWeightKg:batch.bagWeightKgSnapshot});
 return {bags:val(batch.bagCount),partial:val(batch.partialAmount??batch.partialKg),total:num(batch.outputAmount)??num(batch.outputKg),unit:txt(batch.outputUnit)||pack.bagUnit};
};
const sheet=(name:string,headers:string[],rows:ReportCell[][],editable?:number[]):ReportSheet=>({name,headers,rows,editable});
const table=(file:string,headers:string[],rows:ReportCell[][]):CsvTable=>({file,headers,rows});

type Slot={staffId:string;staffName:string;date:string;batchId:string;start:string;end:string;hours:number;state:string;activityId:string;index:number};

export function buildOperationalReport(source:ExportSource,cfg:ExportConfig):{sheets:ReportSheet[];tables:CsvTable[]}{
 const within=(date:unknown)=>typeof date==='string'&&date>=cfg.from&&date<=cfg.to;
 const byProduct=(id:unknown)=>!cfg.productId||id===cfg.productId;
 const products=source.products.filter(p=>Array.isArray(p.siteIds)&&p.siteIds.includes(cfg.site)&&(!cfg.productId||p.id===cfg.productId||p.kind==='ingredient'));
 const finished=products.filter(p=>p.kind==='finished');
 const productNames=new Map(source.products.map(p=>[p.id,txt(p.name)] as const));
 const staffNames=new Map(source.staff.map(s=>[s.id,txt(s.name)]));
 const counts=source.counts.filter(c=>c.siteId===cfg.site&&within(c.operationalDate)&&(!cfg.productId||(Array.isArray(c.lines)&&c.lines.some((l:unknown)=>!!l&&typeof l==='object'&&(l as Record<string,unknown>).productId===cfg.productId)))).sort((a,b)=>txt(a.operationalDate).localeCompare(txt(b.operationalDate))||txt(a.period).localeCompare(txt(b.period)));
 const batches=source.batches.filter(b=>b.siteId===cfg.site&&within(b.operationalDate)&&byProduct(b.productId)).sort((a,b)=>txt(a.operationalDate).localeCompare(txt(b.operationalDate)));
 const batchIds=new Set(batches.map(b=>b.id));
 const inputs=source.inputs.filter(i=>i.siteId===cfg.site&&within(i.operationalDate)&&batchIds.has(txt(i.batchId)));
 const activities=source.activities.filter(a=>a.siteId===cfg.site&&within(a.operationalDate)&&batchIds.has(txt(a.batchId)));
 const moves=source.movements.filter(m=>m.siteId===cfg.site&&within(m.operationalDate)&&byProduct(m.productId));
 const selectedLines=counts.flatMap(c=>(Array.isArray(c.lines)?c.lines:[]).filter((l):l is Record<string,unknown>=>!!l&&typeof l==='object'&&byProduct((l as Record<string,unknown>).productId)).map(l=>({count:c,line:l})));
 const countDetails:ReportCell[][]=selectedLines.map(({count:c,line:l})=>{
  const q=countAmount(l),date=txt(c.operationalDate);
  return dataRow(date,txt(c.period)==='opening'?'Apertura':'Cierre',txt(l.productName)||productNames.get(txt(l.productId))||'',q.bags,q.partial,q.size,packUnitLabel(q.unit),q.total,txt(c.startedByName)||txt(c.employeeName),txt(c.signedByName),iso(c.capturedAt),c.isLateEntry===true?'Sí':'No',val(c.correctionCount),c.id,txt(l.productId));
 });
 const days:ReportCell[][]=[];
 const statusCount=new Map(counts.map(c=>[`${txt(c.operationalDate)}:${txt(c.period)}`,c] as const));
 for(let date=cfg.from;date<=cfg.to;date=dayPlus(date,1)){
  const opening=statusCount.get(`${date}:opening`),closing=statusCount.get(`${date}:closing`);
  days.push([date,opening?'Registrado':'SIN REGISTRO',opening?iso(opening.capturedAt):'',opening?txt(opening.startedByName)||txt(opening.employeeName):'',closing?'Registrado':'SIN REGISTRO',closing?iso(closing.capturedAt):'',closing?txt(closing.startedByName)||txt(closing.employeeName):'',opening?.isLateEntry===true||closing?.isLateEntry===true?'Sí':'No']);
 }
 // Latest physical count *within the selected period*, not a calculated book balance.
 const latest=new Map<string,{count:DocumentRow;line:Record<string,unknown>}>();
 const best=(c:DocumentRow)=>`${txt(c.operationalDate)}:${c.period==='closing'?'1':'0'}`;
 for(const record of selectedLines){const id=txt(record.line.productId),prior=latest.get(id);if(!prior||best(record.count)>best(prior.count))latest.set(id,record);}
 const stockRows:ReportCell[][]=[];
 for(const p of finished){const record=latest.get(p.id),q=record?countAmount(record.line):null;
  // Formulas reference the reported subtotal (H), verified bags (I) and additional (J).
  const excelRow=stockRows.length+2;
  const pack=presentation({bagSize:p.bagSize,bagUnit:p.bagUnit,bagWeightKg:p.bagWeightKg});
  stockRows.push([
   txt(record?.count.operationalDate),txt(p.name),`${pack.bagSize} ${packUnitLabel(pack.bagUnit)}/bolsa`,
   q?.size??pack.bagSize,q?.unit??pack.bagUnit,q?.bags??null,q?.partial??null,q?.total??null,
   null,null,
   {formula:`IF(AND(ISNUMBER(I${excelRow}),ISNUMBER(J${excelRow})),I${excelRow}*D${excelRow}+J${excelRow},"")`},
   {formula:`IF(AND(ISNUMBER(K${excelRow}),ISNUMBER(H${excelRow})),K${excelRow}-H${excelRow},"")`},
   record?(record.count.period==='closing'?'Cierre registrado':'Solo apertura'):'SIN REGISTRO',
   record?(txt(record.count.signedByName)||txt(record.count.startedByName)):'',
   record?iso(record.count.capturedAt):'',record?.count.id??'',p.id
  ]);
 }
 // Interval-based labor: paused periods are omitted; open / invalid intervals are flagged.
 const slots:Slot[]=[];
 for(const a of activities){const intervals=Array.isArray(a.intervals)?a.intervals:[];
  intervals.forEach((item,index)=>{
   if(!item||typeof item!=='object')return;
   const row=item as Record<string,unknown>,start=txt(row.startedAt),end=txt(row.stoppedAt);
   const startMs=Date.parse(start),endMs=Date.parse(end);
   const active=!end;
   const valid=!active&&Number.isFinite(startMs)&&Number.isFinite(endMs)&&endMs>startMs;
   slots.push({staffId:txt(a.employeeId),staffName:txt(a.employeeName)||staffNames.get(txt(a.employeeId))||'Sin nombre',date:txt(a.operationalDate),batchId:txt(a.batchId),start,end,hours:valid?(endMs-startMs)/3600000:0,state:active?'ABIERTO':valid?'CERRADO':'INVÁLIDO',activityId:a.id,index:index+1});
  });
 }
 const slotsByBatch=new Map<string,Slot[]>(),slotsByWorkerDay=new Map<string,Slot[]>();
 for(const s of slots){const a=slotsByBatch.get(s.batchId)??[];a.push(s);slotsByBatch.set(s.batchId,a);
  const key=`${s.date}::${s.staffId}`,b=slotsByWorkerDay.get(key)??[];b.push(s);slotsByWorkerDay.set(key,b);
 }
 const overlapKeys=new Set<string>();
 const dailySummary:ReportCell[][]=[];
 for(const [key,items] of [...slotsByWorkerDay].sort((a,b)=>a[0].localeCompare(b[0]))){
  const closed=items.filter(s=>s.state==='CERRADO').sort((a,b)=>a.start.localeCompare(b.start));
  const h=rounded(closed.reduce((sum,s)=>sum+s.hours,0));
  let unionMs=0,prevStart=0,prevEnd=0;
  for(const item of closed){const start=Date.parse(item.start),end=Date.parse(item.end);
   if(prevEnd&&start<prevEnd){overlapKeys.add(key);prevEnd=Math.max(prevEnd,end);continue;}
   if(prevEnd)unionMs+=prevEnd-prevStart;
   prevStart=start;prevEnd=end;
  }
  if(prevEnd)unionMs+=prevEnd-prevStart;
  const unique=rounded(unionMs/3600000),[date,staffId]=key.split('::');
  dailySummary.push([date,items[0]?.staffName||staffNames.get(staffId)||'',staffId,new Set(items.map(s=>s.batchId)).size,closed.length,h,clock(h),unique,clock(unique),items.filter(s=>s.state==='ABIERTO').length,overlapKeys.has(key)?'REVISAR: SOLAPAMIENTO':items.some(s=>s.state!=='CERRADO')?'REVISAR: INCOMPLETO':'OK']);
 }
 const intervalsRows=slots.map(s=>dataRow(s.date,s.staffName,s.staffId,productNames.get(txt(batches.find(b=>b.id===s.batchId)?.productId))||'',s.batchId,s.index,s.start,s.end,rounded(s.hours),clock(s.hours),s.state,overlapKeys.has(`${s.date}::${s.staffId}`)?'Posible solapamiento':'',s.activityId));
 const batchesRows:ReportCell[][]=batches.map(b=>{const amount=batchAmount(b),times=slotsByBatch.get(b.id)??[],sum=rounded(times.reduce((n,s)=>n+s.hours,0));
  return dataRow(txt(b.operationalDate),txt(b.productName)||productNames.get(txt(b.productId))||'',txt(b.status)==='completed'?'Finalizado':'En curso',amount.bags,amount.partial,amount.total,packUnitLabel(amount.unit),new Set(times.map(s=>s.staffId)).size,sum,clock(sum),times.filter(s=>s.state==='ABIERTO').length,txt(b.createdByName),txt(b.completedByName),iso(b.createdAt),iso(b.completedAt),val(b.correctionCount),b.id,txt(b.productId));
 });
 const ingredientRows=inputs.map(i=>dataRow(txt(i.operationalDate),txt(batches.find(b=>b.id===i.batchId)?.productName),txt(i.ingredientName),num(i.quantity),txt(i.unit),txt(i.employeeName),iso(i.createdAt),i.id,txt(i.ingredientId),txt(i.batchId))); 
 const movementRows=moves.map(m=>dataRow(txt(m.operationalDate),txt(m.productName)||productNames.get(txt(m.productId))||'',txt(m.movementKind),num(m.quantity??m.quantityKg),txt(m.unit)||'kg',txt(m.employeeName),txt(m.notes),iso(m.createdAt),m.id,txt(m.productId))); 
 const openSlots=slots.filter(s=>s.state!=='CERRADO').length;
 const missingDays=days.filter(d=>d[1]==='SIN REGISTRO'||d[4]==='SIN REGISTRO').length;
 const completeBatches=batches.filter(b=>b.status==='completed').length;
 const totalHours=rounded(slots.reduce((sum,s)=>sum+s.hours,0));
 const guideRows:ReportCell[][]=[['Sucursal',cfg.site],['Periodo desde',cfg.from],['Periodo hasta',cfg.to],['Generado UTC',cfg.generatedAt],['Alcance',cfg.productId?`Solo producto ${productNames.get(cfg.productId)??cfg.productId}`:'Todos los productos de la sucursal'],['Conteos registrados',counts.length],['Días sin apertura o cierre',missingDays],['Preparaciones finalizadas',completeBatches],['Horas-hombre cerradas',totalHours],['Intervalos abiertos o inválidos',openSlots],['Empleados con intervalos solapados',overlapKeys.size],['Advertencia','Existencias = último conteo físico dentro del periodo, NO inventario actual verificado.'],['Advertencia','Horas = cronómetros registrados, NO nómina o jornada laboral certificada.'],['Advertencia','Los intervalos abiertos no suman horas. Los solapados se señalan y las horas únicas se calculan por empleado y fecha operativa.'],['Instrucción','En Existencias escribe bolsas y adicional verificados en las columnas amarillas. Las diferencias se calculan en Excel.'],['Instrucción','Sin registro significa que no existe conteo guardado para ese día: NO equivale a cero inventario.'],['Instrucción','Las unidades porciones, litros y kg se mantienen independientes.'],['Control de cambios','Correcciones reflejan el valor vigente y el contador de correcciones, no las revisiones individuales.']];
 const issues:ReportCell[][]=[...days.filter(d=>d[1]==='SIN REGISTRO'||d[4]==='SIN REGISTRO').map(d=>dataRow(d[0],'Conteo incompleto',`${d[1]} / ${d[4]}`)),...batches.filter(b=>b.status!=='completed').map(b=>dataRow(b.operationalDate,'Preparación en curso',b.id)),...dailySummary.filter(d=>d[10]!=='OK').map(d=>dataRow(d[0],'Cronómetros',`${d[1]} · ${d[10]}`)),...counts.filter(c=>val(c.correctionCount)>0).map(c=>dataRow(c.operationalDate,'Conteo corregido',`${c.id} · ${val(c.correctionCount)} correcciones`))];
 const sheets=[sheet('00_Instrucciones',['Campo','Valor'],guideRows),sheet('01_Existencias',['Fecha último conteo','Producto','Presentación','Tamaño por bolsa','Unidad','Bolsas registradas','Adicional registrado','Total registrado','Bolsas verificadas','Adicional verificado','Total verificado','Diferencia','Origen','Registrado por','Capturado UTC','ID conteo','ID producto'],stockRows,[8,9]),sheet('02_Conteos por día',['Fecha','Apertura','Capturada UTC','Responsable apertura','Cierre','Capturado UTC','Responsable cierre','Registro tardío'],days),sheet('03_Detalle conteos',['Fecha','Momento','Producto','Bolsas','Adicional','Tamaño bolsa','Unidad','Total','Inició','Registró','Captura UTC','Tardío','Nº correcciones','ID conteo','ID producto'],countDetails),sheet('04_Producción',['Fecha','Producto','Estado','Bolsas','Adicional','Total terminado','Unidad','Participantes','Horas-hombre','Duración h:mm','Cronómetros abiertos','Inició','Finalizó','Inicio UTC','Cierre UTC','Nº correcciones','ID lote','ID producto'],batchesRows),sheet('05_Horas por persona',['Fecha','Empleado','ID empleado','Lotes con actividad','Intervalos cerrados','Horas registradas','Horas h:mm','Horas sin solape','Únicas h:mm','Cronómetros abiertos','Validación'],dailySummary),sheet('06_Intervalos',['Fecha operativa','Empleado','ID empleado','Producto','ID lote','Nº intervalo','Inicio UTC','Fin UTC','Horas','Horas h:mm','Estado','Alerta','ID actividad'],intervalsRows),sheet('07_Ingredientes',['Fecha','Producto','Ingrediente','Cantidad','Unidad','Capturado por','Captura UTC','ID registro','ID ingrediente','ID lote'],ingredientRows),sheet('08_Movimientos',['Fecha','Producto','Motivo','Cantidad','Unidad','Responsable','Notas','Creado UTC','ID movimiento','ID producto'],movementRows),sheet('09_Control',['Fecha','Tipo','Descripción'],issues)];
 const sourceLineRows=selectedLines.map(({count:c,line:l})=>{const q=countAmount(l);return dataRow(c.id,txt(l.productId),txt(l.productName)||productNames.get(txt(l.productId))||'',q.bags,q.partial,q.size,q.unit,q.total);});
 const tables:CsvTable[]=[
  table('dim_productos.csv',['schema_version','product_id','site_ids','name','kind','active','pack_size','pack_unit','min_days','target_days'],products.map(p=>dataRow(1,p.id,(Array.isArray(p.siteIds)?p.siteIds:[]).join('|'),txt(p.name),txt(p.kind),p.active===true?'true':'false',num(p.bagSize??p.bagWeightKg),txt(p.bagUnit)||'kg',num(p.minDays),num(p.targetDays)))),
  table('dim_personal.csv',['schema_version','staff_id','name','site_ids','active'],source.staff.filter(s=>Array.isArray(s.siteIds)&&s.siteIds.includes(cfg.site)).map(s=>dataRow(1,s.id,txt(s.name),(s.siteIds as string[]).join('|'),s.active===true?'true':'false'))),
  table('fact_conteos.csv',['schema_version','count_id','site_id','operational_date','period','started_by_id','started_by_name','signed_by_id','signed_by_name','is_late','captured_at_utc','correction_count','updated_at_utc'],counts.map(c=>dataRow(1,c.id,c.siteId,c.operationalDate,c.period,c.startedById,c.startedByName,c.signedById,c.signedByName,c.isLateEntry===true?1:0,iso(c.capturedAt),val(c.correctionCount),iso(c.updatedAt??c.correctedAt)))),
  table('fact_conteo_detalle.csv',['count_id','product_id','product_name','bag_count','open_amount','pack_size','unit','total_amount'],sourceLineRows),
  table('fact_lotes.csv',['schema_version','batch_id','site_id','operational_date','product_id','product_name','status','bag_count','partial_amount','output_amount','output_unit','created_by_id','completed_by_id','created_at_utc','completed_at_utc','updated_at_utc','correction_count'],batches.map(b=>{const q=batchAmount(b);return dataRow(1,b.id,b.siteId,b.operationalDate,b.productId,b.productName,b.status,q.bags,q.partial,q.total,q.unit,b.createdById,b.completedById,iso(b.createdAt),iso(b.completedAt),iso(b.updatedAt),val(b.correctionCount));})),
  table('fact_ingredientes.csv',['schema_version','input_id','batch_id','site_id','operational_date','ingredient_id','ingredient_name','quantity','unit','employee_id','created_at_utc','updated_at_utc'],inputs.map(i=>dataRow(1,i.id,i.batchId,i.siteId,i.operationalDate,i.ingredientId,i.ingredientName,num(i.quantity),txt(i.unit),i.employeeId,iso(i.createdAt),iso(i.updatedAt)))),
  table('fact_intervalos.csv',['schema_version','activity_id','batch_id','site_id','operational_date','employee_id','interval_index','started_at_utc','stopped_at_utc','hours_closed','state'],slots.map(s=>dataRow(1,s.activityId,s.batchId,cfg.site,s.date,s.staffId,s.index,s.start,s.end,rounded(s.hours),s.state))),
  table('fact_movimientos.csv',['schema_version','movement_id','site_id','operational_date','product_id','kind','quantity','unit','employee_id','notes','created_at_utc'],moves.map(m=>dataRow(1,m.id,m.siteId,m.operationalDate,m.productId,m.movementKind,num(m.quantity??m.quantityKg),txt(m.unit)||'kg',m.employeeId,txt(m.notes),iso(m.createdAt)))),
  table('fact_horas_diarias.csv',['date','employee_id','employee_name','batches','closed_intervals','recorded_hours','unique_hours','open_intervals','validation'],dailySummary.map(d=>dataRow(d[0],d[2],d[1],d[3],d[4],d[5],d[7],d[9],d[10]))),
 ];
 return {sheets,tables};
}

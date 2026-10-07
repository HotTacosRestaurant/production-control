'use client';

import type {CSSProperties} from 'react';
import type {ManagementData} from '@/lib/pc-management';

type Lang='es'|'en';

function num(value:number,digits=0){return new Intl.NumberFormat(undefined,{maximumFractionDigits:digits}).format(value);}
function pct(value:number){return `${num(value,1)}%`;}

function Gauge({value,label}:{value:number;label:string}){
 const safe=Math.max(0,Math.min(100,value));
 return <div className="mi-gauge-wrap"><div className="mi-gauge" style={{'--gauge':`${safe*3.6}deg`} as CSSProperties}><div><strong>{pct(safe)}</strong><span>{label}</span></div></div></div>;
}

export function ManagementDashboard({data,lang,email,onRefresh,onLogout,showcase=false}:{data:ManagementData;lang:Lang;email?:string;onRefresh:()=>void;onLogout?:()=>void;showcase?:boolean}){
 const es=lang==='es';
 const maxOutput=Math.max(1,...data.bySite.map(x=>x.outputKg));
 const maxEmployee=Math.max(1,...data.byEmployee.map(x=>x.trackedLaborHours));
 const maxProduct=Math.max(1,...data.byProduct.map(x=>x.outputKg));
 const maxTrend=Math.max(1,...data.trend.map(x=>x.outputKg));
 return <section className="mi-dashboard">
  <div className="mi-title-row"><div><p className="ux-eyebrow">MANAGEMENT INFORMATION</p><h1>{es?'Control de producción · KPIs':'Production Control · KPIs'}</h1><p className="ux-muted">{showcase?(es?'Indicadores derivados de conteos, producción, tiempos e insumos.':'Indicators derived from counts, production, time and inputs.'):(es?'Indicadores derivados de conteos, producción, tiempos e insumos. Sólo superadministradores.':'Indicators derived from counts, production, time and inputs. Super admins only.')}</p></div><div className="mi-admin-actions">{!showcase&&email?<small>{email}</small>:null}<button className="ux-secondary" onClick={onRefresh}>{es?'Actualizar':'Refresh'}</button>{!showcase&&onLogout?<button className="ux-secondary" onClick={onLogout}>{es?'Cerrar sesión':'Sign out'}</button>:null}</div></div>

  <div className="mi-kpis">
   <article><span>{es?'Cobertura de pares de conteo':'Count pair coverage'}</span><strong>{pct(data.summary.countPairCompletionPct)}</strong><small>{data.summary.completedCountPairs}/{data.summary.observedCountDays} {es?'días observados completos':'observed days complete'}</small></article>
   <article><span>{es?'Producción terminada':'Completed production'}</span><strong>{num(data.summary.outputKg,1)} kg</strong><small>{num(data.summary.bagsProduced)} {es?'bolsas':'bags'} · {num(data.summary.completedBatches)} {es?'lotes':'batches'}</small></article>
   <article><span>{es?'Horas-hombre registradas':'Tracked labor hours'}</span><strong>{num(data.summary.trackedLaborHours,1)} h</strong><small>{num(data.summary.runningTimers)} {es?'timers activos':'running timers'}</small></article>
   <article><span>{es?'Consumo estimado':'Estimated consumption'}</span><strong>{num(data.summary.estimatedConsumptionKg,1)} kg</strong><small>{es?'Apertura + producción − cierre':'Opening + production − closing'}</small></article>
   <article><span>{es?'Preparaciones abiertas':'Open batches'}</span><strong>{num(data.summary.activeBatches)}</strong><small>{es?'deben cerrarse al terminar':'should be closed when finished'}</small></article>
   <article><span>{es?'Calidad del dato':'Data quality'}</span><strong>{num(data.summary.countCorrections)}</strong><small>{es?'correcciones · ': 'corrections · '}{num(data.summary.lateEntries)} {es?'capturas posteriores':'late entries'}</small></article>
  </div>

  <div className="mi-gauges">
   <Gauge value={data.summary.countPairCompletionPct} label={es?'Conteos completos':'Complete counts'}/>
   <Gauge value={data.summary.observedCountDays?100-(data.summary.singleCountDays/data.summary.observedCountDays*100):100} label={es?'Consistencia diaria':'Daily consistency'}/>
   <Gauge value={data.summary.completedBatches+data.summary.activeBatches?data.summary.completedBatches/(data.summary.completedBatches+data.summary.activeBatches)*100:100} label={es?'Lotes cerrados':'Closed batches'}/>
  </div>

  <div className="mi-grid-two">
   <section className="mi-panel"><div className="mi-panel-head"><div><p className="ux-eyebrow">{es?'POR OPERACIÓN':'BY OPERATION'}</p><h2>{es?'Comparativo por sucursal':'Location comparison'}</h2></div></div><div className="mi-site-table">{data.bySite.map(row=><article key={row.siteId}><div className="mi-site-top"><div><strong>{row.siteName}</strong><small>{row.siteId.toUpperCase()}</small></div><b>{pct(row.countPairCompletionPct)}</b></div><div className="mi-bar"><span style={{width:`${Math.min(100,row.outputKg/maxOutput*100)}%`}}/></div><div className="mi-site-stats"><span>{num(row.outputKg,1)} kg {es?'producidos':'produced'}</span><span>{num(row.trackedLaborHours,1)} h</span><span>{num(row.estimatedConsumptionKg,1)} kg {es?'consumo est.':'est. usage'}</span><span>{row.activeBatches} {es?'abiertos':'open'}</span></div></article>)}</div></section>
   <section className="mi-panel"><div className="mi-panel-head"><div><p className="ux-eyebrow">{es?'EXCEPCIONES':'EXCEPTIONS'}</p><h2>{es?'Semáforo operativo':'Operational alerts'}</h2></div><span className={data.alerts.some(a=>a.severity==='critical')?'mi-light red':data.alerts.length?'mi-light yellow':'mi-light green'}>{data.alerts.length}</span></div><div className="mi-alerts">{data.alerts.length?data.alerts.map((a,i)=><article key={`${a.kind}-${i}`} className={a.severity==='critical'?'critical':'warning'}><span className="mi-dot"/><div><strong>{a.title}</strong><small>{a.siteId.toUpperCase()} · {a.detail}</small></div></article>):<p className="mi-empty">{es?'Sin excepciones detectadas.':'No exceptions detected.'}</p>}</div></section>
  </div>

  <div className="mi-grid-two">
   <section className="mi-panel"><div className="mi-panel-head"><div><p className="ux-eyebrow">{es?'PERSONAL':'PEOPLE'}</p><h2>{es?'Carga y tiempo registrado':'Workload and tracked time'}</h2></div></div><div className="mi-ranking">{data.byEmployee.slice(0,12).map(row=><article key={row.employeeId}><div><strong>{row.employeeName}</strong><small>{row.batchesTouched} {es?'lotes':'batches'} · {row.ingredientEntries} {es?'registros de insumo':'input records'}{row.runningTimers?` · ${row.runningTimers} ${es?'timer activo':'running timer'}`:''}</small></div><div className="mi-rank-value"><div className="mi-bar"><span style={{width:`${Math.min(100,row.trackedLaborHours/maxEmployee*100)}%`}}/></div><b>{num(row.trackedLaborHours,1)} h</b></div></article>)}</div></section>
   <section className="mi-panel"><div className="mi-panel-head"><div><p className="ux-eyebrow">{es?'PRODUCTOS':'PRODUCTS'}</p><h2>{es?'Producción por producto':'Production by product'}</h2></div></div><div className="mi-ranking">{data.byProduct.slice(0,12).map(row=><article key={row.productId}><div><strong>{row.productName}</strong><small>{row.completedBatches} {es?'lotes':'batches'} · {num(row.bagsProduced)} {es?'bolsas':'bags'} · {num(row.trackedLaborHours,1)} h</small></div><div className="mi-rank-value"><div className="mi-bar"><span style={{width:`${Math.min(100,row.outputKg/maxProduct*100)}%`}}/></div><b>{num(row.outputKg,1)} kg</b></div></article>)}</div></section>
  </div>

  <section className="mi-panel"><div className="mi-panel-head"><div><p className="ux-eyebrow">{es?'HISTÓRICO':'HISTORY'}</p><h2>{es?'Producción mensual':'Monthly production'}</h2></div></div><div className="mi-trend">{data.trend.map(row=><article key={row.month}><div className="mi-trend-bar"><span style={{height:`${Math.max(4,row.outputKg/maxTrend*100)}%`}}/></div><strong>{row.month}</strong><small>{num(row.outputKg,0)} kg</small><small>{num(row.trackedLaborHours,1)} h</small></article>)}</div></section>

  <p className="mi-method">{es?'Metodología: “consumo estimado” sólo se calcula cuando existe apertura y cierre del mismo día/producto; fórmula = inventario de apertura + producción terminada del día − inventario de cierre. Los KPIs no sustituyen una conciliación contable.':'Method: “estimated consumption” is calculated only when opening and closing counts exist for the same day/product; formula = opening inventory + completed production − closing inventory. KPIs do not replace accounting reconciliation.'}</p>
 </section>;
}

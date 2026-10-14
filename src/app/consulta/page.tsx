'use client';
import {pcOperationalDate} from '@/lib/pc-date';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {onAuthStateChanged,signInWithEmailAndPassword,signOut,type User} from 'firebase/auth';
import {auth} from '@/lib/firebase';
import {packUnitLabel} from '@/lib/pc-presentation';
import '../pc.css';
import './consulta.css';

type Item={id:string;productName:string;productId:string;bagCount:number;openAmount?:number;openKg?:number;bagSizeSnapshot?:number;bagUnitSnapshot?:string;bagWeightKgSnapshot?:number;totalAmount?:number};
type Count={id:string;operationalDate:string;period:string;lines:Item[];startedByName:string;signedByName:string;isLateEntry?:boolean;capturedAt?:{_seconds?:number;seconds?:number}};
type Batch={id:string;operationalDate:string;productName:string;status:string;bagCount?:number;outputAmount?:number;outputKg?:number;outputUnit?:string;bagUnitSnapshot?:string;createdByName?:string};
type Input={id:string;batchId:string;ingredientName:string;quantity:number;unit:string};
type Movement={id:string;operationalDate:string;productName:string;movementKind:string;quantity?:number;unit?:string;quantityKg?:number};
type Product={id:string;name:string;bagWeightKg:number|null;bagSize?:number;bagUnit?:string};
type ResponseData={counts:Count[];batches:Batch[];inputs:Input[];movements:Movement[];products:Product[]};
const nowDay=()=>pcOperationalDate();
const minus=(date:string,n:number)=>new Date(Date.parse(date+'T12:00:00Z')-n*86400000).toISOString().slice(0,10);
const locations=[{id:'htl',label:'Leamington'},{id:'htw',label:'Windsor'},{id:'htft',label:'Food Truck'}];
const numberLabel=(n:number,u:string)=>`${n.toLocaleString('es-CA',{maximumFractionDigits:3})} ${packUnitLabel(u)}`;
const captured=(v:Count['capturedAt'])=>{const n=v?._seconds??v?.seconds;return typeof n==='number'?new Date(n*1000).toLocaleString('es-CA',{timeZone:'America/Toronto'}):'—';};
export default function Consulta(){
 const [user,setUser]=useState<User|null>(null),[authReady,setAuthReady]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [site,setSite]=useState('htl'),[from,setFrom]=useState(()=>minus(nowDay(),13)),[to,setTo]=useState(nowDay());
 const [data,setData]=useState<ResponseData|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!auth){setAuthReady(true);return;}return onAuthStateChanged(auth,u=>{setUser(u);setAuthReady(true);if(!u)setData(null);});},[]);
 const load=useCallback(async()=>{
  if(!user)throw Error('Inicia sesión para consultar.');
  setLoading(true);setError('');try{
   const token=await user.getIdToken();const query=new URLSearchParams({site,from,to});
   const response=await fetch(`/api/pc/consultation?${query}`,{cache:'no-store',headers:{Authorization:`Bearer ${token}`}});
   const result=await response.json() as ResponseData&{error?:string};
   if(!response.ok)throw Error(result.error??'No fue posible consultar la información.');
   setData(result);
  }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setLoading(false);}
 },[user,site,from,to]);
 const days=useMemo(()=>{
  if(!data)return [];
  const arr:Array<{day:string;open:number|null;close:number|null;production:number}> = [];
  const span=Math.floor((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000);
  for(let i=0;i<=span;i++){
   const day=minus(to,i),opening=data.counts.find(c=>c.operationalDate===day&&c.period==='opening'),closing=data.counts.find(c=>c.operationalDate===day&&c.period==='closing');
   arr.push({day,open:opening?opening.lines.reduce((s,x)=>s+x.bagCount,0):null,close:closing?closing.lines.reduce((s,x)=>s+x.bagCount,0):null,production:data.batches.filter(b=>b.operationalDate===day&&b.status==='completed').reduce((s,x)=>s+(x.bagCount??0),0)});
  }
  return arr;
 },[data,from,to]);
 const max=Math.max(1,...days.flatMap(d=>[d.open??0,d.close??0,d.production]));
 const invalid=from>to||to>nowDay()||Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z')>90*86400000;
 return <main className="pc-consulta">
  <header className="pc-consulta-head"><div><p className="ux-eyebrow">HOT TACOS · PRODUCTION CONTROL</p><h1>Consulta operativa</h1><p className="ux-muted">Conteos, existencias físicas reportadas y producción. Sin KPIs de Management.</p></div><a href="/">← Cocina</a></header>
  {!authReady&&<p>Comprobando acceso…</p>}
  {authReady&&!user&&<section className="ux-paper pc-consulta-login"><h2>Acceso de consulta</h2><p>El administrador debe habilitar tu cuenta con el rol <code>viewer</code> en <code>portal_users</code>.</p><form onSubmit={async e=>{e.preventDefault();if(!auth)return;setError('');try{await signInWithEmailAndPassword(auth,email,password);setPassword('');}catch(err){setError(err instanceof Error?err.message:String(err));}}}><label>Correo<input type="email" value={email} autoComplete="username" onChange={e=>setEmail(e.target.value)} required/></label><label>Contraseña<input type="password" value={password} autoComplete="current-password" onChange={e=>setPassword(e.target.value)} required/></label><button className="ux-main-button" type="submit">Entrar</button></form></section>}
  {user&&<><div className="pc-period"><label>Sucursal<select value={site} onChange={e=>{setSite(e.target.value);setData(null);}}>{locations.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label><label>Desde<input type="date" value={from} onChange={e=>{setFrom(e.target.value);setData(null);}} max={nowDay()}/></label><label>Hasta<input type="date" value={to} onChange={e=>{setTo(e.target.value);setData(null);}} max={nowDay()}/></label><button className="ux-main-button" disabled={invalid||loading} onClick={()=>void load()}>{loading?'Consultando…':'Consultar periodo'}</button><button className="ux-secondary" onClick={()=>{if(auth)void signOut(auth);}}>Salir</button></div>
  {data&&<><section className="ux-paper"><h2>Comportamiento diario · bolsas</h2><p className="ux-muted">Apertura y cierre son conteos físicos; producción son bolsas terminadas. No se suman unidades diferentes.</p><div className="pc-oper-chart">{[...days].reverse().map(d=><div key={d.day} className="pc-chart-day" title={d.day}><div className="pc-chart-bars"><i style={{height:`${100*(d.open??0)/max}%`}} title={`Apertura: ${d.open??'Sin registro'}`}/><i style={{height:`${100*(d.close??0)/max}%`}} title={`Cierre: ${d.close??'Sin registro'}`}/><i style={{height:`${100*d.production/max}%`}} title={`Producidas: ${d.production}`}/></div><small>{d.day.slice(5)}</small></div>)}</div><p className="pc-chart-legend">■ Apertura &nbsp; ▨ Cierre &nbsp; ▤ Producidas</p></section>
  <section className="ux-paper"><h2>Conteos por día</h2><div className="pc-table-scroll"><table className="pc-compact-table"><thead><tr><th>Fecha</th><th>Apertura</th><th>Cierre</th></tr></thead><tbody>{days.map(d=><tr key={d.day}><th>{d.day}</th>{(['opening','closing'] as const).map(kind=>{const c=data.counts.find(c=>c.operationalDate===d.day&&c.period===kind);return <td key={kind}>{c?<details><summary>{c.lines.reduce((s,x)=>s+x.bagCount,0)} bolsas{c.isLateEntry?' · Tardío':''}</summary><small>{c.startedByName} → {c.signedByName}</small><div><small>Capturado: {captured(c.capturedAt)}</small></div>{c.lines.map(l=><div key={l.productId}><small>{l.productName}: {l.bagCount} bolsas, {numberLabel(l.totalAmount??l.bagCount*(l.bagSizeSnapshot??l.bagWeightKgSnapshot??0)+(l.openAmount??l.openKg??0),l.bagUnitSnapshot??'kg')}</small></div>)}</details>:<span className="ux-muted">Sin registrar</span>}</td>;})}</tr>)}</tbody></table></div></section>
  <section className="ux-paper"><h2>Producción por fecha</h2><div className="pc-table-scroll"><table className="pc-compact-table"><thead><tr><th>Fecha</th><th>Producto</th><th>Estado</th><th>Resultado final</th><th>Ingredientes</th></tr></thead><tbody>{data.batches.map(b=><tr key={b.id}><td>{b.operationalDate}</td><td>{b.productName}</td><td>{b.status==='completed'?'Finalizado':'En curso'}</td><td>{b.status==='completed'?`${b.bagCount??0} bolsas · ${numberLabel(b.outputAmount??b.outputKg??0,b.outputUnit??b.bagUnitSnapshot??'kg')}`:'—'}</td><td><details><summary>{data.inputs.filter(i=>i.batchId===b.id).length} registros</summary>{data.inputs.filter(i=>i.batchId===b.id).map(i=><div key={i.id}>{i.ingredientName}: {i.quantity} {i.unit}</div>)}</details></td></tr>)}</tbody></table></div></section>
  <section className="ux-paper"><h2>Salidas especiales</h2>{data.movements.length===0?<p className="ux-muted">Sin movimientos durante el periodo.</p>:<div className="pc-table-scroll"><table className="pc-compact-table"><thead><tr><th>Fecha</th><th>Producto</th><th>Destino / Motivo</th><th>Cantidad</th></tr></thead><tbody>{data.movements.map(m=><tr key={m.id}><td>{m.operationalDate}</td><td>{m.productName}</td><td>{m.movementKind==='windsor'?'Windsor':m.movementKind}</td><td>{numberLabel(m.quantity??m.quantityKg??0,m.unit??'kg')}</td></tr>)}</tbody></table></div>}</section></>}
  {!data&&!loading&&<p className="ux-muted">Selecciona sucursal y periodo y pulsa «Consultar periodo».</p>}
  </>}
  {error&&<p className="ux-warning" role="alert">{error}</p>}
 </main>;
}

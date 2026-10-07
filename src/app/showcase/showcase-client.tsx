'use client';

import {useCallback,useEffect,useState} from 'react';
import type {ManagementData} from '@/lib/pc-management';
import {ManagementDashboard} from '../management-dashboard';

export function ShowcaseClient(){
 const [data,setData]=useState<ManagementData|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState<string|null>(null);

 const load=useCallback(async()=>{
  setLoading(true);
  try{
   const response=await fetch('/api/showcase',{cache:'no-store'});
   const payload=await response.json() as ManagementData|{error?:string};
   if(!response.ok)throw new Error('error' in payload&&payload.error?payload.error:'SHOWCASE_UNAVAILABLE');
   setData(payload as ManagementData);
   setError(null);
  }catch(loadError){
   const message=loadError instanceof Error?loadError.message:'SHOWCASE_UNAVAILABLE';
   console.error('[Showcase KPI refresh failed]',loadError);
   setError(message);
  }finally{
   setLoading(false);
  }
 },[]);

 useEffect(()=>{void load();},[load]);

 return <main className="showcase-kpi-shell">
  {error&&!data?<section className="showcase-kpi-error" role="alert"><strong>No se pudieron cargar los KPIs.</strong><span>{error}</span><button type="button" onClick={()=>void load()}>Reintentar</button></section>:null}
  {loading&&!data?<section className="showcase-kpi-loading">Cargando indicadores…</section>:null}
  {data?<ManagementDashboard data={data} lang="es" onRefresh={()=>void load()} showcase/>:null}
 </main>;
}

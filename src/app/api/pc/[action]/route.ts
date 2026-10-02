import {NextRequest, NextResponse} from 'next/server';
import {FieldValue} from 'firebase-admin/firestore';
import {isPCUnit} from '@/lib/pc-units';
import {db, requireLocalDevelopment, safeSite, validSites, validDate, operationalToday, text, stamp, newId, findEmployee, audit, type Site} from '@/lib/pc-server';

export const runtime='nodejs';
type Context={params:Promise<{action:string}>};
type CountLine={productId:string;bagCount:number};
const number=(v:unknown)=>typeof v==='number'?v:Number(v);
function respond(error:unknown){
 const message=error instanceof Error?error.message:'SERVER_ERROR';
 const status=message==='AUTH_NOT_CONFIGURED'?403:message==='FORBIDDEN'?403:message==='CONFLICT'?409:message.startsWith('Missing server')?503:message==='SERVER_ERROR'?500:400;
 console.error('PC API:',message);
 return NextResponse.json({error:message},{status});
}

export async function GET(req:NextRequest,context:Context){try{
 requireLocalDevelopment(req);
 const {action}=await context.params;
 if(action!=='snapshot'&&action!=='public')throw new Error('NOT_FOUND');
 const store=db();
 const [pr,pe,co,ba,ac,inputs]=await Promise.all([
  store.collection('pc_products').get(),store.collection('pc_staff').get(),store.collection('pc_counts').orderBy('capturedAt','desc').limit(120).get(),store.collection('pc_batches').orderBy('createdAt','desc').limit(100).get(),store.collection('pc_activities').get(),store.collection('pc_inputs').get()
 ]);
 const docs=(snap:FirebaseFirestore.QuerySnapshot)=>snap.docs.map(d=>({...d.data(),id:d.id}));
 return NextResponse.json({products:docs(pr),staff:docs(pe),counts:docs(co),batches:docs(ba),activities:docs(ac),inputs:docs(inputs)});
}catch(e){return respond(e);}}

export async function POST(req:NextRequest,context:Context){try{
 requireLocalDevelopment(req);
 const {action}=await context.params;
 const payload=await req.json() as Record<string,unknown>;
 const store=db();
 if(action==='catalog'){
  const kind=payload.kind, name=text(payload.name), sites=payload.siteIds;
  if(name.length<2||!validSites(sites))throw new Error('INVALID_CATALOG');
  const active=payload.active!==false;
  const branch=payload.siteId;
  if(!safeSite(branch)||!sites.includes(branch))throw new Error('INVALID_SITE');
  const existingId=typeof payload.id==='string'&&/^[\w-]{5,80}$/.test(payload.id)?payload.id:null;
  if(!existingId){if(sites.length!==1||sites[0]!==branch)throw new Error('INVALID_SITE');}
  else {
   const collection=kind==='staff'?'pc_staff':'pc_products';
   const prior=await store.collection(collection).doc(existingId).get();
   const old=prior.data();
   if(!old||!validSites(old.siteIds)||!old.siteIds.includes(branch))throw new Error('FORBIDDEN');
   if(sites.length!==old.siteIds.length||!sites.every(s=>old.siteIds.includes(s)))throw new Error('INVALID_SITE');
  }
  if(kind==='staff'){
   const id=typeof payload.id==='string'&&/^[\w-]{5,80}$/.test(payload.id)?payload.id:newId();
   await store.collection('pc_staff').doc(id).set({name,siteIds:sites,active,updatedAt:stamp()},{merge:true});
   return NextResponse.json({ok:true,id});
  }
  if(kind==='product'){
   const productKind=payload.productKind;
   const weight=number(payload.bagWeightKg);
   const defaultUnit=productKind==='ingredient'?(payload.defaultUnit??'kg'):null;
   if(productKind==='ingredient'&&!isPCUnit(defaultUnit))throw new Error('INVALID_UNIT');
   if(!['finished','ingredient'].includes(String(productKind))||(productKind==='finished'&&(!Number.isFinite(weight)||weight<=0||weight>1000)))throw new Error('INVALID_PRODUCT');
   const id=typeof payload.id==='string'&&/^[\w-]{5,80}$/.test(payload.id)?payload.id:newId();
   await store.collection('pc_products').doc(id).set({name:productKind==='ingredient'?name.toLocaleUpperCase('es-CA'):name,kind:productKind,category:text(payload.category,40)||'other',defaultUnit,bagWeightKg:productKind==='finished'?weight:null,siteIds:sites,active,updatedAt:stamp()},{merge:true});
   return NextResponse.json({ok:true,id});
  }
  throw new Error('INVALID_KIND');
 }
 if(action==='count'){
  const site=payload.siteId;
  const date=payload.operationalDate, period=payload.period;
  if(!safeSite(site)||!validDate(date)||date>operationalToday()||!['opening','closing'].includes(String(period)))throw new Error('INVALID_COUNT');
  const starter=await findEmployee(payload.startedById,site);
  const signer=await findEmployee(payload.signedById,site);
  const differs=starter.id!==signer.id;
  if(differs&&payload.confirmDifferentSigner!==true)throw new Error('SIGNER_MISMATCH');
  if(!Array.isArray(payload.lines)||payload.lines.length<1||payload.lines.length>100)throw new Error('INVALID_COUNT');
  const rows=payload.lines as CountLine[];
  if(new Set(rows.map(r=>r.productId)).size!==rows.length)throw new Error('DUPLICATE_LINE');
  const lines=[];
  for(const row of rows){
   if(typeof row.productId!=='string'||!Number.isSafeInteger(row.bagCount)||row.bagCount<0||row.bagCount>100000)throw new Error('INVALID_COUNT');
   const doc=await store.collection('pc_products').doc(row.productId).get();const p=doc.data();
   if(!p||p.kind!=='finished'||!p.active||!validSites(p.siteIds)||!p.siteIds.includes(site))throw new Error('INVALID_PRODUCT');
   lines.push({productId:doc.id,productName:p.name,bagCount:row.bagCount,bagWeightKgSnapshot:p.bagWeightKg});
  }
  const id=`${site}_${date}_${period}`;
  try{
   await store.collection('pc_counts').doc(id).create({siteId:site,operationalDate:date,period,lines,employeeId:starter.id,employeeName:starter.name,startedById:starter.id,startedByName:starter.name,signedById:signer.id,signedByName:signer.name,signerMismatch:differs,isLateEntry:date<operationalToday(),capturedAt:stamp()});
  }catch(e){if(e instanceof Error&&/ALREADY_EXISTS|already exists|6 /.test(e.message))throw new Error('CONFLICT');throw e;}
  await audit('count.create',site,signer,{id,startedById:starter.id,signedById:signer.id});
  return NextResponse.json({ok:true,id});
 }
 if(action==='count-correct'){
  const id=text(payload.countId,120), reason=text(payload.reason,500);
  if(!id||reason.length<5)throw new Error('REASON_REQUIRED');
  const ref=store.collection('pc_counts').doc(id);
  const before=await ref.get(),existing=before.data();
  if(!existing||!safeSite(existing.siteId)||!Array.isArray(existing.lines))throw new Error('INVALID_COUNT');
  const employee=await findEmployee(payload.employeeId,existing.siteId);
  const rows=payload.lines;
  if(!Array.isArray(rows)||rows.length!==existing.lines.length)throw new Error('INVALID_COUNT');
  const current=existing.lines as Array<{productId:string;productName:string;bagCount:number;bagWeightKgSnapshot:number}>;
  const next=current.map(line=>{
   const proposed=rows.find((row:unknown)=>typeof row==='object'&&row!==null&&(row as CountLine).productId===line.productId) as CountLine|undefined;
   if(!proposed||!Number.isSafeInteger(proposed.bagCount)||proposed.bagCount<0||proposed.bagCount>100000)throw new Error('INVALID_COUNT');
   return {...line,bagCount:proposed.bagCount};
  });
  if(next.every((line,i)=>line.bagCount===current[i].bagCount))throw new Error('NO_CHANGES');
  const revision=ref.collection('revisions').doc();
  await store.runTransaction(async tx=>{
   const latest=await tx.get(ref);
   if(!latest.exists||latest.updateTime?.toMillis()!==before.updateTime?.toMillis())throw new Error('CONFLICT');
   tx.create(revision,{before:current,after:next,reason,correctedById:employee.id,correctedByName:employee.name,createdAt:stamp()});
   tx.update(ref,{lines:next,correctedAt:stamp(),correctedById:employee.id,correctedByName:employee.name,correctionCount:FieldValue.increment(1)});
  });
  await audit('count.correct',existing.siteId,employee,{countId:id,revisionId:revision.id,reason});
  return NextResponse.json({ok:true});
 }
 if(action==='input-correct'){
  const id=text(payload.inputId,100),reason=text(payload.reason,500);
  const qty=number(payload.quantity),unit=payload.unit;
  if(!id||reason.length<5||!Number.isFinite(qty)||qty<=0||qty>100000||!isPCUnit(unit))throw new Error('INVALID_CORRECTION');
  const ref=store.collection('pc_inputs').doc(id),before=await ref.get(),old=before.data();
  if(!old||!safeSite(old.siteId))throw new Error('INVALID_INPUT');
  const employee=await findEmployee(payload.employeeId,old.siteId);
  if(old.quantity===qty&&old.unit===unit)throw new Error('NO_CHANGES');
  const revision=ref.collection('revisions').doc();
  await store.runTransaction(async tx=>{
   const latest=await tx.get(ref);
   if(!latest.exists||latest.updateTime?.toMillis()!==before.updateTime?.toMillis())throw new Error('CONFLICT');
   tx.create(revision,{before:{quantity:old.quantity,unit:old.unit},after:{quantity:qty,unit},reason,correctedById:employee.id,correctedByName:employee.name,createdAt:stamp()});
   tx.update(ref,{quantity:qty,unit,correctedAt:stamp(),correctedById:employee.id,correctedByName:employee.name,correctionCount:FieldValue.increment(1)});
  });
  await audit('input.correct',old.siteId,employee,{inputId:id,batchId:old.batchId,revisionId:revision.id,reason});
  return NextResponse.json({ok:true});
 }
 if(action==='output-correct'){
  const id=text(payload.batchId,100),reason=text(payload.reason,500),bags=number(payload.bagCount);
  if(!id||reason.length<5||!Number.isSafeInteger(bags)||bags<0||bags>100000)throw new Error('INVALID_CORRECTION');
  const ref=store.collection('pc_batches').doc(id),before=await ref.get(),old=before.data();
  if(!old||old.status!=='completed'||!safeSite(old.siteId)||!Number.isFinite(old.bagWeightKgSnapshot))throw new Error('INVALID_BATCH');
  const employee=await findEmployee(payload.employeeId,old.siteId);
  if(old.bagCount===bags)throw new Error('NO_CHANGES');
  const revision=ref.collection('revisions').doc();
  await store.runTransaction(async tx=>{
   const latest=await tx.get(ref);
   if(!latest.exists||latest.updateTime?.toMillis()!==before.updateTime?.toMillis())throw new Error('CONFLICT');
   tx.create(revision,{before:{bagCount:old.bagCount,outputKg:old.outputKg},after:{bagCount:bags,outputKg:bags*old.bagWeightKgSnapshot},reason,correctedById:employee.id,correctedByName:employee.name,createdAt:stamp()});
   tx.update(ref,{bagCount:bags,outputKg:bags*old.bagWeightKgSnapshot,correctedAt:stamp(),correctedById:employee.id,correctedByName:employee.name,correctionCount:FieldValue.increment(1)});
  });
  await audit('output.correct',old.siteId,employee,{batchId:id,revisionId:revision.id,reason});
  return NextResponse.json({ok:true});
 }
 if(action==='batch'){
  const site=payload.siteId, date=payload.operationalDate, productId=text(payload.productId,80);
  if(!safeSite(site)||!validDate(date)||date>operationalToday())throw new Error('INVALID_BATCH');
  const employee=await findEmployee(payload.employeeId,site);
  const product=await store.collection('pc_products').doc(productId).get();const p=product.data();
  if(!p||!p.active||p.kind!=='finished'||!validSites(p.siteIds)||!p.siteIds.includes(site))throw new Error('INVALID_PRODUCT');
  const id=newId();
  await store.collection('pc_batches').doc(id).create({siteId:site,productId,productName:p.name,operationalDate:date,status:'active',createdById:employee.id,createdByName:employee.name,createdAt:stamp()});
  await audit('batch.create',site,employee,{batchId:id});
  return NextResponse.json({ok:true,id});
 }
 if(['start','pause','input','finish'].includes(action)){
  const batchId=text(payload.batchId,80),ref=store.collection('pc_batches').doc(batchId);
  const snap=await ref.get(),b=snap.data();
  if(!b||b.status!=='active'||!safeSite(b.siteId))throw new Error('INVALID_BATCH');
  const site=b.siteId as Site;
  const employee=await findEmployee(payload.employeeId,site);
  if(action==='start'||action==='pause'){
   const activity=store.collection('pc_activities').doc(`${batchId}_${employee.id}`);
   await store.runTransaction(async tx=>{
    const previous=await tx.get(activity);const value=previous.data();
    const intervals:Array<{startedAt:string;stoppedAt:string|null}>=Array.isArray(value?.intervals)?[...value.intervals]:[];
    if(action==='start'){
     if(value?.running===true)throw new Error('ALREADY_RUNNING');
     intervals.push({startedAt:new Date().toISOString(),stoppedAt:null});
    }else{
     if(value?.running!==true||!intervals.length)throw new Error('NOT_RUNNING');
     intervals[intervals.length-1]={...intervals[intervals.length-1],stoppedAt:new Date().toISOString()};
    }
    tx.set(activity,{batchId,siteId:site,employeeId:employee.id,employeeName:employee.name,running:action==='start',intervals,updatedAt:stamp()},{merge:true});
   });
   await audit(`timer.${action}`,site,employee,{batchId});
   return NextResponse.json({ok:true});
  }
  if(action==='input'){
   const ingredientId=text(payload.ingredientId,80),quantity=number(payload.quantity),unit=payload.unit;
   if(!Number.isFinite(quantity)||quantity<=0||quantity>100000||!isPCUnit(unit))throw new Error('INVALID_INPUT');
   const ingredient=await store.collection('pc_products').doc(ingredientId).get(),p=ingredient.data();
   if(!p||p.kind!=='ingredient'||!p.active||!validSites(p.siteIds)||!p.siteIds.includes(site))throw new Error('INVALID_INGREDIENT');
   const id=newId();await store.collection('pc_inputs').doc(id).create({batchId,siteId:site,ingredientId,ingredientName:p.name,quantity,unit,employeeId:employee.id,employeeName:employee.name,createdAt:stamp()});
   await audit('batch.input',site,employee,{batchId,id});return NextResponse.json({ok:true,id});
  }
  if(action==='finish'){
   const bagCount=number(payload.bagCount),product=await store.collection('pc_products').doc(b.productId).get(),weight=product.data()?.bagWeightKg;
   if(!Number.isSafeInteger(bagCount)||bagCount<=0||!Number.isFinite(weight)||weight<=0)throw new Error('INVALID_OUTPUT');
   const running=await store.collection('pc_activities').where('batchId','==',batchId).get();
   if(running.docs.some(doc=>doc.data().running===true))throw new Error('TIMERS_RUNNING');
   await store.runTransaction(async tx=>{const fresh=await tx.get(ref);if(fresh.data()?.status!=='active')throw new Error('CONFLICT');tx.update(ref,{status:'completed',bagCount,bagWeightKgSnapshot:weight,outputKg:bagCount*weight,completedById:employee.id,completedByName:employee.name,completedAt:stamp()});});
   await audit('batch.finish',site,employee,{batchId,bagCount});return NextResponse.json({ok:true});
  }
 }
 throw new Error('NOT_FOUND');
}catch(e){return respond(e);}}

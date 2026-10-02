import 'server-only';
import {randomUUID} from 'node:crypto';
import {cert, getApps, initializeApp} from 'firebase-admin/app';
import {FieldValue, getFirestore, type Firestore} from 'firebase-admin/firestore';

export type Site = 'htl' | 'htw' | 'htft';
export const SITES: Site[] = ['htl', 'htw', 'htft'];
export const safeSite = (value: unknown): value is Site => typeof value === 'string' && SITES.includes(value as Site);
export const validSites = (value: unknown): value is Site[] => Array.isArray(value) && value.length > 0 && value.length <= 3 && value.every(safeSite) && new Set(value).size === value.length;
export const text = (value: unknown, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
export const operationalToday = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
export const stamp = () => FieldValue.serverTimestamp();
export const newId = () => randomUUID();

function required(name:string):string {
  const value=process.env[name];
  if(!value)throw new Error(`Missing server environment variable: ${name}`);
  return value;
}
export function db():Firestore {
  if (!getApps().length) {
    const config=JSON.parse(required('FIREBASE_SERVICE_ACCOUNT_KEY')) as {project_id:string;client_email:string;private_key:string};
    if(config.project_id !== required('NEXT_PUBLIC_FIREBASE_PROJECT_ID'))throw new Error('Firebase project mismatch');
    initializeApp({credential:cert({projectId:config.project_id, clientEmail:config.client_email, privateKey:config.private_key.replace(/\\n/g,'\n')})});
  }
  return getFirestore();
}

// TEMPORARY SAFETY BOUNDARY: local development ONLY. Never enable anonymous
// Firestore reads or writes on deployed Vercel. Replace with central auth later.
export function requireLocalDevelopment(request: Request):void {
  const host = new URL(request.url).hostname;
  if (process.env.NODE_ENV !== 'development' || (host !== 'localhost' && host !== '127.0.0.1')) throw new Error('AUTH_NOT_CONFIGURED');
  const origin=request.headers.get('origin');
  if(origin && new URL(origin).origin !== new URL(request.url).origin)throw new Error('FORBIDDEN');
}

export async function findEmployee(id:unknown,site:Site){
  if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw new Error('INVALID_EMPLOYEE');
  const snap=await db().collection('pc_staff').doc(id).get();
  const value=snap.data();
  if(!value||value.active!==true||!validSites(value.siteIds)||!value.siteIds.includes(site))throw new Error('INVALID_EMPLOYEE');
  return {id:snap.id,name:text(value.name),siteIds:value.siteIds};
}
export async function audit(action:string,siteId:Site,operator:{id:string;name:string},details:Record<string,unknown>){
  await db().collection('pc_audit').add({action,siteId,actorId:operator.id,actorName:operator.name,details,createdAt:stamp()});
}

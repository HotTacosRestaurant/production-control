import 'server-only';
import {createHmac, randomUUID, timingSafeEqual} from 'node:crypto';
import {cert, getApps, initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {FieldValue, getFirestore, type Firestore} from 'firebase-admin/firestore';
import {isSuperAdminEmail} from '@/lib/super-admin';

export type Site = 'htl' | 'htw' | 'htft';
export const SITES: Site[] = ['htl', 'htw', 'htft'];
export const safeSite = (value: unknown): value is Site => typeof value === 'string' && SITES.includes(value as Site);
export const validSites = (value: unknown): value is Site[] => Array.isArray(value) && value.length > 0 && value.length <= 3 && value.every(safeSite) && new Set(value).size === value.length;
export const text = (value: unknown, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
export const operationalToday = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Toronto', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
export const stamp = () => FieldValue.serverTimestamp();
export const newId = () => randomUUID();

const DEVICE_COOKIE = 'pc_station';
const DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

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

function isLocalDevelopment(request: Request): boolean {
  const host = new URL(request.url).hostname;
  return process.env.NODE_ENV === 'development' && (host === 'localhost' || host === '127.0.0.1');
}

export function requireSameOrigin(request: Request): void {
  const origin=request.headers.get('origin');
  if(origin && new URL(origin).origin !== new URL(request.url).origin)throw new Error('FORBIDDEN');
}

function cookieValue(request: Request, name: string): string {
  const raw=request.headers.get('cookie')??'';
  for(const item of raw.split(';')){
    const [key,...rest]=item.trim().split('=');
    if(key===name)return decodeURIComponent(rest.join('='));
  }
  return '';
}

function secureEqual(a:string,b:string):boolean {
  const left=Buffer.from(a);
  const right=Buffer.from(b);
  return left.length===right.length && timingSafeEqual(left,right);
}

function deviceSignature(payload:string):string {
  return createHmac('sha256',required('PC_DEVICE_SIGNING_KEY')).update(payload).digest('base64url');
}

export function createDeviceToken(siteId:Site):string {
  const exp=Math.floor(Date.now()/1000)+DEVICE_MAX_AGE_SECONDS;
  const payload=Buffer.from(JSON.stringify({siteId,exp})).toString('base64url');
  return `${payload}.${deviceSignature(payload)}`;
}

function verifyDeviceToken(token:string):{siteId:Site;exp:number}|null {
  const [payload,signature]=token.split('.');
  if(!payload||!signature)return null;
  const expected=deviceSignature(payload);
  if(!secureEqual(signature,expected))return null;
  try{
    const parsed=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')) as {siteId?:unknown;exp?:unknown};
    if(!safeSite(parsed.siteId)||typeof parsed.exp!=='number'||parsed.exp<=Math.floor(Date.now()/1000))return null;
    return {siteId:parsed.siteId,exp:parsed.exp};
  }catch{return null;}
}

export function deviceCookieConfig() {
  return {
    name: DEVICE_COOKIE,
    maxAge: DEVICE_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

export function verifyDeviceSetupKey(value:unknown):void {
  const supplied=typeof value==='string'?value:'';
  const expected=required('PC_DEVICE_SETUP_KEY');
  if(!supplied||!secureEqual(supplied,expected))throw new Error('INVALID_DEVICE_KEY');
}

export type DeviceAccess={siteId:Site|null;development:boolean};

export function requireDeviceAuthorization(request:Request):DeviceAccess {
  requireSameOrigin(request);
  if(isLocalDevelopment(request))return {siteId:null,development:true};
  const token=cookieValue(request,DEVICE_COOKIE);
  const parsed=token?verifyDeviceToken(token):null;
  if(!parsed)throw new Error('DEVICE_NOT_AUTHORIZED');
  return {siteId:parsed.siteId,development:false};
}

export function getDeviceStatus(request:Request):{authorized:boolean;siteId:Site|null;development:boolean} {
  try{
    const access=requireDeviceAuthorization(request);
    return {authorized:true,siteId:access.siteId,development:access.development};
  }catch{
    return {authorized:false,siteId:null,development:false};
  }
}

export function enforceDeviceSite(access:DeviceAccess,site:unknown):asserts site is Site {
  if(!safeSite(site))throw new Error('INVALID_SITE');
  if(access.siteId && access.siteId!==site)throw new Error('FORBIDDEN');
}

export async function requireSuperAdmin(request:Request):Promise<{uid:string;email:string}> {
  requireSameOrigin(request);
  const header=request.headers.get('authorization')??'';
  if(!header.startsWith('Bearer '))throw new Error('ADMIN_AUTH_REQUIRED');
  const token=header.slice(7).trim();
  if(!token)throw new Error('ADMIN_AUTH_REQUIRED');
  db();
  const decoded=await getAuth().verifyIdToken(token,true);
  const email=typeof decoded.email==='string'?decoded.email.trim().toLowerCase():'';
  if(!isSuperAdminEmail(email))throw new Error('SUPERADMIN_REQUIRED');

  // Role authorization is intentionally checked server-side. Authentication alone
  // is not enough to access Management Information. The role document is shared
  // with the administrative portal and never trusted from client-supplied data.
  const accessSnap=await db().collection('portal_users').doc(decoded.uid).get();
  const access=accessSnap.data();
  if(!accessSnap.exists||access?.active!==true||access?.role!=='admin')throw new Error('ADMIN_ROLE_REQUIRED');

  return {uid:decoded.uid,email};
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

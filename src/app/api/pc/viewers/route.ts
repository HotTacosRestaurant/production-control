import {NextRequest, NextResponse} from 'next/server';
import {randomUUID, randomBytes} from 'node:crypto';
import {getAuth, type UserRecord} from 'firebase-admin/auth';
import {FieldValue} from 'firebase-admin/firestore';
import {db, requireSuperAdmin} from '@/lib/pc-server';
import {isSuperAdminEmail} from '@/lib/super-admin';

export const runtime = 'nodejs';

const noStore = {'Cache-Control': 'private, no-store, max-age=0'};
type ViewerRecord = {id:string; email:string; name:string; active:boolean; role:'viewer'};

function fail(error:unknown) {
  const code = error instanceof Error ? error.message : 'SERVER_ERROR';
  const clientCodes = new Set([
    'ADMIN_AUTH_REQUIRED','SUPERADMIN_REQUIRED','ADMIN_ROLE_REQUIRED','FORBIDDEN',
    'INVALID_REQUEST','INVALID_NAME','INVALID_EMAIL','RESERVED_EMAIL',
    'USER_ALREADY_HAS_ROLE','VIEWER_NOT_FOUND','VIEWER_INACTIVE',
    'ACCOUNT_EMAIL_MISMATCH', 'AUTH_EMAIL_ALREADY_EXISTS', 'LIMIT_REACHED',
  ]);
  const status = code === 'ADMIN_AUTH_REQUIRED' ? 401 :
    ['SUPERADMIN_REQUIRED','ADMIN_ROLE_REQUIRED','FORBIDDEN'].includes(code) ? 403 :
    ['USER_ALREADY_HAS_ROLE','AUTH_EMAIL_ALREADY_EXISTS'].includes(code) ? 409 :
    ['VIEWER_NOT_FOUND'].includes(code) ? 404 :
    clientCodes.has(code) ? 400 : 500;
  if (!clientCodes.has(code)) console.error('PC viewer administration error:', error);
  return NextResponse.json({error:clientCodes.has(code) ? code : 'SERVER_ERROR'}, {status,headers:noStore});
}

function asObject(value:unknown): Record<string,unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_REQUEST');
  return value as Record<string,unknown>;
}
function nonEmptyString(value:unknown,max:number):string {
  return typeof value === 'string' ? value.trim().slice(0,max+1) : '';
}
function validEmail(value:unknown):string {
  const email = nonEmptyString(value,160).toLowerCase();
  if(email.length<3 || email.length>160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('INVALID_EMAIL');
  if(isSuperAdminEmail(email))throw new Error('RESERVED_EMAIL');
  return email;
}
function validName(value:unknown):string {
  const name=nonEmptyString(value,160);
  if(name.length<2||name.length>160)throw new Error('INVALID_NAME');
  return name;
}
function validUid(value:unknown):string {
  if(typeof value!=='string'|| !/^[A-Za-z0-9_-]{1,128}$/.test(value))throw new Error('INVALID_REQUEST');
  return value;
}

// Firestore Security Rules stay closed for PC collections: these endpoints
// use Firebase Admin only after server-side superadministrator authorization.
export async function GET(request:NextRequest) {
  try {
    await requireSuperAdmin(request);
    const snap=await db().collection('portal_users').where('role','==','viewer').limit(200).get();
    const viewers:ViewerRecord[]=snap.docs.map(doc=>{
      const d=doc.data();
      return {id:doc.id,email:String(d.email??''),name:String(d.name??''),active:d.active===true,role:'viewer'};
    }).sort((a,b)=>a.name.localeCompare(b.name,'es'));
    return NextResponse.json({viewers,limit:200}, {headers:noStore});
  } catch(error) {return fail(error);}
}

export async function POST(request:NextRequest) {
  try {
    const actor=await requireSuperAdmin(request);
    const body=asObject(await request.json());
    const action=body.action;
    const store=db();
    const auth=getAuth();

    if(action==='create') {
      const email=validEmail(body.email);
      const name=validName(body.name);
      let account:UserRecord|undefined;
      let newlyCreated=false;
      try {account=await auth.getUserByEmail(email);}
      catch(error) {
        if((error as {code?:string}).code!=='auth/user-not-found')throw error;
      }
      if(!account) {
        try {
          // Establish an unknown random password so Firebase Email/Password
          // provider is available for the user to set their own credential via
          // a one-time password-reset/setup link. Never return this password.
          const randomPassword=randomBytes(32).toString('base64url');
          account=await auth.createUser({email,displayName:name,password:randomPassword,disabled:false});
          newlyCreated=true;
        } catch(error) {
          if((error as {code?:string}).code==='auth/email-already-exists')throw new Error('AUTH_EMAIL_ALREADY_EXISTS');
          throw error;
        }
      }
      const target=store.collection('portal_users').doc(account.uid);
      try {
        await store.runTransaction(async tx=>{
          const existing=await tx.get(target);
          if(existing.exists)throw new Error('USER_ALREADY_HAS_ROLE');
          tx.create(target,{active:true,role:'viewer',email:account!.email!.toLowerCase(),name});
          tx.create(store.collection('pc_audit').doc(randomUUID()),{
            action:'viewer_created',actorUid:actor.uid,actorEmail:actor.email,
            targetUid:account!.uid,targetEmail:email,role:'viewer',
            existingFirebaseAccount:!newlyCreated,createdAt:FieldValue.serverTimestamp(),
          });
        });
      } catch(error) {
        // Compensate only when WE just created the Auth account. Never remove
        // an account that predated this management action.
        if(newlyCreated) {
          try {
            // Another concurrent request may have added the role meanwhile.
            // Never delete an Authentication user linked to a role document.
            if(!(await target.get()).exists)await auth.deleteUser(account.uid);
          } catch(cleanup) {console.error('Viewer auth rollback failed',cleanup);}
        }
        throw error;
      }
      let setupLink:string|undefined;
      let setupLinkError=false;
      if(newlyCreated) {
        try {setupLink=await auth.generatePasswordResetLink(email);}
        catch(error) {setupLinkError=true;console.error('Viewer setup link generation failed',error);}
      }
      return NextResponse.json({ok:true,id:account.uid,email,name,
        existingFirebaseAccount:!newlyCreated,setupLink,setupLinkError}, {headers:noStore});
    }

    if(action==='set-active') {
      const uid=validUid(body.uid);
      if(typeof body.active!=='boolean')throw new Error('INVALID_REQUEST');
      const active=body.active;
      const ref=store.collection('portal_users').doc(uid);
      await store.runTransaction(async tx=>{
        const snap=await tx.get(ref);
        if(!snap.exists || snap.data()?.role!=='viewer')throw new Error('VIEWER_NOT_FOUND');
        tx.update(ref,{active});
        tx.create(store.collection('pc_audit').doc(randomUUID()),{
          action:active?'viewer_enabled':'viewer_disabled',actorUid:actor.uid,
          actorEmail:actor.email,targetUid:uid,targetEmail:snap.data()?.email??'',
          createdAt:FieldValue.serverTimestamp(),
        });
      });
      // This affects only Production Control/portal role access, not other
      // Firebase applications using the same Authentication account.
      return NextResponse.json({ok:true}, {headers:noStore});
    }

    if(action==='reset-link') {
      const uid=validUid(body.uid);
      const snap=await store.collection('portal_users').doc(uid).get();
      const record=snap.data();
      if(!record || record.role!=='viewer')throw new Error('VIEWER_NOT_FOUND');
      if(record.active!==true)throw new Error('VIEWER_INACTIVE');
      const user=await auth.getUser(uid);
      const accountEmail=(user.email??'').toLowerCase();
      if(accountEmail!==String(record.email??'').toLowerCase()||isSuperAdminEmail(accountEmail))throw new Error('ACCOUNT_EMAIL_MISMATCH');
      const setupLink=await auth.generatePasswordResetLink(accountEmail);
      await store.collection('pc_audit').doc(randomUUID()).create({
        action:'viewer_password_reset_link',actorUid:actor.uid,actorEmail:actor.email,
        targetUid:uid,targetEmail:accountEmail,createdAt:FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ok:true,setupLink}, {headers:noStore});
    }
    throw new Error('INVALID_REQUEST');
  } catch(error) {return fail(error);}
}

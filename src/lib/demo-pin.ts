/** PROTOTYPE ONLY: browser-local verifier, not server authentication.
 * Never reuse this module for operational Firestore authorization.
 */
const STORAGE_KEY = 'pc-design-pin-verifiers-v1';
export const DEMO_ADMIN_PIN = '5769';
export const DEMO_ADMIN_ID = 'demo-admin';
export type DemoActor = { id: string; name: string; role: 'admin' | 'employee' };
type Verifier = { salt: string; digest: string };
type Registry = Record<string, Verifier>;
function read(): Registry {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Registry : {};
  } catch { return {}; }
}
async function digest(salt: string, pin: string) {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`);
  const hashed = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashed), b => b.toString(16).padStart(2,'0')).join('');
}
export async function assignDemoPin(employeeId: string, pin: string): Promise<void> {
  if (!/^\d{4,6}$/.test(pin) || pin === DEMO_ADMIN_PIN) throw new Error('INVALID_PIN');
  const entries = read();
  for(const [id, entry] of Object.entries(entries)) {
    if(id !== employeeId && await digest(entry.salt,pin) === entry.digest) throw new Error('DUPLICATE_PIN');
  }
  const salt = crypto.randomUUID();
  entries[employeeId] = {salt, digest:await digest(salt,pin)};
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}
export async function verifyDemoEmployee(pin:string, employees: {id:string;name:string;active:boolean}[]): Promise<DemoActor|null> {
  const entries=read();
  for (const emp of employees) {
    const verifier=entries[emp.id];
    if(emp.active && verifier && (await digest(verifier.salt,pin)) === verifier.digest) return {id:emp.id,name:emp.name,role:'employee'};
  }
  return null;
}

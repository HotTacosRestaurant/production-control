/** Shared backwards-compatible quantities. Stored weights always use kilograms. */
export function validRemainder(value: unknown, weight: number): number {
 const result=Number(value ?? 0);
 if(!Number.isFinite(result)||result<0||result>=weight)throw new Error('INVALID_PARTIAL_KG');
 return Math.round(result*1000)/1000;
}
export function quantityKg(bags: number, partialKg: number, weight: number): number {
 return Math.round((bags*weight+partialKg)*1000)/1000;
}
export function equivalentBags(outputKg:number, weight:number):number {
 return weight>0?Math.round(outputKg/weight*1000)/1000:0;
}
export function lineKg(line:{bagCount?:unknown;bagWeightKgSnapshot?:unknown;openKg?:unknown;partialKg?:unknown;totalKg?:unknown}):number {
 const calculated=quantityKg(Number(line.bagCount)||0,Number(line.openKg??line.partialKg??0)||0,Number(line.bagWeightKgSnapshot)||0);
 return Number.isFinite(calculated)?calculated:0;
}

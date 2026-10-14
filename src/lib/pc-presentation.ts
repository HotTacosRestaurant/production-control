/** Quantities inside a standard bag. Previous products default to kilograms. */
export const PACK_UNITS = [
 {id:'kg',es:'Kilogramos (kg)',en:'Kilograms (kg)'},
 {id:'g',es:'Gramos (g)',en:'Grams (g)'},
 {id:'lb',es:'Libras (lb)',en:'Pounds (lb)'},
 {id:'l',es:'Litros (L)',en:'Liters (L)'},
 {id:'ml',es:'Mililitros (mL)',en:'Milliliters (mL)'},
 {id:'unit',es:'Piezas',en:'Pieces'},
 {id:'portion',es:'Porciones',en:'Portions'},
] as const;
export type PackUnit=(typeof PACK_UNITS)[number]['id'];
export const isPackUnit=(v:unknown):v is PackUnit=>typeof v==='string'&&PACK_UNITS.some(x=>x.id===v);
export const packUnitLabel=(v:string)=>({kg:'kg',g:'g',lb:'lb',l:'L',ml:'mL',unit:'piezas',portion:'porciones'} as Record<string,string>)[v]??v;
export type Presentation={bagSize:number;bagUnit:PackUnit;bagWeightKg:number|null};
export function kgFactor(unit:string):number|null {return unit==='kg'?1:unit==='g'?0.001:unit==='lb'?0.45359237:null;}
export function asKg(qty:number,unit:string):number|null {const factor=kgFactor(unit);return factor===null?null:Math.round(qty*factor*1000)/1000;}
export function presentation(record:{bagSize?:unknown;bagUnit?:unknown;bagWeightKg?:unknown}):Presentation {
 const size=Number(record.bagSize??record.bagWeightKg??0);
 const unit=isPackUnit(record.bagUnit)?record.bagUnit:'kg';
 return {bagSize:size,bagUnit:unit,bagWeightKg:asKg(size,unit)};
}
export function validPartial(value:unknown,size:number):number {
 const qty=Number(value??0);
 if(!Number.isFinite(qty)||qty<0||qty>=size)throw new Error('INVALID_PARTIAL_AMOUNT');
 return Math.round(qty*1000)/1000;
}
export function productQuantity(bags:number,partial:number,size:number):number {
 return Math.round((bags*size+partial)*1000)/1000;
}

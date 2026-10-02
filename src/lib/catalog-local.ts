import type { SiteId, ProductCategory } from './production-model';

export type CatalogItemKind = 'finished' | 'ingredient';
export interface CatalogItem {
  id: string;
  name: string;
  kind: CatalogItemKind;
  category: ProductCategory | 'dairy' | 'vegetable' | 'seasoning' | 'other';
  bagWeightKg: number | null;
  active: boolean;
  siteIds: SiteId[];
}
export interface CatalogEmployee {
  id: string;
  name: string;
  active: boolean;
  siteIds: SiteId[];
}
export const DEFAULT_CATALOG: CatalogItem[] = [
  {id:'demo-birria',name:'Birria',kind:'finished',category:'protein',bagWeightKg:5,active:true,siteIds:['htl','htw']},
  {id:'demo-pastor',name:'Pastor',kind:'finished',category:'protein',bagWeightKg:5,active:true,siteIds:['htl','htw','htft']},
  {id:'demo-lengua',name:'Lengua',kind:'finished',category:'protein',bagWeightKg:4,active:true,siteIds:['htl']},
  {id:'demo-cabeza',name:'Cabeza',kind:'finished',category:'protein',bagWeightKg:2,active:true,siteIds:['htl','htw']},
  {id:'demo-borrego',name:'Borrego',kind:'ingredient',category:'protein',bagWeightKg:null,active:true,siteIds:['htl','htw']},
  {id:'demo-queso',name:'Queso',kind:'ingredient',category:'dairy',bagWeightKg:null,active:true,siteIds:['htl','htw','htft']},
  {id:'demo-crema',name:'Crema',kind:'ingredient',category:'dairy',bagWeightKg:null,active:true,siteIds:['htl','htw','htft']},
];
export const DEFAULT_EMPLOYEES: CatalogEmployee[] = [];

export function searchCatalog<T extends {name:string;active:boolean;siteIds:SiteId[]}>(items:T[], query:string, site:SiteId):T[] {
  const normalized = query.trim().toLocaleLowerCase();
  return items.filter(item => item.active && item.siteIds.includes(site) && item.name.toLocaleLowerCase().includes(normalized)).sort((a,b)=>a.name.localeCompare(b.name));
}

import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest{return {name:'Hot Tacos Production Control',short_name:'HT Production',description:'Inventory and kitchen production / Inventarios y producción',start_url:'/',display:'standalone',background_color:'#f6f8fb',theme_color:'#17365b',icons:[{src:'/favicon.ico',sizes:'any',type:'image/x-icon'}]};}

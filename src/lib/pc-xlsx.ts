/** Minimal dependency-free OOXML .xlsx writer for modest management exports. */
import {deflateRawSync} from 'node:zlib';
type Row=Array<string|number|null|undefined>;
const xml=(v:string)=>v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function crc32(b:Buffer){let crc=0xffffffff;for(const val of b){crc^=val;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function zip(files:Array<{name:string;body:string}>):Buffer{
 const locals:Buffer[]=[],directory:Buffer[]=[];let offset=0;
 for(const file of files){const name=Buffer.from(file.name),data=Buffer.from(file.body,'utf8'),packed=deflateRawSync(data),crc=crc32(data);
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0,6);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
  locals.push(local,name,packed);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0,8);central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(packed.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);directory.push(central,name);
  offset+=local.length+name.length+packed.length;
 }
 const directoryLength=directory.reduce((s,b)=>s+b.length,0);const footer=Buffer.alloc(22);footer.writeUInt32LE(0x06054b50,0);footer.writeUInt16LE(files.length,8);footer.writeUInt16LE(files.length,10);footer.writeUInt32LE(directoryLength,12);footer.writeUInt32LE(offset,16);
 return Buffer.concat([...locals,...directory,footer]);
}
function letters(i:number){let col='';for(let x=i+1;x>0;x=Math.floor((x-1)/26))col=String.fromCharCode(65+(x-1)%26)+col;return col;}
function sheetXml(rows:Row[]){let all='';for(let i=0;i<rows.length;i++){
 const cells=rows[i].map((value,j)=>{if(value===null||value===undefined)return '';const cell=`${letters(j)}${i+1}`;
  if(typeof value==='number'&&Number.isFinite(value))return `<c r="${cell}"><v>${value}</v></c>`;
  return `<c r="${cell}" t="inlineStr"><is><t xml:space="preserve">${xml(String(value))}</t></is></c>`;}).join('');all+=`<row r="${i+1}">${cells}</row>`;
 }
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${all}</sheetData></worksheet>`;}
export function workbook(sheets:Array<{name:string;rows:Row[]}>):Buffer{
 const safe=sheets.map((s,i)=>({...s,name:s.name.slice(0,31).replace(/[\\\[\]*?:/]/g,'_')||`Hoja${i+1}`}));
 const types=['<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>','<Default Extension="xml" ContentType="application/xml"/>','<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',...safe.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)];
 const files=[{name:'[Content_Types].xml',body:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${types.join('')}</Types>`},
 {name:'_rels/.rels',body:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
 {name:'xl/workbook.xml',body:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${safe.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`},
 {name:'xl/_rels/workbook.xml.rels',body:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${safe.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`},...safe.map((s,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,body:sheetXml(s.rows)}))];
 return zip(files);
}

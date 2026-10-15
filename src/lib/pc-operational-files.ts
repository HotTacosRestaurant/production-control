/** Dependency-free Excel and ZIP exports; no mutation of Firestore. */
import {deflateRawSync} from 'node:zlib';

export type ReportCell=string|number|null|undefined|{formula:string};
export type ReportSheet={name:string;headers:string[];rows:ReportCell[][];editable?:number[]};
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const col=(i:number)=>{let s='';for(let n=i+1;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
function crc32(buffer:Buffer){let crc=0xffffffff;for(const b of buffer){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export function zipExport(files:{name:string;content:string|Buffer}[]):Buffer{
 const local:Buffer[]=[],central:Buffer[]=[];let offset=0;
 for(const file of files){const name=Buffer.from(file.name,'utf8'),body=typeof file.content==='string'?Buffer.from(file.content,'utf8'):file.content;
  const compressed=deflateRawSync(body),crc=crc32(body);
  // DOS date fields must be valid: 1980-01-01 (time 00:00:00).
  // Zero is not a valid DOS date and can trigger Office repair warnings.
  const dosTime=0, dosDate=0x0021;
  const a=Buffer.alloc(30);a.writeUInt32LE(0x04034b50,0);a.writeUInt16LE(20,4);a.writeUInt16LE(8,8);a.writeUInt16LE(0x0800,6);a.writeUInt16LE(dosTime,10);a.writeUInt16LE(dosDate,12);a.writeUInt32LE(crc,14);a.writeUInt32LE(compressed.length,18);a.writeUInt32LE(body.length,22);a.writeUInt16LE(name.length,26);
  local.push(a,name,compressed);
  const b=Buffer.alloc(46);b.writeUInt32LE(0x02014b50,0);b.writeUInt16LE(20,4);b.writeUInt16LE(20,6);b.writeUInt16LE(0x0800,8);b.writeUInt16LE(8,10);b.writeUInt16LE(dosTime,12);b.writeUInt16LE(dosDate,14);b.writeUInt32LE(crc,16);b.writeUInt32LE(compressed.length,20);b.writeUInt32LE(body.length,24);b.writeUInt16LE(name.length,28);b.writeUInt32LE(offset,42);
  central.push(b,name);offset+=a.length+name.length+compressed.length;
 }
 const len=central.reduce((sum,b)=>sum+b.length,0),footer=Buffer.alloc(22);footer.writeUInt32LE(0x06054b50,0);footer.writeUInt16LE(files.length,8);footer.writeUInt16LE(files.length,10);footer.writeUInt32LE(len,12);footer.writeUInt32LE(offset,16);
 return Buffer.concat([...local,...central,footer]);
}
const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Aptos"/><color rgb="FF1C3950"/></font><font><b/><sz val="11"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF215B7B"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF3CD"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="hair"><color rgb="FFD9E4EA"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/></cellXfs>
</styleSheet>`;
function tab(sheet:ReportSheet){
 const rows=[sheet.headers,...sheet.rows];const cols=sheet.headers.map((heading,j)=>{
  const sample=rows.slice(1,40).reduce((w,r)=>Math.max(w,Math.min(40,String(typeof r[j]==='object'?'':r[j]??'').length)),heading.length);
  return Math.min(36,Math.max(11,sample+2));
 });
 const widths=`<cols>${cols.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
 const body=rows.map((r,idx)=>`<row r="${idx+1}" ht="${idx===0?24:20}" customHeight="1">${r.map((v,j)=>{
  if(v===null||v===undefined)return '';
  const ref=col(j)+(idx+1),style=idx===0?1:sheet.editable?.includes(j)?2:0;
  if(typeof v==='object'&&'formula' in v)return `<c r="${ref}" s="3"><f>${esc(v.formula.replace(/^=/,''))}</f></c>`;
  if(typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
  // Inline strings are written as literal text, not evaluated as Excel formulas.
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
 }).join('')}</row>`).join('');
 const last=col(sheet.headers.length-1);
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}${rows.length}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/>${widths}<sheetData>${body}</sheetData><autoFilter ref="A1:${last}${Math.max(1,rows.length)}"/></worksheet>`;
}
export function operationalWorkbook(sheets:ReportSheet[]):Buffer{
 const clean=sheets.map((s,i)=>({...s,name:s.name.replace(/[\\[\]*?:/]/g,'_').slice(0,31)||`Hoja${i+1}`}));
 const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${clean.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
 return zipExport([{name:'[Content_Types].xml',content:contentTypes},{name:'_rels/.rels',content:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},{name:'xl/styles.xml',content:styles},{name:'xl/workbook.xml',content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${clean.map((s,i)=>`<sheet name="${esc(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`},{name:'xl/_rels/workbook.xml.rels',content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${clean.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${clean.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},...clean.map((s,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,content:tab(s)}))]);
}
export function csvExport(headers:string[],rows:ReportCell[][]):string{
 const quote=(value:ReportCell)=>{const str=value===null||value===undefined?'':typeof value==='object'?'':String(value);
  // CSV is plain text. Prefix unsafe formulas even when initially opened in Excel.
  const safe=typeof value==='string'&&/^[\s\x00-\x1f]*[=+@-]/.test(str)?`'${str}`:str;
  return `"${safe.replace(/"/g,'""')}"`;};
 return '\ufeff'+[headers,...rows].map(r=>r.map(quote).join(',')).join('\r\n')+'\r\n';
}

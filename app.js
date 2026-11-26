'use strict';
const forms = [
  {title:'Script context', fields:['Premise','Beats','What I like','What I dislike or want help with']},
  {title:'Film shot list', item:'Shot', fields:['Detailed description','Planned framing and action','Who is in the shot','Lighting','Cut or alternate coverage']},
  {title:'Character notes', item:'Character', fields:['Character name','Who they are','How they speak and play']},
  {title:'Staging directions', item:'Moment', fields:['Positions','Who or what is onstage','Movement','Transition']}
];
const lineFields = ['Script line','Direction'];
const storageKey = location.pathname.replace(/index\.html$/,'') + 'sketch-production-v1';
const today = new Date();
let data = {meta:{Date:[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-')}, records:[ [{}],[{}],[{}],[{}] ],active:0};
const statusNode = document.querySelector('#status');
try {
  const saved = localStorage.getItem(storageKey);
  if (saved) data = JSON.parse(saved);
} catch { statusNode.textContent = 'Draft storage unavailable'; }
function save(){
  try {localStorage.setItem(storageKey,JSON.stringify(data));statusNode.textContent='';}
  catch {statusNode.textContent='Unable to save in this browser';}
}
function element(tag,parent,text){
  const node=document.createElement(tag);
  if(text!==undefined) node.textContent=text;
  parent.append(node);
  return node;
}
function button(parent,label,click){
  const node=element('button',parent,label);
  node.onclick=click;
  return node;
}
function field(parent,record,key,type){
  const label=element('label',parent,key);
  const input=element(type?'input':'textarea',label);
  if(type) input.type=type;
  input.value=record[key]||'';
  input.oninput=()=>{record[key]=input.value;save();};
}
function change(action){action();save();render();}
function ordering(parent,list,index,item){
  const bar=element('div',parent);bar.className='tools';
  for(const [label,offset] of [['Move up',-1],['Move down',1]]){
    const target=index+offset;
    const move=button(bar,label,()=>change(()=>{
      [list[index],list[target]]=[list[target],list[index]];
    }));
    move.disabled=target<0||target>=list.length;
  }
  button(bar,'Remove',()=>{if(confirm('Remove '+item.toLowerCase()+' '+(index+1)+'?')) change(()=>list.splice(index,1));});
  return bar;
}
function render(){
  const form=forms[data.active];
  document.querySelector('#form-title').textContent=form.title;
  const details=document.querySelector('#details');details.replaceChildren();
  for(const key of ['Sketch title','Author','Date']) field(details,data.meta,key,key==='Date'?'date':'text');
  const fields=document.querySelector('#fields');fields.replaceChildren();
  const records=data.records[data.active];
  records.forEach((record,index)=>{
    const card=element('section',fields);card.className='card';
    element('h2',card,form.item?form.item+' '+(index+1):'Writer’s notes');
    form.fields.forEach(key=>field(card,record,key,key==='Character name'?'text':null));
    if(data.active===2){
      const lines=record.lines??=[];
      element('h3',card,'Lines and direction');
      lines.forEach((line,i)=>{
        const block=element('div',card);block.className='line';
        element('h3',block,'Line '+(i+1));lineFields.forEach(key=>field(block,line,key));
        ordering(block,lines,i,'Line');
      });
      button(card,'Add line',()=>change(()=>lines.push({})));
    }
    if(form.item){
      const bar=ordering(card,records,index,form.item);
      if(data.active===2) button(bar,'Download character PDF',()=>exportForm(index));
    }
  });
  if(form.item) button(fields,'Add '+form.item.toLowerCase(),()=>change(()=>records.push({})));
}
let selected;
function buildPrint(){
  const out=document.querySelector('#print');out.replaceChildren();
  const form=forms[data.active];
  element('h1',out,data.meta['Sketch title']||'Untitled sketch');
  element('h2',out,form.title);
  element('p',out,'Author: '+(data.meta.Author||'—')+'    Date: '+(data.meta.Date||'—'));
  function note(record,key){
    element('h4',out,key);element('p',out,record[key]||'—');
  }
  data.records[data.active].forEach((record,i)=>{
    if(selected!==undefined&&selected!==i) return;
    if(form.item) element('h2',out,form.item+' '+(i+1)+(record['Character name']?' · '+record['Character name']:''));
    form.fields.filter(key=>key!=='Character name').forEach(key=>note(record,key));
    (record.lines||[]).forEach((line,i)=>{
      element('h3',out,'Line '+(i+1));lineFields.forEach(key=>note(line,key));
    });
  });
}
const fileInput=document.querySelector('#script-file');
const include=document.querySelector('#include');
const fileStatus=document.querySelector('#file-status');
let attachment, selection=0;
fileInput.onchange=async()=>{
  const version=++selection;
  attachment=null;
  include.checked=false;
  document.querySelector('#include-label').hidden=true;
  const file=fileInput.files[0];
  fileStatus.textContent=file?'Checking PDF…':'';
  if(!file) return;
  try {
    const bytes=await file.arrayBuffer();
    const pdf=await PDFLib.PDFDocument.load(bytes,{throwOnInvalidObject:true});
    if(!pdf.getPageCount()) throw Error('Empty PDF');
    // Validate that every page can be copied before offering a combined export.
    const test=await PDFLib.PDFDocument.create();
    await test.copyPages(pdf,pdf.getPageIndices());
    if(version!==selection) return;
    attachment=pdf;
    include.checked=true;
    document.querySelector('#include-label').hidden=false;
    fileStatus.textContent=pdf.getPageCount()+' script page(s) attached for this session.';
  } catch {
    if(version!==selection) return;
    fileInput.value='';
    fileStatus.textContent='Could not read this PDF. Choose an unlocked PDF or download the form on its own.';
  }
};
function filenamePart(value, fallback){
  const clean=String(value??'').trim().replace(/\s+/g,'_').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,'_').replace(/^\.+|\.+$/g,'');
  return clean || fallback;
}
function exportFilename(meta,form,character){
  return [
    filenamePart(meta['Sketch title'],'Untitled_sketch'),
    filenamePart(meta.Author,'Unknown_author'),
    filenamePart(meta.Date,'Undated'),
    filenamePart(form.title,'Notes'),
    character===null?null:filenamePart(character,'Character')
  ].filter(part=>part!==null).join('-')+'.pdf';
}
async function exportForm(index){
  const form=forms[data.active], records=data.records[data.active], meta=data.meta;
  const script=include.checked?attachment:null;
  const title=meta['Sketch title']||'Untitled sketch';
  const character=index===undefined?null:(records[index]['Character name']?.trim()||'Character '+(index+1));
  const name=[title,form.title,character].filter(Boolean).join(' - ');
  const rule=()=>({canvas:[{type:'line',x1:0,y1:0,x2:512,y2:0,lineWidth:0.6,lineColor:'#BDBDBD'}],margin:[0,0,0,0]});
  const field=(label,value,options={})=>({stack:[
    {text:label,style:'fieldLabel',headlineLevel:1},
    {text:value||'—',style:options.italic?'dialogue':'body',margin:[0,3,0,0]}
  ],margin:[0,0,0,10]});
  const pair=(a,b)=>({columns:[{width:'*',...a},{width:'*',...b}],columnGap:24});
  const band=text=>({
    table:{widths:['*'],body:[[{text,style:'sectionHeading',fillColor:'#F3F3F3'}]]},layout:{
      hLineWidth:i=>i===0?0.6:0,hLineColor:()=> '#BDBDBD',vLineWidth:()=>0,
      paddingLeft:()=>10,paddingRight:()=>10,paddingTop:()=>7,paddingBottom:()=>7
    },margin:[0,10,0,9],headlineLevel:1
  });
  // Keep very long or multiline answers full width for predictable page flow.
  const short=value=>!value||(value.length<=160&&!value.includes('\n'));
  const rows=(record,a,b)=>short(record[a])&&short(record[b])
    ? [pair(field(a,record[a]),field(b,record[b]))]
    : [field(a,record[a]),field(b,record[b])];
  const content=[
    {text:form.title,style:'formType'},
    {text:title,style:'title'},rule(),
    {columns:[
      {width:'*',...field('Author',meta.Author)},
      {width:150,...field('Date',meta.Date)}
    ],columnGap:24,margin:[0,11,0,2]},
    rule(),{text:' ',fontSize:2,margin:[0,0,0,7]}
  ];
  const sequence=n=>String(n+1).padStart(2,'0');
  records.forEach((record,i)=>{
    if(index!==undefined&&index!==i) return;
    if(!form.item){
      for(const key of form.fields) content.push(band(key),{text:record[key]||'—',style:'body',margin:[0,0,0,10]});
      return;
    }
    const characterName=record['Character name']?.trim();
    const heading=form.item+' '+sequence(i)+(characterName?' / '+characterName:'');
    content.push(band(heading));
    const [a,b,c,d,e]=form.fields;
    if(form.item==='Shot') content.push(field(a,record[a]),...rows(record,b,c),...rows(record,d,e));
    if(form.item==='Moment') content.push(...rows(record,a,b),...rows(record,c,d));
    if(form.item==='Character') {
      content.push(...rows(record,b,c));
      (record.lines||[]).forEach((line,j)=>{
        content.push(rule(),{text:'Line '+(j+1),style:'fieldLabel',margin:[0,8,0,4],headlineLevel:1},
          {text:line['Script line']||'—',style:'dialogue',margin:[0,0,0,5]},
          {text:line.Direction||'—',style:'body',margin:[0,0,0,10]});
      });
    }
  });
  try {
    const definition={
      info:{title:name},pageSize:'LETTER',pageMargins:[50,49,50,51],content,
      defaultStyle:{fontSize:11,color:'#171717',lineHeight:1.2},
      styles:{
        formType:{fontSize:11,bold:true,color:'#484848',margin:[0,0,0,8]},
        title:{fontSize:29,bold:true,margin:[0,0,0,12]},
        sectionHeading:{fontSize:11,bold:true},
        fieldLabel:{fontSize:9,bold:true,color:'#484848'},
        body:{fontSize:11},
        dialogue:{fontSize:11,italics:true}
      },
      footer:(page,count)=>({width:512,margin:[50,6,50,0],stack:[
        {canvas:[{type:'line',x1:0,y1:0,x2:512,y2:0,lineWidth:0.6,lineColor:'#BDBDBD'}]},
        {columns:[{text:title+' / '+form.title,fontSize:8,color:'#484848',width:'*',maxHeight:18},{text:page+' / '+count,fontSize:8,color:'#484848',width:43,alignment:'right'}],columnGap:12,margin:[0,8,0,0]}
      ]}),
      pageBreakBefore:(node,following)=>node.headlineLevel===1&&!following.length
    };
    let bytes=await new Promise((resolve,reject)=>pdfMake.createPdf(definition).getBuffer(resolve));
    if(script){
      const packet=await PDFLib.PDFDocument.load(bytes);
      for(const page of await packet.copyPages(script,script.getPageIndices())) packet.addPage(page);
      bytes=await packet.save();
    }
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
    const link=element('a',document.body);link.href=url;link.download=exportFilename(meta,form,character);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    fileStatus.textContent='PDF downloaded.';
  } catch {fileStatus.textContent=script?'Could not create the packet. Uncheck “Include script in PDF” to download the form separately.':'Could not generate the PDF. Use your browser’s Print command to save the form.';}
}
window.addEventListener('beforeprint',buildPrint);
window.addEventListener('afterprint',()=>{selected=undefined;});
document.querySelector('#pdf').onclick=()=>exportForm();
const routes=['script-context','shot-list','character-notes','staging-directions'];
forms.forEach((form,i)=>{
  const link=element('a',document.querySelector('#home nav'),form.title);
  link.href='#'+routes[i];
});
function route(){
  const index=routes.indexOf(location.hash.slice(1));
  document.querySelector('#home').hidden=index>=0;
  document.querySelector('.layout').hidden=index<0;
  if(index>=0){data.active=index;render();}
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);
route();

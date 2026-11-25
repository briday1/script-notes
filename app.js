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
  try {localStorage.setItem(storageKey,JSON.stringify(data));statusNode.textContent='Saved in this browser';}
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
async function exportForm(index){
  const form=forms[data.active], records=data.records[data.active], meta=data.meta;
  const script=include.checked?attachment:null;
  const title=meta['Sketch title']||'Untitled sketch';
  const name=[title,form.title,index!==undefined?(records[index]['Character name']||'Character '+(index+1)):null].filter(Boolean).join(' - ');
  const content=[{text:title,fontSize:24,bold:true},{text:form.title,fontSize:16,margin:[0,4,0,8]},
    {text:'Author: '+(meta.Author||'—')+'    Date: '+(meta.Date||'—')}];
  function note(record,key){
    // Keep each label with its first line while allowing a long answer to flow.
    content.push({text:key,bold:true,margin:[0,9,0,2],headlineLevel:1},{text:record[key]||'—'});
  }
  records.forEach((record,i)=>{
    if(index!==undefined&&index!==i) return;
    if(form.item) content.push({text:form.item+' '+(i+1)+(record['Character name']?' · '+record['Character name']:''),fontSize:16,bold:true,margin:[0,14,0,0],headlineLevel:1});
    form.fields.filter(key=>key!=='Character name').forEach(key=>note(record,key));
    (record.lines||[]).forEach((line,j)=>{
      content.push({text:'Line '+(j+1),fontSize:13,bold:true,margin:[0,10,0,0],headlineLevel:1});
      lineFields.forEach(key=>note(line,key));
    });
  });
  try {
    const definition={info:{title:name},pageSize:'LETTER',pageMargins:[50,46,50,48],content,defaultStyle:{fontSize:11,lineHeight:1.2},
      footer:(page,count)=>({text:page+' / '+count,alignment:'right',margin:[0,12,50,0],fontSize:9}),
      pageBreakBefore:(node,following)=>node.headlineLevel===1&&!following.length};
    let bytes=await new Promise((resolve,reject)=>pdfMake.createPdf(definition).getBuffer(resolve));
    if(script){
      const packet=await PDFLib.PDFDocument.load(bytes);
      for(const page of await packet.copyPages(script,script.getPageIndices())) packet.addPage(page);
      bytes=await packet.save();
    }
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
    const link=element('a',document.body);link.href=url;link.download=name.replace(/[^a-zA-Z0-9._ -]/g,'_')+'.pdf';link.click();link.remove();
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

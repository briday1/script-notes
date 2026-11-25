'use strict';
const forms = [
  {title:'Sketch submission', fields:['Premise','Beats','What I like','What I dislike or want help with']},
  {title:'Film shot list', item:'Shot', fields:['Detailed description','Planned framing and action','Who is in the shot','Lighting','Cut or alternate coverage']},
  {title:'Character notes', item:'Character', fields:['Character name','Who they are','How they speak and play']},
  {title:'Stage blocking', item:'Moment', fields:['Positions','Who or what is onstage','Movement','Transition']}
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
  const nav=document.querySelector('nav');nav.replaceChildren();
  forms.forEach((f,i)=>{
    const tab=button(nav,f.title,()=>change(()=>{data.active=i;}));
    if(i===data.active) tab.setAttribute('aria-current','page');
  });
  document.querySelector('h1').textContent=form.title;
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
      if(data.active===2) button(bar,'Print character PDF',()=>exportForm(index));
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
function exportForm(index){selected=index;buildPrint();window.print();}
window.addEventListener('beforeprint',buildPrint);
window.addEventListener('afterprint',()=>{selected=undefined;});
document.querySelector('#pdf').onclick=()=>exportForm();
render();

import { useMemo, useState } from 'react'
import { AlertTriangle, Baseline, ChevronLeft, ChevronRight, Diamond, GitBranch, Save } from 'lucide-react'

const MS=86400000
const localDate=value=>{if(!value)return null;const [y,m,d]=String(value).slice(0,10).split('-').map(Number);return new Date(y,m-1,d)}
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const add=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n)
const days=(a,b)=>Math.round((localDate(b)-localDate(a))/MS)
const duration=task=>task.is_milestone?0:Math.max(1,(task.start_date&&task.due_date?days(task.start_date,task.due_date)+1:1))

function analyse(rows){
  const byId=new Map(rows.map(task=>[task.id,task])), memo=new Map(), visiting=new Set()
  function calculate(task){
    if(memo.has(task.id))return memo.get(task.id)
    if(visiting.has(task.id)){const fallback={...task,calcStart:localDate(task.start_date)||new Date(),calcEnd:localDate(task.due_date)||new Date(),duration:duration(task),pathLength:duration(task)};memo.set(task.id,fallback);return fallback}
    visiting.add(task.id)
    const ownStart=localDate(task.start_date)||new Date(),span=duration(task),pred=byId.get(task.predecessor_id),lag=Number(task.lag_days)||0
    let start=ownStart,pathLength=span
    if(pred){const p=calculate(pred),type=task.dependency_type||'FS';let driven
      if(type==='SS')driven=add(p.calcStart,lag)
      else if(type==='FF')driven=add(p.calcEnd,lag-span+1)
      else if(type==='SF')driven=add(p.calcStart,lag-span+1)
      else driven=add(p.calcEnd,lag+1)
      if(driven>start)start=driven
      pathLength=p.pathLength+Math.max(0,lag)+span
    }
    const result={...task,duration:span,calcStart:start,calcEnd:task.is_milestone?start:add(start,span-1),pathLength}
    visiting.delete(task.id);memo.set(task.id,result);return result
  }
  const tasks=rows.map(calculate).sort((a,b)=>String(a.wbs_code||'').localeCompare(String(b.wbs_code||''),undefined,{numeric:true}))
  const critical=new Set();let current=[...tasks].sort((a,b)=>b.pathLength-a.pathLength)[0]
  while(current){critical.add(current.id);current=memo.get(current.predecessor_id)}
  return {tasks:tasks.map(t=>({...t,critical:critical.has(t.id)})),critical}
}

function overloads(tasks,team){
  return team.map(person=>{
    const assigned=tasks.filter(task=>task.assignee===person.name&&task.calcStart&&task.calcEnd)
    let peak=0
    assigned.forEach(task=>{for(let day=new Date(task.calcStart);day<=task.calcEnd;day=add(day,1)){const load=assigned.filter(other=>day>=other.calcStart&&day<=other.calcEnd).reduce((sum,other)=>sum+(Number(other.work_hours)||other.duration*8)/Math.max(1,other.duration),0);peak=Math.max(peak,load)}})
    const capacity=Math.max(.1,(Number(person.availability)||100)/100*8)
    return {...person,peak:Math.round(peak/capacity*100),overloaded:peak>capacity}
  }).filter(person=>person.overloaded)
}

export default function GanttView({rows,team,onSetBaseline}){
  const [dayWidth,setDayWidth]=useState(24)
  const {tasks}=useMemo(()=>analyse(rows),[rows])
  const dated=tasks.filter(t=>t.calcStart&&t.calcEnd)
  const rangeStart=dated.length?new Date(Math.min(...dated.flatMap(t=>[t.calcStart,localDate(t.baseline_start)||t.calcStart]))):new Date()
  const rangeEnd=dated.length?new Date(Math.max(...dated.flatMap(t=>[t.calcEnd,localDate(t.baseline_end)||t.calcEnd]))):add(rangeStart,30)
  const start=add(rangeStart,-3),end=add(rangeEnd,5),total=Math.max(20,days(iso(start),iso(end))+1),width=total*dayWidth
  const critical=tasks.filter(t=>t.critical).length,milestones=tasks.filter(t=>t.is_milestone).length,overallocated=overloads(tasks,team)
  const baselineCount=tasks.filter(t=>t.baseline_start&&t.baseline_end).length
  return <div className="gantt-wrap">
    <div className="schedule-insights">
      <div><GitBranch size={17}/><span><b>{critical}</b> activités sur le chemin critique</span></div>
      <div><Diamond size={17}/><span><b>{milestones}</b> jalons</span></div>
      <div className={overallocated.length?'alert':''}><AlertTriangle size={17}/><span><b>{overallocated.length}</b> ressources en surcharge</span></div>
      <button className="btn ghost" onClick={onSetBaseline}><Save size={15}/>{baselineCount?'Actualiser la référence':'Définir la référence'}</button>
    </div>
    {overallocated.length>0&&<div className="overload-banner"><AlertTriangle size={17}/><div><b>Surcharge détectée</b><span>{overallocated.map(p=>`${p.name} (${p.peak} %)`).join(' · ')}</span></div></div>}
    <div className="gantt-toolbar"><div><Baseline size={16}/><span>Trait fin = référence · rouge = chemin critique</span></div><div><button onClick={()=>setDayWidth(Math.max(14,dayWidth-4))}><ChevronLeft size={15}/></button><span>Zoom</span><button onClick={()=>setDayWidth(Math.min(42,dayWidth+4))}><ChevronRight size={15}/></button></div></div>
    <div className="gantt card">
      <div className="gantt-table">
        <div className="gantt-list-head"><span>WBS</span><span>Activité</span><span>Durée</span><span>Préd.</span></div>
        {tasks.map(task=><div className={`gantt-list-row ${task.critical?'critical':''}`} key={task.id}><span>{task.wbs_code||'—'}</span><span title={task.title}>{task.is_milestone&&<i className="mini-diamond"/>}{task.title}</span><span>{task.is_milestone?'Jalon':`${task.duration} j`}</span><span>{task.predecessor_id?(tasks.find(t=>t.id===task.predecessor_id)?.wbs_code||'—')+(task.dependency_type||'FS')+(Number(task.lag_days)?`${Number(task.lag_days)>0?'+':''}${task.lag_days}j`:''):'—'}</span></div>)}
      </div>
      <div className="gantt-scroll"><div className="gantt-canvas" style={{width}}>
        <div className="gantt-scale">{Array.from({length:total},(_,i)=>{const d=add(start,i);return <div key={i} className={d.getDay()===0||d.getDay()===6?'weekend':''} style={{width:dayWidth}}><span>{d.getDate()===1||i===0?new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short'}).format(d):d.getDate()}</span></div>})}</div>
        <svg className="dependency-lines" width={width} height={tasks.length*44}>{tasks.map((task,index)=>{if(!task.predecessor_id)return null;const pi=tasks.findIndex(t=>t.id===task.predecessor_id);if(pi<0)return null;const pred=tasks[pi],x1=(days(iso(start),iso(pred.calcEnd))+1)*dayWidth,x2=days(iso(start),iso(task.calcStart))*dayWidth,y1=22+pi*44,y2=22+index*44,mid=Math.min(x1+10,Math.max(x1,x2-8));return <polyline key={task.id} points={`${x1},${y1} ${mid},${y1} ${mid},${y2} ${x2},${y2}`} className={task.critical?'critical':''}/>})}</svg>
        <div className="gantt-rows">{tasks.map(task=>{const left=days(iso(start),iso(task.calcStart))*dayWidth,barWidth=Math.max(7,(task.duration||1)*dayWidth-3),bStart=localDate(task.baseline_start),bEnd=localDate(task.baseline_end);return <div className="gantt-time-row" key={task.id} style={{width}}>{task.is_milestone?<div className={`gantt-milestone ${task.critical?'critical':''}`} style={{left:left+2}}/>:<div className={`gantt-bar ${task.critical?'critical':''}`} style={{left,width:barWidth,backgroundColor:task.critical?undefined:task.color}} title={`${task.title} · ${iso(task.calcStart)} → ${iso(task.calcEnd)}`}><i style={{width:`${task.progress||0}%`}}/><span>{task.title}</span></div>}{bStart&&bEnd&&<div className="baseline-bar" style={{left:days(iso(start),iso(bStart))*dayWidth,width:Math.max(5,(days(iso(bStart),iso(bEnd))+1)*dayWidth-3)}}/>}</div>})}</div>
      </div></div>
    </div>
  </div>
}

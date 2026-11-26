import { useMemo, useState } from 'react'
import { AlertTriangle, Baseline, ChevronLeft, ChevronRight, Diamond, GitBranch, Save } from 'lucide-react'

const MS=86400000
const localDate=value=>{if(!value)return null;const [y,m,d]=String(value).slice(0,10).split('-').map(Number);return new Date(y,m-1,d)}
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const add=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n)
const days=(a,b)=>Math.round((localDate(b)-localDate(a))/MS)
function calendarRules(calendar){return {working:new Set(String(calendar?.working_days||'1,2,3,4,5').split(',').map(Number)),holidays:new Set(String(calendar?.holidays||'').split(/[\s,;]+/).filter(Boolean)),hours:Number(calendar?.hours_per_day)||8}}
const isWorking=(date,rules)=>rules.working.has(date.getDay())&&!rules.holidays.has(iso(date))
function nextWorking(date,rules,direction=1){let result=new Date(date),guard=0;while(!isWorking(result,rules)&&guard++<370)result=add(result,direction);return result}
function moveWorking(date,count,rules){let result=nextWorking(date,rules,count<0?-1:1),remaining=Math.abs(Number(count)||0),direction=count<0?-1:1;while(remaining>0){result=add(result,direction);if(isWorking(result,rules))remaining--}return result}
function workingDuration(task,rules){if(task.is_milestone)return 0;if(task.start_date&&task.due_date){let cursor=localDate(task.start_date),end=localDate(task.due_date),total=0;while(cursor<=end){if(isWorking(cursor,rules))total++;cursor=add(cursor,1)}return Math.max(1,total)}return Math.max(1,Math.ceil((Number(task.work_hours)||rules.hours)/rules.hours))}
function normaliseDependencies(rows,links){const result=[...links];rows.forEach(task=>{if(task.predecessor_id&&!result.some(link=>link.task_id===task.id&&link.predecessor_task_id===task.predecessor_id))result.push({id:`legacy-${task.id}`,task_id:task.id,predecessor_task_id:task.predecessor_id,dependency_type:task.dependency_type||'FS',lag_days:Number(task.lag_days)||0,legacy:true})});return result}

function analyse(rows,links,calendar){
  const rules=calendarRules(calendar),allLinks=normaliseDependencies(rows,links),byId=new Map(rows.map(task=>[task.id,task])),memo=new Map(),visiting=new Set(),incoming=id=>allLinks.filter(link=>link.task_id===id&&byId.has(link.predecessor_task_id))
  function calculate(task){
    if(memo.has(task.id))return memo.get(task.id)
    const ownStart=nextWorking(localDate(task.start_date)||new Date(),rules),span=workingDuration(task,rules)
    if(visiting.has(task.id)){const fallback={...task,calcStart:ownStart,calcEnd:task.is_milestone?ownStart:moveWorking(ownStart,span-1,rules),duration:span,pathLength:span,cycle:true};memo.set(task.id,fallback);return fallback}
    visiting.add(task.id);let start=ownStart,pathLength=span,driverId=null
    incoming(task.id).forEach(link=>{const predecessor=calculate(byId.get(link.predecessor_task_id)),lag=Number(link.lag_days)||0,type=link.dependency_type||'FS';let driven
      if(type==='SS')driven=moveWorking(predecessor.calcStart,lag,rules)
      else if(type==='FF')driven=moveWorking(moveWorking(predecessor.calcEnd,lag,rules),-(span-1),rules)
      else if(type==='SF')driven=moveWorking(moveWorking(predecessor.calcStart,lag,rules),-(span-1),rules)
      else driven=moveWorking(predecessor.calcEnd,lag+1,rules)
      if(driven>start){start=driven;driverId=predecessor.id;pathLength=predecessor.pathLength+Math.max(0,lag)+span}
    })
    const result={...task,duration:span,calcStart:start,calcEnd:task.is_milestone?start:moveWorking(start,span-1,rules),pathLength,driverId};visiting.delete(task.id);memo.set(task.id,result);return result
  }
  const tasks=rows.map(calculate).sort((a,b)=>String(a.wbs_code||'').localeCompare(String(b.wbs_code||''),undefined,{numeric:true})),critical=new Set();let current=[...tasks].sort((a,b)=>b.calcEnd-a.calcEnd||b.pathLength-a.pathLength)[0]
  while(current&&!critical.has(current.id)){critical.add(current.id);current=memo.get(current.driverId)}
  return {tasks:tasks.map(task=>({...task,critical:critical.has(task.id)})),links:allLinks,rules}
}
function overloads(tasks,team,rules){return team.map(person=>{const assigned=tasks.filter(task=>(task.assignee===person.name||task.assignee_id===person.id)&&task.calcStart&&task.calcEnd);let peak=0;assigned.forEach(task=>{for(let day=new Date(task.calcStart);day<=task.calcEnd;day=add(day,1)){if(!isWorking(day,rules))continue;const load=assigned.filter(other=>day>=other.calcStart&&day<=other.calcEnd).reduce((sum,other)=>sum+(Number(other.work_hours)||other.duration*rules.hours)/Math.max(1,other.duration),0);peak=Math.max(peak,load)}});const capacity=Math.max(.1,(Number(person.availability)||100)/100*rules.hours);return {...person,peak:Math.round(peak/capacity*100),overloaded:peak>capacity}}).filter(person=>person.overloaded)}

export default function GanttView({rows,dependencies=[],calendar,team,onSetBaseline,onOpen}){
  const [dayWidth,setDayWidth]=useState(24),{tasks,links,rules}=useMemo(()=>analyse(rows,dependencies,calendar),[rows,dependencies,calendar]),dated=tasks.filter(task=>task.calcStart&&task.calcEnd)
  const rangeStart=dated.length?new Date(Math.min(...dated.flatMap(task=>[task.calcStart,localDate(task.baseline_start)||task.calcStart]))):new Date(),rangeEnd=dated.length?new Date(Math.max(...dated.flatMap(task=>[task.calcEnd,localDate(task.baseline_end)||task.calcEnd]))):add(rangeStart,30),start=add(rangeStart,-3),end=add(rangeEnd,5),total=Math.max(20,days(iso(start),iso(end))+1),width=total*dayWidth
  const critical=tasks.filter(task=>task.critical).length,milestones=tasks.filter(task=>task.is_milestone).length,overallocated=overloads(tasks,team,rules),baselineCount=tasks.filter(task=>task.baseline_start&&task.baseline_end).length
  return <div className="gantt-wrap">
    <div className="schedule-insights"><div><GitBranch size={17}/><span><b>{critical}</b> activités sur le chemin critique</span></div><div><Diamond size={17}/><span><b>{milestones}</b> jalons · {links.length} liaisons</span></div><div className={overallocated.length?'alert':''}><AlertTriangle size={17}/><span><b>{overallocated.length}</b> ressources en surcharge</span></div><button className="btn ghost" onClick={onSetBaseline}><Save size={15}/>{baselineCount?'Actualiser la référence':'Définir la référence'}</button></div>
    {overallocated.length>0&&<div className="overload-banner"><AlertTriangle size={17}/><div><b>Surcharge détectée</b><span>{overallocated.map(person=>`${person.name} (${person.peak} %)`).join(' · ')}</span></div></div>}
    <div className="gantt-toolbar"><div><Baseline size={16}/><span>{calendar?.name||'Calendrier standard'} · {rules.working.size} j/semaine · trait fin = référence</span></div><div><button onClick={()=>setDayWidth(Math.max(14,dayWidth-4))}><ChevronLeft size={15}/></button><span>Zoom</span><button onClick={()=>setDayWidth(Math.min(42,dayWidth+4))}><ChevronRight size={15}/></button></div></div>
    <div className="gantt card"><div className="gantt-table"><div className="gantt-list-head"><span>WBS</span><span>Activité</span><span>Durée</span><span>Préd.</span></div>{tasks.map(task=>{const taskLinks=links.filter(link=>link.task_id===task.id);return <button type="button" className={`gantt-list-row ${task.critical?'critical':''}`} key={task.id} onClick={()=>onOpen?.(task)}><span>{task.wbs_code||'—'}</span><span title={task.title}>{task.is_milestone&&<i className="mini-diamond"/>}{task.title}</span><span>{task.is_milestone?'Jalon':`${task.duration} j`}</span><span title={taskLinks.map(link=>tasks.find(row=>row.id===link.predecessor_task_id)?.title).filter(Boolean).join(', ')}>{taskLinks.length?taskLinks.map(link=>(tasks.find(row=>row.id===link.predecessor_task_id)?.wbs_code||'—')+(link.dependency_type||'FS')).join(' · '):'—'}</span></button>})}</div>
      <div className="gantt-scroll"><div className="gantt-canvas" style={{width}}><div className="gantt-scale">{Array.from({length:total},(_,index)=>{const day=add(start,index),off=!isWorking(day,rules);return <div key={index} className={off?'weekend':''} style={{width:dayWidth}}><span>{day.getDate()===1||index===0?new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short'}).format(day):day.getDate()}</span></div>})}</div>
        <svg className="dependency-lines" width={width} height={tasks.length*44}>{links.map(link=>{const index=tasks.findIndex(task=>task.id===link.task_id),predecessorIndex=tasks.findIndex(task=>task.id===link.predecessor_task_id);if(index<0||predecessorIndex<0)return null;const task=tasks[index],predecessor=tasks[predecessorIndex],x1=(days(iso(start),iso(predecessor.calcEnd))+1)*dayWidth,x2=days(iso(start),iso(task.calcStart))*dayWidth,y1=22+predecessorIndex*44,y2=22+index*44,mid=Math.min(x1+10,Math.max(x1,x2-8));return <polyline key={link.id} points={`${x1},${y1} ${mid},${y1} ${mid},${y2} ${x2},${y2}`} className={task.critical&&predecessor.critical?'critical':''}/>})}</svg>
        <div className="gantt-rows">{tasks.map(task=>{const left=days(iso(start),iso(task.calcStart))*dayWidth,barWidth=Math.max(7,(days(iso(task.calcStart),iso(task.calcEnd))+1)*dayWidth-3),baselineStart=localDate(task.baseline_start),baselineEnd=localDate(task.baseline_end);return <div className="gantt-time-row" key={task.id} style={{width}}>{task.is_milestone?<button type="button" aria-label={`Ouvrir ${task.title}`} className={`gantt-milestone ${task.critical?'critical':''}`} style={{left:left+2}} onClick={()=>onOpen?.(task)}/>:<button type="button" className={`gantt-bar ${task.critical?'critical':''}`} style={{left,width:barWidth,backgroundColor:task.critical?undefined:task.color}} title={`${task.title} · ${iso(task.calcStart)} → ${iso(task.calcEnd)}`} onClick={()=>onOpen?.(task)}><i style={{width:`${task.progress||0}%`}}/><span>{task.title}</span></button>}{baselineStart&&baselineEnd&&<div className="baseline-bar" style={{left:days(iso(start),iso(baselineStart))*dayWidth,width:Math.max(5,(days(iso(baselineStart),iso(baselineEnd))+1)*dayWidth-3)}}/>}</div>})}</div>
      </div></div></div>
  </div>
}

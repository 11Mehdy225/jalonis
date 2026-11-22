import { useEffect, useState } from 'react'
import { CalendarCog, Clock3, Save } from 'lucide-react'

const DAYS=[['1','Lundi'],['2','Mardi'],['3','Mercredi'],['4','Jeudi'],['5','Vendredi'],['6','Samedi'],['0','Dimanche']]
const initial={name:'Calendrier du projet',working_days:'1,2,3,4,5',hours_per_day:8,holidays:'',is_default:true}

export default function PlanningSettings({calendar,onSave}){
  const [form,setForm]=useState(calendar||initial),[saved,setSaved]=useState(false)
  useEffect(()=>setForm(calendar||initial),[calendar])
  const selected=new Set(String(form.working_days||'').split(',').filter(Boolean))
  const toggle=day=>{const next=new Set(selected);next.has(day)?next.delete(day):next.add(day);setForm({...form,working_days:DAYS.map(([value])=>value).filter(value=>next.has(value)).join(',')})}
  const submit=async event=>{event.preventDefault();if(!selected.size)return;await onSave({...form,hours_per_day:Number(form.hours_per_day)||8,is_default:true});setSaved(true);setTimeout(()=>setSaved(false),1500)}
  return <form className="planning-settings card" onSubmit={submit}>
    <header><span><CalendarCog size={19}/></span><div><h3>Calendrier de travail</h3><p>Les dates calculées, le chemin critique et les charges utilisent ces jours ouvrés.</p></div></header>
    <div className="planning-settings-grid">
      <label>Nom du calendrier<input value={form.name||''} onChange={event=>setForm({...form,name:event.target.value})}/></label>
      <label>Durée d’une journée<div className="hours-field"><Clock3 size={15}/><input type="number" min="1" max="24" step=".5" value={form.hours_per_day||8} onChange={event=>setForm({...form,hours_per_day:event.target.value})}/><span>heures</span></div></label>
      <fieldset><legend>Jours ouvrés</legend><div className="working-days">{DAYS.map(([value,label])=><button type="button" key={value} className={selected.has(value)?'active':''} onClick={()=>toggle(value)}><b>{label.slice(0,3)}</b><small>{label}</small></button>)}</div></fieldset>
      <label className="holidays">Jours non travaillés <small>Une date par ligne, au format AAAA-MM-JJ.</small><textarea value={form.holidays||''} onChange={event=>setForm({...form,holidays:event.target.value})} placeholder={'2026-01-01\n2026-04-06'}/></label>
    </div>
    <footer><span>{selected.size?`${selected.size} jour(s) ouvré(s) par semaine · ${form.hours_per_day||8} h/jour`:'Sélectionnez au moins un jour ouvré.'}</span><button className="btn primary" disabled={!selected.size}><Save size={15}/>{saved?'Calendrier enregistré':'Enregistrer le calendrier'}</button></footer>
  </form>
}

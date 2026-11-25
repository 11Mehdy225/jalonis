import { useEffect, useMemo, useState } from 'react'
import { Building2, LockKeyhole, ShieldCheck, Users } from 'lucide-react'

const accessLabels={manager:'Responsable du projet',contributor:'Contributeur',viewer:'Lecture seule'}

export default function ProjectAccessManager({project,members=[],access,onSave,onCancel}){
  const eligible=useMemo(()=>members.filter(member=>member.id&&!member.invitation&&member.membership_status==='Actif'),[members])
  const [mode,setMode]=useState(access?.access_mode||project?.access_mode||'restricted')
  const [selected,setSelected]=useState({})
  const [saving,setSaving]=useState(false)
  useEffect(()=>{const next={};(access?.members||[]).forEach(member=>{next[member.user_id]=member.access_role||'contributor'});setSelected(next);setMode(access?.access_mode||project?.access_mode||'restricted')},[access,project?.id])
  const mandatory=member=>member.id===project?.created_by||['Propriétaire','Administrateur'].includes(member.role)
  const toggle=member=>{if(mandatory(member))return;setSelected(current=>{const next={...current};if(next[member.id])delete next[member.id];else next[member.id]=['Observateur','Fournisseur externe'].includes(member.role)?'viewer':'contributor';return next})}
  const submit=async event=>{event.preventDefault();setSaving(true);try{await onSave({access_mode:mode,members:Object.entries(selected).map(([user_id,access_role])=>({user_id,access_role}))})}finally{setSaving(false)}}
  return <form className="project-access-form" onSubmit={submit}>
    <div className="access-mode-grid"><label className={mode==='restricted'?'active':''}><input type="radio" name="mode" value="restricted" checked={mode==='restricted'} onChange={()=>setMode('restricted')}/><LockKeyhole/><span><b>Accès restreint</b><small>Uniquement les personnes sélectionnées.</small></span></label><label className={mode==='workspace'?'active':''}><input type="radio" name="mode" value="workspace" checked={mode==='workspace'} onChange={()=>setMode('workspace')}/><Building2/><span><b>Tout l’espace</b><small>Tous les membres actuels et futurs.</small></span></label></div>
    {mode==='restricted'&&<><div className="project-access-note"><ShieldCheck/><span>Le propriétaire de l’espace, ses administrateurs et le créateur du projet conservent toujours l’accès.</span></div><div className="project-member-access-list">{eligible.map(member=>{const locked=mandatory(member),checked=locked||Boolean(selected[member.id]);return <article key={member.id}><label><input type="checkbox" checked={checked} disabled={locked} onChange={()=>toggle(member)}/><i>{(member.full_name||member.email||'?').split(' ').map(part=>part[0]).slice(0,2).join('').toUpperCase()}</i><span><b>{member.full_name||member.email}</b><small>{member.role}{locked?' · accès permanent':''}</small></span></label>{checked&&!locked&&<select value={selected[member.id]} onChange={event=>setSelected(current=>({...current,[member.id]:event.target.value}))}>{Object.entries(accessLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>}</article>})}</div></>}
    {mode==='workspace'&&<div className="workspace-access-summary"><Users/><span><b>{eligible.length} membre(s) auront accès</b><small>Les nouveaux membres ajoutés à l’espace verront également ce projet.</small></span></div>}
    <div className="form-actions"><button type="button" className="btn ghost" onClick={onCancel}>Annuler</button><button className="btn primary" disabled={saving}>{saving?'Enregistrement…':'Enregistrer les accès'}</button></div>
  </form>
}

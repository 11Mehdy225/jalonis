import { useEffect, useState } from 'react'
import { Download, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { api } from '../../services/api'

const labels={export:'Export des données',deletion:'Suppression du compte',rectification:'Rectification',objection:'Opposition'}
const statuses={submitted:'Reçue',in_review:'En cours',approved:'Approuvée',completed:'Terminée',rejected:'Refusée',cancelled:'Annulée'}
const date=value=>value?new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)):'—'

export default function PrivacyCenter(){
  const [rows,setRows]=useState([]),[busy,setBusy]=useState(''),[error,setError]=useState(''),[details,setDetails]=useState('')
  const load=async()=>{try{setRows(await apiCall('list'))}catch(reason){setError(reason.message)}}
  useEffect(()=>{load()},[])
  const exportData=async()=>{setBusy('export');setError('');try{const data=await apiCall('export');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`jalonis-donnees-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(url)}catch(reason){setError(reason.message)}finally{setBusy('')}}
  const submit=async type=>{if(type==='deletion'&&!window.confirm('Confirmez-vous la demande de fermeture et d’anonymisation de votre compte ?'))return;setBusy(type);setError('');try{await apiCall('submit',{request_type:type,details});setDetails('');await load()}catch(reason){setError(reason.message)}finally{setBusy('')}}
  const cancel=async id=>{setBusy(id);try{await apiCall('cancel',{id});await load()}catch(reason){setError(reason.message)}finally{setBusy('')}}
  return <section className="card privacy-card"><div className="section-title"><ShieldCheck size={20}/><div><h3>Mes données personnelles</h3><p>Exportez vos informations ou exercez vos droits depuis un seul endroit.</p></div></div>
    {error&&<div className="app-error">{error}</div>}
    <div className="privacy-actions"><button className="btn ghost" onClick={exportData} disabled={Boolean(busy)}><Download size={16}/>{busy==='export'?'Préparation…':'Télécharger mes données'}</button><button className="btn danger" onClick={()=>submit('deletion')} disabled={Boolean(busy)}><Trash2 size={16}/>Demander la suppression</button></div>
    <label className="privacy-details">Précisions facultatives<textarea rows="3" maxLength="2000" value={details} onChange={event=>setDetails(event.target.value)} placeholder="Indiquez ici les données à rectifier ou toute précision utile."/></label>
    <div className="privacy-secondary"><button onClick={()=>submit('rectification')} disabled={Boolean(busy)}>Demander une rectification</button><button onClick={()=>submit('objection')} disabled={Boolean(busy)}>Exercer mon droit d’opposition</button><button title="Actualiser" onClick={load}><RefreshCw size={15}/></button></div>
    <div className="privacy-history"><h4>Suivi des demandes</h4>{rows.length?rows.map(row=><article key={row.id}><span><b>{labels[row.request_type]||row.request_type}</b><small>Demandée le {date(row.requested_at)} · échéance {date(row.due_at)}</small></span><em className={row.status}>{statuses[row.status]||row.status}</em>{row.status==='submitted'&&<button disabled={busy===row.id} onClick={()=>cancel(row.id)}>Annuler</button>}</article>):<p>Aucune demande en cours.</p>}</div>
  </section>
}

async function apiCall(action,payload){
  if(action==='list')return api.privacy.list()
  if(action==='export')return api.privacy.export()
  if(action==='submit')return api.privacy.submit(payload)
  return api.privacy.cancel(payload.id)
}

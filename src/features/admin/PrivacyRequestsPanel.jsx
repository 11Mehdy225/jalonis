import { useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck, UserX } from 'lucide-react'

const labels={export:'Export',deletion:'Suppression',rectification:'Rectification',objection:'Opposition'}
const statuses={submitted:'Reçue',in_review:'En cours',approved:'Approuvée',completed:'Terminée',rejected:'Refusée',cancelled:'Annulée'}
const date=value=>value?new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)):'—'

export default function PrivacyRequestsPanel({onLoad,onManage}){
  const [rows,setRows]=useState([]),[busy,setBusy]=useState(''),[error,setError]=useState('')
  const load=async()=>{try{setRows(await onLoad())}catch(reason){setError(reason.message||'Demandes indisponibles.')}}
  useEffect(()=>{load()},[])
  const manage=async(row,action,status)=>{if(action==='anonymize'&&!window.confirm('Cette action bloque le compte et anonymise définitivement ses données d’identité. Continuer ?'))return;setBusy(row.id);setError('');try{await onManage({request_id:row.id,action,status});await load()}catch(reason){setError(reason.message||'Action impossible.')}finally{setBusy('')}}
  const open=rows.filter(row=>!['completed','cancelled'].includes(row.status))
  return <section className="card privacy-admin"><header><div><ShieldCheck size={19}/><span><h3>Droits et données personnelles</h3><p>Demandes d’accès, rectification, opposition et suppression.</p></span></div><button className="btn ghost" onClick={load}><RefreshCw size={14}/>Actualiser</button></header>{error&&<div className="app-error">{error}</div>}<div className="privacy-admin-list">{open.map(row=><article key={row.id}><span><b>{labels[row.request_type]} · {row.requester_email}</b><small>Reçue le {date(row.requested_at)} · échéance {date(row.due_at)}</small>{row.details&&<p>{row.details}</p>}</span><em className={row.status}>{statuses[row.status]}</em><div>{row.status==='submitted'&&<button disabled={busy===row.id} onClick={()=>manage(row,'update','in_review')}>Prendre en charge</button>}{row.status==='in_review'&&<button disabled={busy===row.id} onClick={()=>manage(row,'update','approved')}>Approuver</button>}{row.request_type==='deletion'&&row.status==='approved'&&<button className="danger" disabled={busy===row.id} onClick={()=>manage(row,'anonymize')}><UserX size={15}/>Anonymiser et fermer</button>}{row.request_type!=='deletion'&&['in_review','approved'].includes(row.status)&&<button disabled={busy===row.id} onClick={()=>manage(row,'update','completed')}>Terminer</button>}</div></article>)}{!open.length&&<p className="monitor-clear"><ShieldCheck/>Aucune demande à traiter.</p>}</div></section>
}

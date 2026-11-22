import { useMemo, useRef, useState } from 'react'
import { ArchiveRestore, BarChart3, Download, FileJson, FileSpreadsheet, Printer, ShieldCheck, Upload } from 'lucide-react'
import '../../styles/reports.css'

const exportSets=[
  ['tasks','Planning','planning'],['backlog_items','Backlog Scrum','backlog'],['risks','Risques','risques'],['cost_entries','Coûts','couts'],
  ['team','Équipe','equipe'],['stakeholders','Parties prenantes','parties-prenantes'],['suppliers','Fournisseurs','fournisseurs'],
  ['change_requests','Changements','changements'],['issues','Problèmes','problemes'],['decisions','Décisions','decisions'],
]
const systemFields=new Set(['id','project_id','created_at','updated_at','stored_path','url','logo_path','logo_url'])
const number=value=>Number(value)||0
const safe=value=>String(value??'').replaceAll('"','""').replaceAll('\n',' ')
const slug=value=>String(value||'projet').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase()
const saveBlob=(name,content,type)=>{const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

export default function ReportCenter({project,entities,onImport}){
  const inputRef=useRef(null),[message,setMessage]=useState(''),[error,setError]=useState('')
  const currency=project.currency||'XOF'
  const money=value=>new Intl.NumberFormat('fr-FR',{style:'currency',currency,maximumFractionDigits:0}).format(number(value))
  const metrics=useMemo(()=>{
    const tasks=entities.tasks||[],costs=entities.cost_entries||[],risks=entities.risks||[]
    const progress=tasks.length?Math.round(tasks.reduce((sum,row)=>sum+number(row.progress),0)/tasks.length):0
    const actual=costs.reduce((sum,row)=>sum+number(row.actual_amount),0)
    const committed=costs.reduce((sum,row)=>sum+number(row.committed_amount),0)
    const critical=risks.filter(row=>number(row.probability)*number(row.impact)>=15&&row.status!=='Fermé').length
    return {progress,actual,committed,critical,done:tasks.filter(row=>row.status==='Terminé').length,total:tasks.length,openIssues:(entities.issues||[]).filter(row=>!['Résolu','Clos'].includes(row.status)).length,openChanges:(entities.change_requests||[]).filter(row=>!['Approuvée','Rejetée','Annulée'].includes(row.status)).length}
  },[entities])
  const exportCsv=(type,label,file)=>{
    const rows=entities[type]||[]
    if(!rows.length){setMessage(`Aucune donnée à exporter pour « ${label} ».`);return}
    const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))].filter(key=>!systemFields.has(key))
    const content='\uFEFF'+[columns.map(key=>`"${safe(key)}"`).join(';'),...rows.map(row=>columns.map(key=>`"${safe(row[key])}"`).join(';'))].join('\n')
    saveBlob(`${slug(project.name)}-${file}.csv`,content,'text/csv;charset=utf-8');setMessage(`${label} exporté au format CSV.`)
  }
  const exportBackup=()=>{
    const data=Object.fromEntries(Object.entries(entities).filter(([type])=>type!=='attachments'))
    const attachmentManifest=(entities.attachments||[]).map(({file_name,mime_type,size_bytes,entity_type,entity_id,caption})=>({file_name,mime_type,size_bytes,entity_type,entity_id,caption}))
    const backup={format:'jalonis-project',version:1,exported_at:new Date().toISOString(),project:Object.fromEntries(Object.entries(project).filter(([key])=>!['logo_path','logo_url'].includes(key))),entities:data,attachment_manifest:attachmentManifest}
    saveBlob(`${slug(project.name)}-archive-jalonis.json`,JSON.stringify(backup,null,2),'application/json');setMessage('Archive JSON du projet téléchargée.')
  }
  const importFile=async event=>{
    try{setError('');setMessage('');const file=event.target.files?.[0];if(!file)return;const backup=JSON.parse(await file.text());if(backup.format!=='jalonis-project'||!backup.project||!backup.entities)throw new Error('Ce fichier n’est pas une archive de projet Jalonis valide.');const result=await onImport(backup);setMessage(`Projet restauré sous le nom « ${result.name} ».`)}catch(reason){setError(reason.message||'Impossible de restaurer cette archive.')}finally{event.target.value=''}
  }
  return <div className="report-center">
    <section className="report-hero card"><div><span>RAPPORT DE PILOTAGE</span><h2>{project.name}</h2><p>Situation consolidée au {new Intl.DateTimeFormat('fr-FR',{dateStyle:'long'}).format(new Date())}</p></div><button className="btn primary" onClick={()=>window.print()}><Printer size={16}/>Imprimer / PDF</button></section>
    <div className="report-kpis"><ReportKpi label="Avancement" value={`${metrics.progress}%`} note={`${metrics.done}/${metrics.total} tâches terminées`}/><ReportKpi label="Budget" value={money(project.budget)} note={`${money(metrics.actual)} consommés`}/><ReportKpi label="Risques critiques" value={metrics.critical} note={`${(entities.risks||[]).filter(r=>r.status!=='Fermé').length} risques ouverts`}/><ReportKpi label="Points de gouvernance" value={metrics.openIssues+metrics.openChanges} note={`${metrics.openIssues} problèmes · ${metrics.openChanges} changements`}/></div>
    <div className="report-grid">
      <section className="card report-section"><header><BarChart3 size={18}/><div><h3>État d’avancement</h3><p>Progression moyenne du planning.</p></div></header><div className="report-progress"><div><i style={{width:`${metrics.progress}%`}}/></div><b>{metrics.progress}%</b></div><ReportRows rows={[
        ['Tâches terminées',metrics.done],['Tâches en cours',(entities.tasks||[]).filter(r=>r.status==='En cours').length],['Tâches bloquées',(entities.tasks||[]).filter(r=>r.status==='Bloqué').length],['Backlog non terminé',(entities.backlog_items||[]).filter(r=>r.status!=='Terminé').length],
      ]}/></section>
      <section className="card report-section"><header><ShieldCheck size={18}/><div><h3>Santé et gouvernance</h3><p>Signaux nécessitant une décision.</p></div></header><ReportRows rows={[
        ['Risques ouverts',(entities.risks||[]).filter(r=>r.status!=='Fermé').length],['Problèmes ouverts',metrics.openIssues],['Changements à instruire',metrics.openChanges],['Conflits ouverts',(entities.conflicts||[]).filter(r=>!['Résolu','Clos'].includes(r.status)).length],['Décisions à appliquer',(entities.decisions||[]).filter(r=>r.status==='À appliquer').length],
      ]}/></section>
      <section className="card report-section"><header><FileSpreadsheet size={18}/><div><h3>Situation financière</h3><p>Référence, engagements et décaissements.</p></div></header><ReportRows rows={[[`Budget (${currency})`,money(project.budget)],['Coûts engagés',money(metrics.committed)],['Coûts réels',money(metrics.actual)],['Solde disponible',money(number(project.budget)-metrics.actual)],['Contrats fournisseurs',money((entities.supplier_contracts||[]).reduce((s,r)=>s+number(r.amount),0))]]}/></section>
      <section className="card report-section"><header><ArchiveRestore size={18}/><div><h3>Capacité organisationnelle</h3><p>Équipe, parties prenantes et communications.</p></div></header><ReportRows rows={[["Membres de l’équipe",(entities.team||[]).length],['Parties prenantes',(entities.stakeholders||[]).length],['Lignes RACI',(entities.raci_assignments||[]).length],['Communications actives',(entities.communication_plans||[]).filter(r=>r.status==='Actif').length],['Fournisseurs actifs',(entities.suppliers||[]).filter(r=>!['Suspendu','Inactif'].includes(r.status)).length]]}/></section>
    </div>
    <section className="card export-section"><div className="export-head"><div><h3>Exports compatibles Excel</h3><p>Chaque registre est exporté dans un fichier CSV séparé, facile à filtrer et partager.</p></div><FileSpreadsheet size={22}/></div><div className="export-grid">{exportSets.map(([type,label,file])=><button key={type} onClick={()=>exportCsv(type,label,file)}><span><FileSpreadsheet size={17}/></span><div><b>{label}</b><small>{(entities[type]||[]).length} ligne(s)</small></div><Download size={15}/></button>)}</div></section>
    <section className="card backup-section"><div><span><FileJson size={22}/></span><div><h3>Archive et restauration du projet</h3><p>L’archive JSON contient les données structurées. Les fichiers joints sont listés mais ne sont pas copiés dans l’archive.</p></div></div><div className="backup-actions"><button className="btn ghost" onClick={exportBackup}><Download size={16}/>Télécharger l’archive</button><button className="btn primary" onClick={()=>inputRef.current?.click()}><Upload size={16}/>Restaurer comme copie</button><input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={importFile}/></div></section>
    {message&&<div className="report-toast success">{message}</div>}{error&&<div className="report-toast error">{error}</div>}
  </div>
}

function ReportKpi({label,value,note}){return <div className="card report-kpi"><small>{label}</small><b>{value}</b><span>{note}</span></div>}
function ReportRows({rows}){return <div className="report-rows">{rows.map(([label,value])=><div key={label}><span>{label}</span><b>{value}</b></div>)}</div>}

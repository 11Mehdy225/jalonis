import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const htmlEscape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]||character))
const localParts=(timezone:string)=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone||'Africa/Abidjan',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]))
const withinQuietHours=(time:string,start:string,end:string)=>{if(!start||!end)return false;if(start<end)return time>=start&&time<end;return time>=start||time<end}
const card=(title:string,body:string)=>`<div style="padding:18px;border:1px solid #e7eaf1;border-radius:12px;background:#fff"><h2 style="margin:0 0 8px;font-size:18px;color:#182037">${htmlEscape(title)}</h2><p style="margin:0;color:#657087;line-height:1.55">${htmlEscape(body)}</p></div>`
const layout=(content:string)=>`<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><div style="max-width:620px;margin:auto;padding:28px 18px"><div style="margin-bottom:18px;color:#4f46e5;font-size:20px;font-weight:800">Jalonis</div>${content}<p style="margin:18px 2px;color:#9299a9;font-size:11px;line-height:1.5">Vous recevez cet e-mail selon vos préférences Jalonis. Vous pouvez les modifier dans Espace & accès.</p></div></body></html>`

Deno.serve(async request=>{
  try{
    const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),resendKey=Deno.env.get('RESEND_API_KEY'),cronSecret=Deno.env.get('JALONIS_CRON_SECRET'),from=Deno.env.get('JALONIS_EMAIL_FROM'),replyTo=Deno.env.get('JALONIS_EMAIL_REPLY_TO')
    if(!url||!serviceKey||!resendKey||!cronSecret||!from)return Response.json({error:'Configuration e-mail incomplète.'},{status:503})
    if(request.headers.get('x-jalonis-cron-secret')!==cronSecret)return Response.json({error:'Accès refusé.'},{status:401})
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
    await queueDailyDigests(admin)
    const {data:pending,error:queueError}=await admin.from('email_deliveries').select('*').eq('status','pending').lte('scheduled_for',new Date().toISOString()).order('created_at').limit(50)
    if(queueError)throw queueError
    let sent=0,skipped=0,failed=0
    for(const delivery of pending||[]){
      const {data:profile}=await admin.from('profiles').select('email,full_name,timezone,quiet_start,quiet_end,notify_email').eq('id',delivery.recipient_id).maybeSingle()
      if(!profile?.email||!profile.notify_email){skipped++;await admin.from('email_deliveries').update({status:'failed',last_error:'Adresse absente ou préférence e-mail désactivée.'}).eq('id',delivery.id);continue}
      const parts=localParts(profile.timezone),localTime=`${parts.hour}:${parts.minute}`
      if(delivery.email_type==='notification'&&withinQuietHours(localTime,String(profile.quiet_start||''),String(profile.quiet_end||''))){skipped++;continue}
      await admin.from('email_deliveries').update({status:'sending',attempts:Number(delivery.attempts||0)+1}).eq('id',delivery.id).eq('status','pending')
      const content=delivery.email_type==='daily_digest'?renderDigest(delivery.template_data,profile.full_name):card(delivery.template_data?.title||delivery.subject,delivery.template_data?.body||'')
      const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':delivery.dedupe_key},body:JSON.stringify({from,to:[profile.email],subject:delivery.subject,html:layout(content),...(replyTo?{reply_to:replyTo}:{})})})
      const result=await response.json()
      if(response.ok){sent++;await admin.from('email_deliveries').update({status:'sent',provider_id:result.id||null,sent_at:new Date().toISOString(),last_error:null}).eq('id',delivery.id)}
      else{failed++;await admin.from('email_deliveries').update({status:Number(delivery.attempts||0)>=2?'failed':'pending',last_error:String(result.message||'Erreur Resend').slice(0,500),scheduled_for:new Date(Date.now()+15*60000).toISOString()}).eq('id',delivery.id)}
    }
    return Response.json({ok:true,sent,skipped,failed})
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Erreur de traitement des e-mails.'},{status:500})}
})

async function queueDailyDigests(admin:any){
  const {data:profiles}=await admin.from('profiles').select('id,full_name,email,timezone,quiet_end,notify_email,daily_digest').eq('notify_email',true).eq('daily_digest',true)
  for(const profile of profiles||[]){
    const parts=localParts(profile.timezone),digestHour=String(profile.quiet_end||'07:00').slice(0,2)
    if(parts.hour!==digestHour)continue
    const digestDate=`${parts.year}-${parts.month}-${parts.day}`,dedupeKey=`daily:${profile.id}:${digestDate}`
    const {data:memberships}=await admin.from('workspace_members').select('workspace_id').eq('user_id',profile.id).eq('status','Actif')
    const workspaceIds=(memberships||[]).map((row:any)=>row.workspace_id);if(!workspaceIds.length)continue
    const {data:projects}=await admin.from('projects').select('id,name').in('workspace_id',workspaceIds)
    const projectIds=(projects||[]).map((row:any)=>row.id);if(!projectIds.length)continue
    const today=digestDate
    const [{data:tasks},{data:meetings},{data:risks}]=await Promise.all([
      admin.from('tasks').select('title,due_date,status,priority,project_id').in('project_id',projectIds).eq('assignee_id',profile.id).neq('status','Terminé').lte('due_date',today).order('due_date'),
      admin.from('meetings').select('title,meeting_date,project_id').in('project_id',projectIds).gte('meeting_date',`${today}T00:00:00`).lt('meeting_date',`${today}T23:59:59`),
      admin.from('risks').select('title,probability,impact,project_id').in('project_id',projectIds).neq('status','Fermé'),
    ])
    const critical=(risks||[]).filter((risk:any)=>Number(risk.probability)*Number(risk.impact)>=15)
    await admin.from('email_deliveries').upsert({recipient_id:profile.id,email_type:'daily_digest',dedupe_key:dedupeKey,subject:`Jalonis · Votre point projet du ${today}`,template_data:{date:today,tasks:tasks||[],meetings:meetings||[],risks:critical}},{onConflict:'dedupe_key',ignoreDuplicates:true})
  }
}

function renderDigest(data:any,name:string){
  const list=(rows:any[],empty:string,render:(row:any)=>string)=>rows?.length?`<ul style="margin:10px 0 0;padding-left:20px;color:#4f5870">${rows.slice(0,8).map(row=>`<li style="margin:7px 0">${render(row)}</li>`).join('')}</ul>`:`<p style="color:#8b92a3">${empty}</p>`
  return `<div style="padding:20px;border-radius:14px;background:linear-gradient(135deg,#4f46e5,#29245f);color:white"><div style="font-size:12px;opacity:.75">POINT QUOTIDIEN</div><h1 style="margin:7px 0 4px;font-size:23px">Bonjour ${htmlEscape(name||'')},</h1><p style="margin:0;opacity:.82">Voici les priorités de vos projets pour aujourd’hui.</p></div><div style="margin-top:14px">${card('Tâches à traiter',`${data.tasks?.length||0} tâche(s) arrivée(s) à échéance`)}${list(data.tasks,'Aucune tâche en retard ou prévue aujourd’hui.',row=>`${htmlEscape(row.title)} · ${htmlEscape(row.priority||'Priorité normale')}`)}<div style="height:12px"></div>${card('Réunions du jour',`${data.meetings?.length||0} réunion(s) planifiée(s)`)}${list(data.meetings,'Aucune réunion planifiée aujourd’hui.',row=>htmlEscape(row.title))}<div style="height:12px"></div>${card('Risques critiques',`${data.risks?.length||0} risque(s) nécessitent une attention`)}${list(data.risks,'Aucun risque critique ouvert.',row=>htmlEscape(row.title))}</div>`
}

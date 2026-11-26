import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const localParts=(timezone:string)=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone||'Africa/Abidjan',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]))
const withinQuietHours=(time:string,start:string,end:string)=>{if(!start||!end)return false;if(start<end)return time>=start&&time<end;return time>=start||time<end}
const phoneDigits=(value:string)=>value.replace(/[^0-9]/g,'').replace(/^00/,'')
const textParameter=(value:unknown)=>({type:'text',text:String(value??'—').slice(0,900)})

Deno.serve(async request=>{
  try{
    const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),cronSecret=Deno.env.get('KAVELYO_CRON_SECRET')||Deno.env.get('JALONIS_CRON_SECRET')
    const token=Deno.env.get('WHATSAPP_ACCESS_TOKEN'),phoneNumberId=Deno.env.get('WHATSAPP_PHONE_NUMBER_ID'),language=Deno.env.get('WHATSAPP_TEMPLATE_LANGUAGE')||'fr',apiVersion=Deno.env.get('WHATSAPP_API_VERSION')||'v27.0'
    if(!url||!serviceKey||!cronSecret||!token||!phoneNumberId)return Response.json({error:'Configuration WhatsApp incomplète.'},{status:503})
    if((request.headers.get('x-kavelyo-cron-secret')||request.headers.get('x-jalonis-cron-secret'))!==cronSecret)return Response.json({error:'Accès refusé.'},{status:401})
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
    await admin.from('whatsapp_deliveries').update({status:'pending',scheduled_for:new Date().toISOString(),last_error:'Nouvelle tentative après interruption.'}).eq('status','sending').lt('updated_at',new Date(Date.now()-15*60000).toISOString())
    await queueDailyReminders(admin)
    const {data:pending,error}=await admin.from('whatsapp_deliveries').select('*').eq('status','pending').lte('scheduled_for',new Date().toISOString()).order('created_at').limit(50)
    if(error)throw error
    let sent=0,skipped=0,failed=0
    for(const delivery of pending||[]){
      const {data:profile}=await admin.from('profiles').select('phone,full_name,timezone,quiet_start,quiet_end,notify_whatsapp,whatsapp_opt_in_at').eq('id',delivery.recipient_id).maybeSingle()
      if(!profile?.phone||!profile.notify_whatsapp||!profile.whatsapp_opt_in_at){skipped++;await admin.from('whatsapp_deliveries').update({status:'failed',last_error:'Consentement WhatsApp absent ou numéro indisponible.'}).eq('id',delivery.id);continue}
      const parts=localParts(profile.timezone),localTime=`${parts.hour}:${parts.minute}`
      if(delivery.message_type==='notification'&&withinQuietHours(localTime,String(profile.quiet_start||''),String(profile.quiet_end||''))){skipped++;continue}
      const {data:claimed}=await admin.from('whatsapp_deliveries').update({status:'sending',attempts:Number(delivery.attempts||0)+1}).eq('id',delivery.id).eq('status','pending').select('id').maybeSingle()
      if(!claimed){skipped++;continue}
      const values=delivery.message_type==='daily_digest'
        ? [profile.full_name||'membre',delivery.template_data?.tasks||0,delivery.template_data?.meetings||0,delivery.template_data?.risks||0,Deno.env.get('SITE_URL')||'https://kavelyo.ronnagroup.net']
        : [delivery.template_data?.title||'Mise à jour du projet',delivery.template_data?.body||'Consultez Kavelyo pour les détails.']
      const response=await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:phoneDigits(profile.phone),type:'template',template:{name:delivery.template_name,language:{code:language},components:[{type:'body',parameters:values.map(textParameter)}]}})})
      const result=await response.json(),messageId=result.messages?.[0]?.id
      if(response.ok&&messageId){sent++;await admin.from('whatsapp_deliveries').update({status:'sent',provider_message_id:messageId,sent_at:new Date().toISOString(),last_error:null}).eq('id',delivery.id)}
      else{failed++;await admin.from('whatsapp_deliveries').update({status:Number(delivery.attempts||0)>=2?'failed':'pending',last_error:String(result.error?.message||'Erreur WhatsApp').slice(0,500),scheduled_for:new Date(Date.now()+15*60000).toISOString()}).eq('id',delivery.id)}
    }
    return Response.json({ok:true,sent,skipped,failed})
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Erreur de traitement WhatsApp.'},{status:500})}
})

async function queueDailyReminders(admin:any){
  const {data:profiles}=await admin.from('profiles').select('id,timezone,quiet_end,notify_whatsapp,whatsapp_opt_in_at,phone,daily_digest').eq('notify_whatsapp',true).eq('daily_digest',true).not('whatsapp_opt_in_at','is',null)
  for(const profile of profiles||[]){
    const parts=localParts(profile.timezone),localTime=`${parts.hour}:${parts.minute}`,digestTime=String(profile.quiet_end||'07:00').slice(0,5)
    if(localTime<digestTime)continue
    const date=`${parts.year}-${parts.month}-${parts.day}`,dedupeKey=`whatsapp:daily:${profile.id}:${date}`
    const {data:memberships}=await admin.from('workspace_members').select('workspace_id').eq('user_id',profile.id).eq('status','Actif')
    const workspaceIds=(memberships||[]).map((row:any)=>row.workspace_id);if(!workspaceIds.length)continue
    const [{data:projects},{data:projectMemberships}]=await Promise.all([
      admin.from('projects').select('id,created_by,access_mode').in('workspace_id',workspaceIds),
      admin.from('project_members').select('project_id').eq('user_id',profile.id),
    ])
    const explicitIds=new Set((projectMemberships||[]).map((row:any)=>row.project_id))
    const projectIds=(projects||[]).filter((row:any)=>row.access_mode==='workspace'||row.created_by===profile.id||explicitIds.has(row.id)).map((row:any)=>row.id);if(!projectIds.length)continue
    const [{count:tasks},{count:meetings},{data:risks}]=await Promise.all([
      admin.from('tasks').select('id',{count:'exact',head:true}).in('project_id',projectIds).eq('assignee_id',profile.id).neq('status','Terminé').lte('due_date',date),
      admin.from('meetings').select('id',{count:'exact',head:true}).in('project_id',projectIds).gte('meeting_date',`${date}T00:00:00`).lt('meeting_date',`${date}T23:59:59`),
      admin.from('risks').select('probability,impact').in('project_id',projectIds).neq('status','Fermé'),
    ])
    const critical=(risks||[]).filter((risk:any)=>Number(risk.probability)*Number(risk.impact)>=15).length
    await admin.from('whatsapp_deliveries').insert({recipient_id:profile.id,message_type:'daily_digest',dedupe_key:dedupeKey,template_name:'kavelyo_daily_summary',template_data:{date,tasks:tasks||0,meetings:meetings||0,risks:critical}})
  }
}

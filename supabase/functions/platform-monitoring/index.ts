import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors})
  const started=performance.now()
  try{
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if(!url||!key)return json({error:'Configuration serveur incomplète.'},503)
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
    const {data:{user}}=await admin.auth.getUser(token)
    if(!user)return json({error:'Session invalide.'},401)
    const {data:platformAdmin}=await admin.from('platform_admins').select('user_id').eq('user_id',user.id).eq('active',true).maybeSingle()
    if(!platformAdmin)return json({error:'Accès réservé à l’administration Jalonis.'},403)
    if(request.method==='POST'){
      const body=await request.json(),id=String(body.incident_id||''),status=String(body.status||''),allowed=new Set(['open','investigating','resolved','ignored'])
      if(!id||!allowed.has(status))return json({error:'Mise à jour invalide.'},400)
      const {data,error}=await admin.from('platform_incidents').update({status,resolution:String(body.resolution||'').slice(0,1000)||null,assigned_to:body.assigned_to||null}).eq('id',id).select().single()
      if(error)throw error
      return json({ok:true,incident:data})
    }
    const since24=new Date(Date.now()-86400000).toISOString(),since7=new Date(Date.now()-7*86400000).toISOString()
    const [eventsResult,incidentsResult,transactionsResult,billingEventsResult,emailResult,whatsappResult,rateResult,counts]=await Promise.all([
      admin.from('platform_telemetry').select('event_type,severity,user_id,source,route,message,created_at').gte('created_at',since7).order('created_at',{ascending:false}).limit(5000),
      admin.from('platform_incidents').select('*').order('last_seen_at',{ascending:false}).limit(100),
      admin.from('billing_transactions').select('status,provider,amount,currency,created_at').gte('created_at',since7),
      admin.from('billing_events').select('event_type,provider,created_at').gte('created_at',since7),
      admin.from('email_deliveries').select('status,created_at').gte('created_at',since7),
      admin.from('whatsapp_deliveries').select('status,created_at').gte('created_at',since7),
      admin.from('api_rate_limits').select('scope,request_count,updated_at').gte('updated_at',since24).order('request_count',{ascending:false}).limit(100),
      Promise.all([admin.from('profiles').select('id',{count:'exact',head:true}),admin.from('workspaces').select('id',{count:'exact',head:true}),admin.from('projects').select('id',{count:'exact',head:true})]),
    ])
    const events=eventsResult.data||[],last24=events.filter(row=>row.created_at>=since24),active24=new Set(last24.map(row=>row.user_id).filter(Boolean)).size,active7=new Set(events.map(row=>row.user_id).filter(Boolean)).size
    const topRoutes=Object.entries(events.filter(row=>row.event_type==='page_view'&&row.route).reduce((map:any,row:any)=>{map[row.route]=(map[row.route]||0)+1;return map},{})).sort((a:any,b:any)=>b[1]-a[1]).slice(0,8).map(([route,count])=>({route,count}))
    const errors24=last24.filter(row=>['client_error','api_error'].includes(row.event_type)).length,security24=last24.filter(row=>row.event_type==='security').length
    const transactions=transactionsResult.data||[],emails=emailResult.data||[],whatsapp=whatsappResult.data||[]
    const services=[
      {id:'supabase',label:'Supabase',status:'operational',detail:`Base joignable · ${Math.round(performance.now()-started)} ms`},
      {id:'jeko',label:'Jèko',status:transactions.some(row=>row.status==='failed')?'degraded':'operational',detail:`${transactions.length} transaction(s) · ${(billingEventsResult.data||[]).length} événement(s) sur 7 j`},
      {id:'email',label:'E-mails',status:emails.some(row=>row.status==='failed')?'degraded':'operational',detail:`${emails.filter(row=>row.status==='sent').length} envoyé(s) · ${emails.filter(row=>row.status==='failed').length} échec(s)`},
      {id:'whatsapp',label:'WhatsApp',status:whatsapp.some(row=>row.status==='failed')?'degraded':'operational',detail:`${whatsapp.filter(row=>row.status==='sent').length} envoyé(s) · ${whatsapp.filter(row=>row.status==='failed').length} échec(s)`},
    ]
    return json({generated_at:new Date().toISOString(),metrics:{active_24h:active24,active_7d:active7,page_views_7d:events.filter(row=>row.event_type==='page_view').length,errors_24h:errors24,security_24h:security24,accounts:counts[0].count||0,workspaces:counts[1].count||0,projects:counts[2].count||0},services,top_routes:topRoutes,incidents:incidentsResult.data||[],recent_events:events.filter(row=>row.event_type!=='page_view').slice(0,40),security_signals:(rateResult.data||[]).filter(row=>Number(row.request_count)>5).slice(0,20)})
  }catch(error){return json({error:error instanceof Error?error.message:'Supervision indisponible.'},500)}
})

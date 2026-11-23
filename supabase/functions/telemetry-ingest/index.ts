import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})
const allowedTypes=new Set(['page_view','session','client_error','api_error','security','performance'])
const allowedSeverities=new Set(['info','warning','error','critical'])
const clean=(value:unknown,max=500)=>String(value??'').replace(/(bearer\s+|apikey[=: ]+|token[=: ]+|password[=: ]+)[^\s,;]+/gi,'$1[masqué]').slice(0,max)
const digest=async(value:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(byte=>byte.toString(16).padStart(2,'0')).join('')

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(request.method!=='POST')return json({error:'Méthode non autorisée.'},405)
  if(Number(request.headers.get('content-length')||0)>16_384)return json({error:'Événement trop volumineux.'},413)
  try{
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if(!url||!key)return json({error:'Service indisponible.'},503)
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
    const {data:{user}}=await admin.auth.getUser(token)
    if(!user)return json({error:'Session requise.'},401)
    const {data:allowed}=await admin.rpc('consume_api_rate_limit',{p_scope:'telemetry',p_actor:user.id,p_max_requests:120,p_window_seconds:60})
    if(!allowed)return json({error:'Limite atteinte.'},429)
    const body=await request.json(),eventType=String(body.event_type||''),severity=String(body.severity||'info')
    if(!allowedTypes.has(eventType)||!allowedSeverities.has(severity))return json({error:'Événement invalide.'},400)
    const {data:membership}=await admin.from('workspace_members').select('workspace_id').eq('user_id',user.id).eq('status','Actif').limit(1).maybeSingle()
    const route=clean(body.route,160),source=clean(body.source||'web',60),message=clean(body.message,800)
    const fingerprint=clean(body.fingerprint,100)||await digest(`${eventType}|${source}|${message.slice(0,250)}`)
    const metadata={browser:clean(body.metadata?.browser,120),os:clean(body.metadata?.os,80),version:clean(body.metadata?.version,30),duration_ms:Number(body.metadata?.duration_ms)||null}
    await admin.from('platform_telemetry').insert({event_type:eventType,severity,user_id:user.id,workspace_id:membership?.workspace_id||null,source,route,message:message||null,fingerprint,metadata})
    if(['client_error','api_error','security'].includes(eventType)&&['warning','error','critical'].includes(severity)){
      const {data:incident}=await admin.from('platform_incidents').select('id,occurrence_count,status').eq('fingerprint',fingerprint).maybeSingle()
      if(incident)await admin.from('platform_incidents').update({occurrence_count:Number(incident.occurrence_count||0)+1,last_seen_at:new Date().toISOString(),severity,status:incident.status==='resolved'?'open':incident.status,metadata:{route}}).eq('id',incident.id)
      else await admin.from('platform_incidents').insert({fingerprint,title:message||`${eventType} détecté`,source,severity,metadata:{route}})
    }
    return json({ok:true})
  }catch{return json({error:'Collecte indisponible.'},500)}
})

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors})
  try{
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if(!url||!key)return json({error:'Configuration serveur incomplète.'},503)
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
    const {data:{user}}=await admin.auth.getUser(token)
    if(!user)return json({error:'Session invalide.'},401)
    const {data:platformAdmin}=await admin.from('platform_admins').select('user_id').eq('user_id',user.id).eq('active',true).maybeSingle()
    if(!platformAdmin)return json({error:'Accès réservé à l’administration Kavelyo.'},403)
    const body=await request.json(),requestId=String(body.request_id||''),action=String(body.action||'')
    const {data:privacyRequest,error:readError}=await admin.from('privacy_requests').select('*').eq('id',requestId).single()
    if(readError||!privacyRequest)return json({error:'Demande introuvable.'},404)
    if(action==='update'){
      const allowed=new Set(['submitted','in_review','approved','completed','rejected','cancelled'])
      if(!allowed.has(body.status))return json({error:'Statut invalide.'},400)
      const {data,error}=await admin.from('privacy_requests').update({status:body.status,admin_notes:String(body.admin_notes||'').slice(0,2000)||null,processed_by:user.id,completed_at:body.status==='completed'?new Date().toISOString():null}).eq('id',requestId).select().single()
      if(error)throw error
      return json({ok:true,request:data})
    }
    if(action!=='anonymize'||privacyRequest.request_type!=='deletion')return json({error:'Action invalide.'},400)
    if(!privacyRequest.user_id)return json({error:'Ce compte a déjà été anonymisé.'},409)
    const targetId=privacyRequest.user_id
    const {count:owned}=await admin.from('workspaces').select('id',{count:'exact',head:true}).eq('created_by',targetId)
    if(owned)return json({error:'Transférez ou supprimez d’abord les espaces dont cette personne est propriétaire.'},409)
    const synthetic=`deleted+${targetId}@invalid.kavelyo.local`
    const {error:authError}=await admin.auth.admin.updateUserById(targetId,{email:synthetic,email_confirm:true,ban_duration:'876000h',user_metadata:{deleted:true,deleted_at:new Date().toISOString()}})
    if(authError)throw authError
    await admin.from('workspace_members').delete().eq('user_id',targetId)
    const {error:profileError}=await admin.from('profiles').update({full_name:'Utilisateur supprimé',email:synthetic,phone:null,job_title:null,notify_email:false,notify_whatsapp:false}).eq('id',targetId)
    if(profileError)throw profileError
    const {data,error}=await admin.from('privacy_requests').update({user_id:null,status:'completed',completed_at:new Date().toISOString(),processed_by:user.id,admin_notes:String(body.admin_notes||'Compte fermé et données d’identité anonymisées.').slice(0,2000)}).eq('id',requestId).select().single()
    if(error)throw error
    return json({ok:true,request:data})
  }catch(error){return json({error:error instanceof Error?error.message:'Opération impossible.'},500)}
})

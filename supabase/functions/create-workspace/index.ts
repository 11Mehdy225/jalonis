import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
const slugBase=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42)||'espace'

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  let createdId=''
  try{
    const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if(!url||!serviceKey)return json({error:'Configuration Supabase incomplète.'},503)
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
    const {data:{user},error:userError}=await admin.auth.getUser(token)
    if(userError||!user)return json({error:'Session invalide ou expirée.'},401)
    const body=await request.json(),name=String(body.name||'').trim(),accountType=body.account_type==='Personnel'?'Personnel':'Organisation'
    if(name.length<2||name.length>80)return json({error:'Le nom doit contenir entre 2 et 80 caractères.'},400)
    const {data:owned,error:ownedError}=await admin.from('workspaces').select('id,account_type').eq('created_by',user.id)
    if(ownedError)throw ownedError
    if((owned||[]).length>=5)return json({error:'La limite de 5 espaces possédés par compte est atteinte.'},409)
    if(accountType==='Personnel'&&(owned||[]).some(space=>space.account_type==='Personnel'))return json({error:'Ce compte possède déjà un espace personnel.'},409)
    const planCode=accountType==='Organisation'?'team':'discovery'
    const {data:plan,error:planError}=await admin.from('plan_catalog').select('min_seats').eq('code',planCode).single()
    if(planError)throw planError
    const seats=Math.max(1,Number(plan.min_seats)||1),slug=`${slugBase(name)}-${crypto.randomUUID().slice(0,8)}`
    const {data:workspace,error:workspaceError}=await admin.from('workspaces').insert({name,slug,account_type:accountType,seat_limit:seats,created_by:user.id}).select('id').single()
    if(workspaceError)throw workspaceError
    createdId=workspace.id
    const {error:memberError}=await admin.from('workspace_members').insert({workspace_id:createdId,user_id:user.id,role:'Propriétaire',status:'Actif'})
    if(memberError)throw memberError
    const {error:subscriptionError}=await admin.from('subscriptions').insert({workspace_id:createdId,plan_code:planCode,status:'trialing',seats,current_period_start:new Date().toISOString(),current_period_end:new Date(Date.now()+14*86400000).toISOString()})
    if(subscriptionError)throw subscriptionError
    await admin.from('audit_log').insert({workspace_id:createdId,actor_id:user.id,action:'workspace.created',entity_type:'workspace',entity_id:createdId,metadata:{account_type:accountType}})
    return json({ok:true,workspace_id:createdId})
  }catch(error){
    try{if(createdId){const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(url&&key)await createClient(url,key,{auth:{persistSession:false}}).from('workspaces').delete().eq('id',createdId)}}catch{}
    return json({error:error instanceof Error?error.message:"Impossible de créer l’espace de travail."},500)
  }
})

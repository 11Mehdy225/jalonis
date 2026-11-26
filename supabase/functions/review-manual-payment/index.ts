import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  try{
    const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if(!url||!serviceKey)return json({error:'Configuration serveur indisponible.'},503)
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'')
    const {data:{user},error:userError}=await admin.auth.getUser(token)
    if(userError||!user)return json({error:'Session invalide ou expirée.'},401)
    const {data:platformAdmin}=await admin.from('platform_admins').select('user_id').eq('user_id',user.id).eq('active',true).maybeSingle()
    if(!platformAdmin)return json({error:'Accès réservé à l’administration Kavelyo.'},403)
    const body=await request.json(),requestId=String(body.request_id||''),decision=String(body.decision||''),note=String(body.note||'').trim().slice(0,500)||null
    if(!requestId||!['approved','rejected'].includes(decision))return json({error:'Demande ou décision invalide.'},400)
    const {data:transactionId,error}=await admin.rpc('review_manual_payment',{request_id:requestId,reviewer_id:user.id,decision,review_note:note})
    if(error)throw error
    return json({ok:true,transaction_id:transactionId,status:decision})
  }catch(error){return json({error:error instanceof Error?error.message:'Impossible de traiter cette demande.'},500)}
})


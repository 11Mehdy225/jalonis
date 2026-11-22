import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const toHex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes)).map(byte=>byte.toString(16).padStart(2,'0')).join('')
const safeEqual=(a:string,b:string)=>{if(a.length!==b.length)return false;let difference=0;for(let index=0;index<a.length;index++)difference|=a.charCodeAt(index)^b.charCodeAt(index);return difference===0}

Deno.serve(async request=>{
  const verifyToken=Deno.env.get('WHATSAPP_VERIFY_TOKEN')||''
  if(request.method==='GET'){
    if(!verifyToken)return new Response('Configuration incomplète',{status:503})
    const params=new URL(request.url).searchParams
    if(params.get('hub.mode')==='subscribe'&&safeEqual(params.get('hub.verify_token')||'',verifyToken))return new Response(params.get('hub.challenge')||'',{status:200})
    return new Response('Vérification refusée',{status:403})
  }
  try{
    const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),appSecret=Deno.env.get('WHATSAPP_APP_SECRET')
    if(!url||!serviceKey||!appSecret)return new Response('Configuration incomplète',{status:503})
    const raw=await request.arrayBuffer(),signature=request.headers.get('x-hub-signature-256')||''
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(appSecret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
    const expected=`sha256=${toHex(await crypto.subtle.sign('HMAC',key,raw))}`
    if(!safeEqual(signature,expected))return new Response('Signature invalide',{status:401})
    const payload=JSON.parse(new TextDecoder().decode(raw)),admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const statuses=payload.entry?.flatMap((entry:any)=>entry.changes||[]).flatMap((change:any)=>change.value?.statuses||[])||[]
    for(const item of statuses){
      const status=String(item.status),timestamp=item.timestamp?new Date(Number(item.timestamp)*1000).toISOString():new Date().toISOString()
      const update:any={status:['sent','delivered','read','failed'].includes(status)?status:'sent'}
      if(status==='sent')update.sent_at=timestamp
      if(status==='delivered')update.delivered_at=timestamp
      if(status==='read')update.read_at=timestamp
      if(status==='failed')update.last_error=String(item.errors?.[0]?.title||item.errors?.[0]?.message||'Échec de livraison').slice(0,500)
      await admin.from('whatsapp_deliveries').update(update).eq('provider_message_id',item.id)
    }
    return new Response('ok',{status:200})
  }catch{return new Response('Erreur de traitement',{status:500})}
})

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const hex=new TextEncoder()
const signatureFor=async(secret:string,body:string)=>{
  const key=await crypto.subtle.importKey('raw',hex.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign'])
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,hex.encode(body)))
  return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('')
}
const safeEqual=(a:string,b:string)=>{if(a.length!==b.length)return false;let difference=0;for(let index=0;index<a.length;index++)difference|=a.charCodeAt(index)^b.charCodeAt(index);return difference===0}

Deno.serve(async request=>{
  if(request.method!=='POST')return new Response('Méthode non autorisée',{status:405})
  const contentLength=Number(request.headers.get('content-length')||0)
  if(contentLength>65_536)return new Response('Requête trop volumineuse',{status:413})
  const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),webhookSecret=Deno.env.get('JEKO_WEBHOOK_SECRET'),storeId=Deno.env.get('JEKO_STORE_ID')
  if(!url||!serviceKey||!webhookSecret||!storeId)return new Response('Configuration incomplète',{status:503})
  const rawBody=await request.text(),received=(request.headers.get('Jeko-Signature')||'').toLowerCase()
  const expected=await signatureFor(webhookSecret,rawBody)
  if(!/^[a-f0-9]{64}$/.test(received)||!safeEqual(received,expected))return new Response('Signature invalide',{status:401})
  try{
    const eventType=String(request.headers.get('Jeko-Event')||''),payload=JSON.parse(rawBody),transactionId=String(payload.id||'')
    if(!transactionId)return new Response('ok',{status:200})
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const eventKey=`${eventType}:${transactionId}`
    const identifier=String(payload.counterpartIdentifier||''),maskedIdentifier=identifier?`***${identifier.slice(-4)}`:null
    const storedPayload={...payload,counterpartIdentifier:maskedIdentifier,counterpartLabel:undefined}
    const {error:eventError}=await admin.from('billing_events').insert({provider:'jeko',event_key:eventKey,event_type:eventType||'UNKNOWN',payload:storedPayload})
    if(eventError?.code==='23505')return new Response('ok',{status:200})
    if(eventError)throw eventError
    if(eventType!=='TRANSACTION_COMPLETED')return new Response('ok',{status:200})

    const reference=String(payload.transactionDetails?.reference||'').slice(0,200),paymentRequestId=String(payload.transactionDetails?.id||'').slice(0,200)
    if(!reference||!paymentRequestId||payload.storeId!==storeId)return new Response('ok',{status:200})
    const {data:attempt}=await admin.from('billing_transactions').select('*').eq('provider','jeko').eq('tx_ref',reference).maybeSingle()
    if(!attempt)return new Response('ok',{status:200})
    const transactionType=String(payload.transactionType||'').toLowerCase()
    const amountCents=Number(payload.amount?.amount),valid=payload.status==='success'&&transactionType==='payment'&&payload.amount?.currency===attempt.currency&&amountCents===Math.round(Number(attempt.amount)*100)&&paymentRequestId===String(attempt.provider_transaction_id||'')
    if(!valid)return new Response('ok',{status:200})
    const confirmedId=transactionId
    const {error:activationError}=await admin.rpc('activate_paid_subscription',{transaction_id:attempt.id,provider_transaction:confirmedId,provider_customer:null})
    if(activationError)throw activationError
    return new Response('ok',{status:200})
  }catch{return new Response('Erreur de traitement',{status:500})}
})

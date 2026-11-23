import { isCloudConfigured, supabase } from './supabase'

const source=window.jalonis?'desktop':'web'
const metadata=()=>({browser:navigator.userAgent.slice(0,120),os:navigator.platform||'',version:document.querySelector('meta[name="application-name"]')?.content||'Jalonis'})
const scrub=value=>String(value||'').replace(/(bearer\s+|apikey[=: ]+|token[=: ]+|password[=: ]+)[^\s,;]+/gi,'$1[masqué]').slice(0,800)

export async function trackTelemetry(event_type,{severity='info',route=location.pathname,message='',fingerprint='',duration_ms=null}={}){
  if(!isCloudConfigured||new URLSearchParams(location.search).get('preview')==='1')return
  try{await supabase.functions.invoke('telemetry-ingest',{body:{event_type,severity,source,route:scrub(route),message:scrub(message),fingerprint:scrub(fingerprint),metadata:{...metadata(),duration_ms}}})}catch{}
}

export function initializeTelemetry(){
  window.addEventListener('error',event=>trackTelemetry('client_error',{severity:'error',message:event.message,fingerprint:`window:${event.filename||''}:${event.lineno||0}`}))
  window.addEventListener('unhandledrejection',event=>trackTelemetry('client_error',{severity:'error',message:event.reason?.message||String(event.reason||'Promesse rejetée'),fingerprint:`promise:${event.reason?.name||'unknown'}`}))
  trackTelemetry('session',{message:'Session applicative ouverte'})
}

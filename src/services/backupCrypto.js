const encoder=new TextEncoder()
const decoder=new TextDecoder()
const ITERATIONS=310000
const ARCHIVE_FORMAT='kavelyo-encrypted-project'
const LEGACY_ARCHIVE_FORMAT='jalonis-encrypted-project'

const bytesToBase64=bytes=>{
  let value=''
  for(let index=0;index<bytes.length;index+=0x8000)value+=String.fromCharCode(...bytes.subarray(index,index+0x8000))
  return btoa(value)
}

const base64ToBytes=value=>Uint8Array.from(atob(value),character=>character.charCodeAt(0))

async function deriveKey(password,salt,iterations=ITERATIONS){
  const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey'])
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])
}

export async function encryptProjectArchive(archive,password){
  if(String(password||'').length<12)throw new Error('Le mot de passe de sauvegarde doit contenir au moins 12 caractères.')
  const salt=crypto.getRandomValues(new Uint8Array(16))
  const iv=crypto.getRandomValues(new Uint8Array(12))
  const key=await deriveKey(password,salt)
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(archive)))
  return {
    format:ARCHIVE_FORMAT,version:1,algorithm:'AES-256-GCM',
    kdf:{name:'PBKDF2',hash:'SHA-256',iterations:ITERATIONS,salt:bytesToBase64(salt)},
    iv:bytesToBase64(iv),ciphertext:bytesToBase64(new Uint8Array(encrypted)),created_at:new Date().toISOString(),
  }
}

export async function decryptProjectArchive(envelope,password){
  if(![ARCHIVE_FORMAT,LEGACY_ARCHIVE_FORMAT].includes(envelope?.format)||!envelope.kdf?.salt||!envelope.iv||!envelope.ciphertext)throw new Error('Cette sauvegarde chiffrée Kavelyo est invalide.')
  try{
    const salt=base64ToBytes(envelope.kdf.salt),iv=base64ToBytes(envelope.iv)
    const key=await deriveKey(password,salt,Number(envelope.kdf.iterations)||ITERATIONS)
    const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,base64ToBytes(envelope.ciphertext))
    return JSON.parse(decoder.decode(decrypted))
  }catch{
    throw new Error('Mot de passe incorrect ou sauvegarde endommagée.')
  }
}

export const isEncryptedProjectArchive=value=>[ARCHIVE_FORMAT,LEGACY_ARCHIVE_FORMAT].includes(value?.format)

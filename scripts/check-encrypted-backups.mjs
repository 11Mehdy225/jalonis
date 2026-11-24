import assert from 'node:assert/strict'
import { decryptProjectArchive, encryptProjectArchive, isEncryptedProjectArchive } from '../src/services/backupCrypto.js'

const source={format:'jalonis-project',version:1,project:{id:'project-1',name:'Projet test'},entities:{tasks:[{id:'task-1',title:'Préparer les données'}]}}
const password='Jalonis-test-2026!'
const encrypted=await encryptProjectArchive(source,password)

assert.equal(isEncryptedProjectArchive(encrypted),true)
assert.equal(encrypted.algorithm,'AES-256-GCM')
assert.notEqual(encrypted.ciphertext.includes('Préparer les données'),true)
assert.deepEqual(await decryptProjectArchive(encrypted,password),source)
await assert.rejects(()=>decryptProjectArchive(encrypted,'Mot-de-passe-invalide'),/incorrect|endommagée/)
await assert.rejects(()=>encryptProjectArchive(source,'trop-court'),/12 caractères/)

console.log('Sauvegardes chiffrées : chiffrement, restauration et contrôles validés.')

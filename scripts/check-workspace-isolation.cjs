const assert=require('node:assert/strict')
const crypto=require('node:crypto')
const fs=require('node:fs')
const os=require('node:os')
const path=require('node:path')
const {JalonisDatabase}=require('../electron/database.cjs')

const databasePath=path.join(os.tmpdir(),`jalonis-isolation-${crypto.randomUUID()}.sqlite`)
const database=new JalonisDatabase(databasePath)
try{
  const personalId=database.getWorkspace().workspace.id
  const organizationId=database.createWorkspace({name:'Organisation de contrôle',account_type:'Organisation'}).workspace.id
  database.createProject({name:'Projet de l’organisation'})
  assert.equal(database.listProjects().length,1)
  database.selectWorkspace(personalId)
  assert.equal(database.listProjects().length,0,'Un projet ne doit pas traverser les espaces')
  database.selectWorkspace(organizationId)
  assert.equal(database.listProjects()[0]?.name,'Projet de l’organisation')
  console.log('Isolation des espaces locaux validée')
}finally{
  database.db.close()
  for(const suffix of ['','-wal','-shm']){try{fs.unlinkSync(`${databasePath}${suffix}`)}catch{}}
}

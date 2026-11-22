import assert from 'node:assert/strict'
import { permissionsFor } from '../src/services/permissions.js'

const owner=permissionsFor('Propriétaire')
assert.equal(owner.manageWorkspace,true)
assert.equal(owner.manageProject,true)
assert.equal(owner.createProject,true)

const administrator=permissionsFor('Administrateur')
assert.equal(administrator.manageWorkspace,true)
assert.equal(administrator.inviteMembers,true)

const projectManager=permissionsFor('Chef de projet')
assert.equal(projectManager.manageWorkspace,false)
assert.equal(projectManager.manageProject,true)
assert.equal(projectManager.createProject,true)
assert.equal(projectManager.inviteMembers,true)

for(const role of ['Scrum Master','Product Owner','Membre']){
  const permissions=permissionsFor(role)
  assert.equal(permissions.editProject,true,`${role} doit pouvoir contribuer`)
  assert.equal(permissions.manageProject,false,`${role} ne doit pas administrer le projet`)
  assert.equal(permissions.createProject,false,`${role} ne doit pas créer de projet`)
}

for(const role of ['Observateur','Fournisseur externe','Rôle inconnu']){
  const permissions=permissionsFor(role)
  assert.equal(permissions.readOnly,true,`${role} doit rester en lecture seule`)
  assert.equal(permissions.comment,false,`${role} ne doit pas commenter`)
  assert.equal(permissions.manageWorkspace,false,`${role} ne doit pas administrer l’espace`)
}

console.log('Permissions des rôles validées')

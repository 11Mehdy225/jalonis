const EDIT_ROLES=['Propriétaire','Administrateur','Chef de projet','Scrum Master','Product Owner','Membre']
const PROJECT_MANAGER_ROLES=['Propriétaire','Administrateur','Chef de projet']
const WORKSPACE_MANAGER_ROLES=['Propriétaire','Administrateur']

export function permissionsFor(role='Observateur') {
  return {
    editProject: EDIT_ROLES.includes(role),
    comment: EDIT_ROLES.includes(role),
    deleteProjectContent: PROJECT_MANAGER_ROLES.includes(role),
    manageProject: PROJECT_MANAGER_ROLES.includes(role),
    createProject: PROJECT_MANAGER_ROLES.includes(role),
    inviteMembers: PROJECT_MANAGER_ROLES.includes(role),
    manageWorkspace: WORKSPACE_MANAGER_ROLES.includes(role),
    readOnly: !EDIT_ROLES.includes(role),
  }
}

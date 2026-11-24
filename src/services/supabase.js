import { createClient } from '@supabase/supabase-js'
import { LEGAL_VERSION } from '../features/auth/legalContent'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isCloudConfigured = Boolean(url && anonKey)
export const supabase = isCloudConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

export const cloudAuth = {
  session: async () => (await supabase.auth.getSession()).data.session,
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },
  signUp: async ({ email, password, fullName, accountType, workspaceName, termsAccepted }) => {
    if(!termsAccepted)throw new Error('Vous devez accepter les conditions et la politique de confidentialité.')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, account_type: accountType, workspace_name: workspaceName, legal_accepted: true, terms_version: LEGAL_VERSION, sales_version: LEGAL_VERSION, privacy_version: LEGAL_VERSION } },
    })
    if (error) throw error
    return data
  },
  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },
  updatePassword: async password => {
    const { data, error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    return data
  },
  resetPassword: async email => {
    const redirectTo=new URL(window.location.href);redirectTo.search='';redirectTo.searchParams.set('reset','1')
    const { data, error } = await supabase.auth.resetPasswordForEmail(email,{redirectTo:redirectTo.toString()})
    if (error) throw error
    return data
  },
  acceptInvitations: async () => {
    const { data, error } = await supabase.rpc('accept_my_invitations')
    if (error) throw error
    if (!Number(data)) throw new Error('Cette invitation a expiré ou a déjà été utilisée.')
    return data
  },
  acceptLegalDocuments: async (version=LEGAL_VERSION) => {
    const { data, error } = await supabase.rpc('accept_legal_documents',{p_terms_version:version,p_sales_version:version,p_privacy_version:version,p_method:'invitation-checkbox'})
    if(error)throw error
    return data
  },
  onChange: callback => supabase.auth.onAuthStateChange((event, session) => callback(session,event)),
}

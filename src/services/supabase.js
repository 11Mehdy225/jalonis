import { createClient } from '@supabase/supabase-js'

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
  signUp: async ({ email, password, fullName, accountType, workspaceName }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, account_type: accountType, workspace_name: workspaceName } },
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
  acceptInvitations: async () => {
    const { data, error } = await supabase.rpc('accept_my_invitations')
    if (error) throw error
    if (!Number(data)) throw new Error('Cette invitation a expiré ou a déjà été utilisée.')
    return data
  },
  onChange: callback => supabase.auth.onAuthStateChange((event, session) => callback(session,event)),
}

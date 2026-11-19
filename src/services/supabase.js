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
  onChange: callback => supabase.auth.onAuthStateChange((_event, session) => callback(session)),
}

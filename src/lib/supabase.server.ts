import { createServerClient } from '@supabase/ssr';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

const URL = (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SUPABASE_URL) || 'https://vdfprwerslivqcmbsvlc.supabase.co';
const KEY = (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkZnByd2Vyc2xpdnFjbWJzdmxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNzM2ODksImV4cCI6MjEwMjc0OTY4OX0.dCcf_Stlw_dK-Q7ZSwpzp3lLALyQyRyvBSPjBrs5m9Q';

export function isSupabaseServerConfigured() {
    return Boolean(URL && KEY && URL.startsWith('http') && !URL.includes('your-project'));
}

export function createMockServerClient(): SupabaseClient {
    const user = { id: 'usr-local', email: 'local@example.com' };
    const query: any = {
        select: () => query,
        eq: () => query,
        single: async () => ({ data: null, error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        insert: () => query, update: () => query,
        delete: () => query, then: (r: any) => r({ data: [], error: null })
    };
    return {
        auth: {
            getUser: async () => ({ data: { user }, error: null }),
            getSession: async () => ({ data: { session: { user, access_token: 'm' } }, error: null }),
            signInWithPassword: async () => ({ data: { user }, error: null }),
            signInWithOAuth: async () => ({ data: { url: '/' }, error: null }),
            signOut: async () => ({ error: null }),
            exchangeCodeForSession: async () => ({ data: { user }, error: null })
        },
        from: () => query
    } as unknown as SupabaseClient;
}

export function createClient(c?: Cookies | RequestEvent | { cookies: Cookies }): SupabaseClient {
    if (!isSupabaseServerConfigured()) return createMockServerClient();
    const cookies = c && 'cookies' in c ? c.cookies : (c as Cookies | undefined);
    if (!cookies) return createMockServerClient();
    return createServerClient(URL, KEY, {
        cookies: {
            getAll: () => cookies.getAll(),
            setAll: (list: any[]) => {
                try {
                    list.forEach(({ name, value, options }: any) => cookies.set(name, value, { ...options, path: options?.path ?? '/' }));
                } catch { }
            }
        }
    });
}

export { URL as SUPABASE_URL, KEY as SUPABASE_ANON_KEY };

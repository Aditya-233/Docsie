import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseServerConfigured(): boolean {
  return Boolean(
    SUPABASE_URL &&
      SUPABASE_ANON_KEY &&
      SUPABASE_URL.startsWith('http') &&
      !SUPABASE_URL.includes('your-project') &&
      !SUPABASE_URL.includes('placeholder')
  );
}

/**
 * In-memory fallback mock Supabase client for Server Components and Route Handlers.
 */
function createMockServerClient(): SupabaseClient {
  const mockAuthUser = {
    id: 'local-server-user-id',
    email: 'local@example.com',
    user_metadata: {
      name: 'Local User',
      avatar_url: '',
    },
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  };

  const mockAuthSession = {
    access_token: 'mock-server-token',
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: 'mock-server-refresh',
    user: mockAuthUser,
  };

  const mockClient: any = {
    auth: {
      getUser: async () => ({ data: { user: mockAuthUser }, error: null }),
      getSession: async () => ({ data: { session: mockAuthSession }, error: null }),
      signInWithPassword: async () => ({ data: { user: mockAuthUser, session: mockAuthSession }, error: null }),
      signUp: async () => ({ data: { user: mockAuthUser, session: mockAuthSession }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: (_table: string) => {
      const builder: any = {
        select: (_cols = '*') => builder,
        eq: (_col: string, _val: any) => builder,
        neq: (_col: string, _val: any) => builder,
        in: (_col: string, _vals: any[]) => builder,
        order: (_col: string, _opts?: any) => builder,
        limit: (_count: number) => builder,
        single: async () => ({ data: null, error: { message: 'Mock data not found', code: 'PGRST116' } }),
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: any, reject: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
        insert: (data: any | any[]) => {
          const records = Array.isArray(data) ? data : [data];
          return {
            select: () => ({
              single: async () => ({ data: records[0], error: null }),
              then: (resolve: any, reject: any) =>
                Promise.resolve({ data: records, error: null }).then(resolve, reject),
            }),
            then: (resolve: any, reject: any) =>
              Promise.resolve({ data: records, error: null }).then(resolve, reject),
          };
        },
        update: (_data: any) => ({
          eq: (_col: string, _val: any) => ({
            select: () => ({
              single: async () => ({ data: null, error: null }),
              then: (resolve: any, reject: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
            }),
            then: (resolve: any, reject: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
          }),
        }),
        delete: () => ({
          eq: (_col: string, _val: any) => Promise.resolve({ data: null, error: null }),
        }),
      };
      return builder;
    },
    storage: {
      from: (_bucket: string) => ({
        upload: async (path: string, _file: any) => ({ data: { path }, error: null }),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `/placeholder-image.png?path=${encodeURIComponent(path)}` },
        }),
      }),
    },
  };

  return mockClient as unknown as SupabaseClient;
}

/**
 * Creates a Supabase client for Server Components, Server Actions, and Route Handlers.
 * In Next.js 15, cookies() returns a Promise.
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  if (!isSupabaseServerConfigured()) {
    return createMockServerClient();
  }

  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

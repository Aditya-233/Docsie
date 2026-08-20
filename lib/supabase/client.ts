import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    SUPABASE_URL &&
      SUPABASE_ANON_KEY &&
      SUPABASE_URL.startsWith('http') &&
      !SUPABASE_URL.includes('your-project') &&
      !SUPABASE_URL.includes('placeholder')
  );
}

/**
 * In-memory / localStorage mock Supabase client for local development
 * and offline fallback when Supabase credentials are not provided.
 */
function createMockBrowserClient(): SupabaseClient {
  const getStorageItem = (key: string) => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(`mock_db_${key}`);
    } catch {
      return null;
    }
  };

  const setStorageItem = (key: string, value: unknown) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(`mock_db_${key}`, JSON.stringify(value));
    } catch {
      // ignore
    }
  };

  const getTableData = (table: string): any[] => {
    const raw = getStorageItem(table);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  };

  const mockChannel = (name: string) => {
    let broadcastChannel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        broadcastChannel = new BroadcastChannel(`mock_supabase_${name}`);
      } catch {
        broadcastChannel = null;
      }
    }

    const listeners: Array<{
      type: string;
      filter?: any;
      callback: (payload: any) => void;
    }> = [];

    if (broadcastChannel) {
      broadcastChannel.onmessage = (event) => {
        const { eventType, payload } = event.data || {};
        listeners.forEach((listener) => {
          if (listener.type === 'broadcast' && listener.filter?.event === eventType) {
            listener.callback({ event: eventType, payload });
          } else if (listener.type === 'presence') {
            listener.callback(payload);
          }
        });
      };
    }

    const channelObj: any = {
      on: (type: string, filter: any, callback: (payload: any) => void) => {
        listeners.push({ type, filter, callback });
        return channelObj;
      },
      subscribe: (callback?: (status: string) => void) => {
        if (callback) {
          setTimeout(() => callback('SUBSCRIBED'), 10);
        }
        return channelObj;
      },
      unsubscribe: async () => {
        if (broadcastChannel) {
          broadcastChannel.close();
        }
        return 'ok';
      },
      send: async (msg: { type: string; event: string; payload: any }) => {
        if (broadcastChannel) {
          broadcastChannel.postMessage({
            eventType: msg.event,
            payload: msg.payload,
          });
        }
        return 'ok';
      },
      track: async (presence: any) => {
        if (broadcastChannel) {
          broadcastChannel.postMessage({
            eventType: 'presence_sync',
            payload: presence,
          });
        }
        return 'ok';
      },
      untrack: async () => 'ok',
    };

    return channelObj;
  };

  const mockAuthUser = {
    id: 'local-user-id',
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
    access_token: 'mock-token',
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: 'mock-refresh',
    user: mockAuthUser,
  };

  const mockClient: any = {
    auth: {
      getUser: async () => ({ data: { user: mockAuthUser }, error: null }),
      getSession: async () => ({ data: { session: mockAuthSession }, error: null }),
      signInWithPassword: async () => ({ data: { user: mockAuthUser, session: mockAuthSession }, error: null }),
      signInWithOAuth: async () => ({ data: { provider: 'google', url: '' }, error: null }),
      signUp: async () => ({ data: { user: mockAuthUser, session: mockAuthSession }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: (callback: (event: string, session: any) => void) => {
        callback('SIGNED_IN', mockAuthSession);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
    from: (table: string) => {
      let filters: Array<(row: any) => boolean> = [];
      let sortField: string | null = null;
      let sortAscending = true;
      let limitCount: number | null = null;

      const builder: any = {
        select: (_cols = '*') => builder,
        eq: (col: string, val: any) => {
          filters.push((row) => row[col] === val);
          return builder;
        },
        neq: (col: string, val: any) => {
          filters.push((row) => row[col] !== val);
          return builder;
        },
        in: (col: string, vals: any[]) => {
          filters.push((row) => vals.includes(row[col]));
          return builder;
        },
        order: (col: string, opts?: { ascending?: boolean }) => {
          sortField = col;
          sortAscending = opts?.ascending ?? true;
          return builder;
        },
        limit: (count: number) => {
          limitCount = count;
          return builder;
        },
        single: async () => {
          const rows = getTableData(table).filter((row) => filters.every((f) => f(row)));
          if (rows.length === 0) return { data: null, error: { message: 'Not found', code: 'PGRST116' } };
          return { data: rows[0], error: null };
        },
        maybeSingle: async () => {
          const rows = getTableData(table).filter((row) => filters.every((f) => f(row)));
          return { data: rows[0] || null, error: null };
        },
        then: (resolve: any, reject: any) => {
          let rows = getTableData(table).filter((row) => filters.every((f) => f(row)));
          if (sortField) {
            rows.sort((a, b) => {
              if (a[sortField!] < b[sortField!]) return sortAscending ? -1 : 1;
              if (a[sortField!] > b[sortField!]) return sortAscending ? 1 : -1;
              return 0;
            });
          }
          if (limitCount !== null) {
            rows = rows.slice(0, limitCount);
          }
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
        insert: (data: any | any[]) => {
          const records = Array.isArray(data) ? data : [data];
          const current = getTableData(table);
          const newRecords = records.map((r) => ({
            id: r.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
            created_at: r.created_at || new Date().toISOString(),
            updated_at: r.updated_at || new Date().toISOString(),
            ...r,
          }));
          setStorageItem(table, [...current, ...newRecords]);
          return {
            select: () => ({
              single: async () => ({ data: newRecords[0], error: null }),
              then: (resolve: any, reject: any) =>
                Promise.resolve({ data: newRecords, error: null }).then(resolve, reject),
            }),
            then: (resolve: any, reject: any) =>
              Promise.resolve({ data: newRecords, error: null }).then(resolve, reject),
          };
        },
        upsert: (data: any | any[], opts?: { onConflict?: string }) => {
          const records = Array.isArray(data) ? data : [data];
          let current = getTableData(table);
          const conflictCol = opts?.onConflict || 'id';

          records.forEach((rec) => {
            const index = current.findIndex((item) => item[conflictCol] === rec[conflictCol]);
            if (index >= 0) {
              current[index] = { ...current[index], ...rec, updated_at: new Date().toISOString() };
            } else {
              current.push({
                id: rec.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...rec,
              });
            }
          });
          setStorageItem(table, current);
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
        update: (updates: any) => ({
          eq: (col: string, val: any) => {
            const current = getTableData(table);
            let updatedRow: any = null;
            const next = current.map((row) => {
              if (row[col] === val) {
                updatedRow = { ...row, ...updates, updated_at: new Date().toISOString() };
                return updatedRow;
              }
              return row;
            });
            setStorageItem(table, next);
            return {
              select: () => ({
                single: async () => ({ data: updatedRow, error: null }),
                then: (resolve: any, reject: any) =>
                  Promise.resolve({ data: updatedRow ? [updatedRow] : [], error: null }).then(resolve, reject),
              }),
              then: (resolve: any, reject: any) =>
                Promise.resolve({ data: updatedRow ? [updatedRow] : [], error: null }).then(resolve, reject),
            };
          },
        }),
        delete: () => ({
          eq: (col: string, val: any) => {
            const current = getTableData(table);
            const next = current.filter((row) => row[col] !== val);
            setStorageItem(table, next);
            return Promise.resolve({ data: null, error: null });
          },
        }),
      };

      return builder;
    },
    channel: mockChannel,
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, file: File | Blob) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              if (typeof window !== 'undefined') {
                try {
                  window.localStorage.setItem(`mock_storage_${bucket}_${path}`, dataUrl);
                } catch {
                  // ignore
                }
              }
              resolve({ data: { path }, error: null });
            };
            reader.readAsDataURL(file);
          });
        },
        getPublicUrl: (path: string) => {
          if (typeof window !== 'undefined') {
            const stored = window.localStorage.getItem(`mock_storage_${bucket}_${path}`);
            if (stored) return { data: { publicUrl: stored } };
          }
          return { data: { publicUrl: `/placeholder-image.png?path=${encodeURIComponent(path)}` } };
        },
      }),
    },
  };

  return mockClient as unknown as SupabaseClient;
}

let browserClient: SupabaseClient | null = null;

/**
 * Creates or returns the singleton Supabase browser client.
 * Falls back to in-memory mock client when environment variables are not set.
 */
export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;

  if (isSupabaseConfigured()) {
    browserClient = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  } else {
    browserClient = createMockBrowserClient();
  }

  return browserClient;
}

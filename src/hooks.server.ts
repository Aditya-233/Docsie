import type { Handle } from '@sveltejs/kit';
import { createClient, createMockServerClient, isSupabaseServerConfigured } from './lib/supabase.server';


export const handle: Handle = async ({ event, resolve }) => {
    if (isSupabaseServerConfigured()) {
        event.locals.supabase = createClient(event);
        event.locals.safeGetSession = async () => {
            const { data: { session } } = await event.locals.supabase.auth.getSession();
            if (!session) return { session: null, user: null };
            const { data: { user }, error } = await event.locals.supabase.auth.getUser();
            return error ? { session: null, user: null } : { session, user };
        };
    } else {
        event.locals.supabase = createMockServerClient();
        event.locals.safeGetSession = async () => ({
            session: { access_token: 'mock', expires_in: 3600, token_type: 'bearer', user: { id: 'usr-local', email: 'local@example.com' } } as any,
            user: { id: 'usr-local', email: 'local@example.com' } as any
        });
    }
    return resolve(event, { filterSerializedResponseHeaders: (name) => name === 'content-range' || name === 'x-supabase-api-version' });
};

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, user, session }, cookies }) => {
    const sessionResult = await safeGetSession();

    return {
        session: sessionResult.session ?? session,
        user: sessionResult.user ?? user,
        cookies: cookies.getAll()
    };
};

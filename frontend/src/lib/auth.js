import Cookies from 'js-cookie';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const COURSE_KEY = 'selectedCourse';

function safeLocalStorage() {
    if (typeof window === 'undefined') return null;

    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

export function getStoredToken() {
    const tokenFromCookie = Cookies.get(TOKEN_KEY);
    if (tokenFromCookie) return tokenFromCookie;

    const storage = safeLocalStorage();
    return storage?.getItem(TOKEN_KEY) || null;
}

export function getStoredUser() {
    const userFromCookie = Cookies.get(USER_KEY);
    if (userFromCookie) return userFromCookie;

    const storage = safeLocalStorage();
    return storage?.getItem(USER_KEY) || null;
}

export function getStoredCourse() {
    const courseFromCookie = Cookies.get(COURSE_KEY);
    if (courseFromCookie) return courseFromCookie;

    const storage = safeLocalStorage();
    return storage?.getItem(COURSE_KEY) || null;
}

export function setSession(token, user) {
    console.log('[auth] setSession:start', {
        hasToken: Boolean(token),
        role: user?.role,
        path: typeof window !== 'undefined' ? window.location.pathname : 'server',
    });
    Cookies.set(TOKEN_KEY, token, { expires: 1, path: '/' });
    Cookies.set(USER_KEY, JSON.stringify(user), { expires: 1, path: '/' });

    const storage = safeLocalStorage();
    storage?.setItem(TOKEN_KEY, token);
    storage?.setItem(USER_KEY, JSON.stringify(user));
    console.log('[auth] setSession:done', {
        cookieToken: Boolean(Cookies.get(TOKEN_KEY)),
        cookieUser: Boolean(Cookies.get(USER_KEY)),
        localToken: Boolean(storage?.getItem(TOKEN_KEY)),
        localUser: Boolean(storage?.getItem(USER_KEY)),
    });
}

export function setSelectedCourse(course) {
    const serialized = JSON.stringify(course);
    Cookies.set(COURSE_KEY, serialized, { expires: 1, path: '/' });

    const storage = safeLocalStorage();
    storage?.setItem(COURSE_KEY, serialized);
}

export function clearSession() {
    console.log('[auth] clearSession', {
        path: typeof window !== 'undefined' ? window.location.pathname : 'server',
    });
    Cookies.remove(TOKEN_KEY, { path: '/' });
    Cookies.remove(USER_KEY, { path: '/' });
    Cookies.remove(COURSE_KEY, { path: '/' });

    const storage = safeLocalStorage();
    storage?.removeItem(TOKEN_KEY);
    storage?.removeItem(USER_KEY);
    storage?.removeItem(COURSE_KEY);
}

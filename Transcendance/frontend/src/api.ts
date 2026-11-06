export function api(path: string, options: RequestInit = {}) {
    return fetch("/api" + path, {
        ...options,
        credentials: "include"
    });
}

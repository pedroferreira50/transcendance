export const API_URL = "http://localhost:3000";

export function api(path: string, options: RequestInit = {}) {
    return fetch(API_URL + path, {
        ...options,
        credentials: "include"
    });
}

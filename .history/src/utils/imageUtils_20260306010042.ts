/**
 * Utility to handle ADCC images through the local proxy to avoid CORS and 403 Forbidden issues.
 */
export const getAdccImageUrl = (url: string | undefined): string => {
    if (!url) return 'https://placehold.co/100x100?text=.';

    // If it's already a local URL or blob, return as is
    if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) {
        return url;
    }

    // If it's a direct ADCC URL, we use the proxy
    if (url.includes('adccanning.com.ar')) {
        return url.replace('https://adccanning.com.ar', '/api-adcc');
    }

    // If it's a relative path (likely from ADCC API), prepend the proxy path
    if (!url.startsWith('http')) {
        // If it already contains "jugadores/" or "img/", just prepend the proxy
        if (url.includes('jugadores/') || url.includes('img/')) {
            return `/api-adcc/${url.startsWith('/') ? url.slice(1) : url}`;
        }
        // Otherwise, assume it belongs to the img/ folder
        return `/api-adcc/img/${url}`;
    }

    // Fallback for other external images
    return url;
};

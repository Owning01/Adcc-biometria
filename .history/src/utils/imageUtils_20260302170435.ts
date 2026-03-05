/**
 * Utility to handle ADCC images through the local proxy to avoid CORS and 403 Forbidden issues.
 */
export const getAdccImageUrl = (url: string | undefined): string => {
    if (!url) return 'https://placehold.co/100x100?text=.';

    // If it's already a local URL or blob, return as is
    if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) {
        return url;
    }

    // If it's a direct ADCC URL, we use the proxy defined in vite.config.ts / firebase.json
    if (url.includes('adccanning.com.ar')) {
        // Remove the base domain and use the proxy path
        // url: https://adccanning.com.ar/img/logo.png -> /api-adcc/img/logo.png
        return url.replace('https://adccanning.com.ar', '/api-adcc');
    }

    // Fallback for other external images
    return url;
};

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
    // Example: "ia-15.png" -> "/api-adcc/img/ia-15.png"
    if (!url.startsWith('http')) {
        return `/api-adcc/img/${url}`;
    }

    // Fallback for other external images
    return url;
};

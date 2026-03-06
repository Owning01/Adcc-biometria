/**
 * Utility to handle ADCC images through the local proxy to avoid CORS and 403 Forbidden issues.
 */
export const getAdccImageUrl = (url: string | undefined): string => {
    if (!url) return 'https://placehold.co/100x100?text=.';

    // If it's already a local URL or blob, return as is
    if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) {
        return url;
    }

    // Use AllOrigins API proxy to bypass 403 Forbidden and CORS issues from ADCC server
    // AllOrigins fetches the content via their server-side API, making it harder to block.
    const ALL_ORIGINS_PROXY = 'https://api.allorigins.win/raw?url=';

    // If it's a direct ADCC URL, we use the external proxy
    if (url.includes('adccanning.com.ar')) {
        return `${ALL_ORIGINS_PROXY}${encodeURIComponent(url)}`;
    }

    // If it's a relative path (likely from ADCC API), construct full URL and proxy it
    if (!url.startsWith('http')) {
        let fullUrl = '';
        if (url.includes('jugadores/') || url.includes('img/')) {
            fullUrl = `https://adccanning.com.ar/${url.startsWith('/') ? url.slice(1) : url}`;
        } else {
            fullUrl = `https://adccanning.com.ar/img/${url}`;
        }
        return `${CORS_PROXY}${fullUrl}`;
    }

    // Fallback for other external images
    return url;
};

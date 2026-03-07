/**
 * Utility to handle ADCC images through the local proxy to avoid CORS and 403 Forbidden issues.
 */
export const getAdccImageUrl = (url: string | undefined): string => {
    if (!url) return 'https://placehold.co/100x100?text=.';

    // If it's already a full local URL (blob or data), return as is
    if (url.startsWith('blob:') || url.startsWith('data:')) {
        return url;
    }

    // Use Weserv Image Proxy to bypass 403 Forbidden and CORS issues from ADCC server.
    const WESERV_PROXY = 'https://images.weserv.nl/?url=';

    // If it's already using the proxy, don't double proxy
    if (url.includes('weserv.nl')) {
        return url;
    }

    // If it's a direct ADCC URL, we use the external proxy
    if (url.includes('adccanning.com.ar')) {
        return `${WESERV_PROXY}${encodeURIComponent(url)}`;
    }

    // If it's a relative path (likely from ADCC API), construct full URL and proxy it
    if (!url.startsWith('http')) {
        let fullUrl = '';
        // The user reported some use /img/foto/ and others are just the filename.
        // My tests show /img/foto/ is the one returning 200 OK.
        if (url.includes('foto/') || url.includes('jugadores/') || url.includes('img/')) {
            // Normalize existing paths to the known working one if possible, or just build full URL
            const cleanPath = url.replace('jugadores/', 'img/foto/').replace('img/', 'img/');
            fullUrl = `https://adccanning.com.ar/${cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath}`;
        } else {
            // If it's just a filename, prepend /img/foto/
            fullUrl = `https://adccanning.com.ar/img/foto/${url}`;
        }
        return `${WESERV_PROXY}${encodeURIComponent(fullUrl)}`;
    }

    // Fallback for other external images
    return url;
};

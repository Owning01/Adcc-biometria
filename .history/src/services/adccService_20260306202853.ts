
const API_BASE = '/api-adcc/api';
const TOKEN = import.meta.env.VITE_ADCC_TOKEN;

export interface ADCCMatch {
    id: number;
    dia: string;
    local_nombre: string;
    local_escudo: string;
    visitante_nombre: string;
    visitante_escudo: string;
    local_slug: string;
    visitante_slug: string;
    res_local: number | null;
    res_visitante: number | null;
    estado_partido: string;
    liga: string;
    categoria: string;
}

export interface ADCCPlayer {
    id: number;
    jleid: number;
    dni: number;
    nombre: string;
    apellido: string;
    imagen: string;
    imagen_url?: string;
    foto?: string;
    sancionado: boolean;
    equipo?: string;
    categoria?: string;
    face_api?: string | null;
    processed_foto?: string;
    status?: any;
    jleid_status?: any;
    timestamp?: string;
    msg?: string;
}

export interface ADCCMatchDetail {
    partido: ADCCMatch;
    equipo_local: ADCCPlayer[];
    equipo_visitante: ADCCPlayer[];
}

/**
 * Obtiene el listado de partidos de la API de ADCC.
 */
export const fetchADCCMatches = async (page: number = 1): Promise<{ data: ADCCMatch[], last_page: number }> => {
    const response = await fetch(`${API_BASE}/partidos?page=${page}`, {
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error body');
        throw new Error(`Error ${response.status} (${response.statusText}): ${errorText.substring(0, 100)}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Respuesta no es JSON (${contentType}): ${text.substring(0, 150)}...`);
    }

    try {
        return await response.json();
    } catch (e) {
        const text = await response.text().catch(() => 'No body available');
        throw new Error(`Error al parsear JSON: ${e instanceof Error ? e.message : String(e)}. Body: ${text.substring(0, 150)}...`);
    }
};

/**
 * Obtiene el detalle de un partido (incluyendo planteles).
 */
export const fetchADCCMatchDetail = async (id: number): Promise<ADCCMatchDetail> => {
    const response = await fetch(`${API_BASE}/partido/${id}`, {
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error body');
        throw new Error(`Error ${response.status} (${response.statusText}) al obtener detalle ${id}: ${errorText.substring(0, 100)}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Detalle ${id}: Respuesta no es JSON (${contentType}): ${text.substring(0, 150)}...`);
    }

    try {
        return await response.json();
    } catch (e) {
        const text = await response.text().catch(() => 'No body available');
        throw new Error(`Detalle ${id}: Error al parsear JSON: ${e instanceof Error ? e.message : String(e)}. Body: ${text.substring(0, 150)}...`);
    }
};
/**
 * Envía la planilla de partido a la API de ADCC.
 */
export const submitADCCMatchReport = async (payload: any): Promise<any> => {
    const response = await fetch(`${API_BASE}/cargaPlanillaPartido`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error body');
        try {
            const errorJson = JSON.parse(errorText);
            return { ok: false, status: response.status, errors: errorJson.errors || errorJson.message || errorText };
        } catch {
            return { ok: false, status: response.status, error: errorText.substring(0, 200) };
        }
    }

    return await response.json();
};

/**
 * Registra los datos biométricos de un jugador en la API de ADCC.
 */
export const registerPlayerBiometrics = async (jleid: number, faceApi: string): Promise<any> => {
    const payload = {
        id: jleid,
        face_api: faceApi
    };

    const response = await fetch(`${API_BASE}/jugadores`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error body');
        return { ok: false, status: response.status, error: errorText };
    }

    return await response.json();
};

/**
 * Busca jugadores en la API global de ADCC.
 */
export const searchADCCPlayer = async (query: string): Promise<ADCCPlayer[]> => {
    const response = await fetch(`${API_BASE}/jugadores/buscar?q=${encodeURIComponent(query)}`, {
        headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Error buscando jugador: ${response.status}`);
    }

    const data = await response.json();
    return data.players || data.data || [];
};

/**
 * Obtiene la lista de torneos/ligas activos de ADCC
 */
export const fetchADCCTournaments = async (): Promise<any[]> => {
    try {
        const response = await fetch(`${API_BASE}/torneos`, {
            headers: {
                'Authorization': `Bearer ${TOKEN}`
            }
        });

        if (!response.ok) {
            throw new Error(`Error fetching ADCC tournaments: ${response.statusText}`);
        }

        const data = await response.json();
        return data || [];
    } catch (error) {
        console.error('Error in fetchADCCTournaments:', error);
        return [];
    }
};

/**
 * Obtiene la lista de partidos de un torneo específico
 * @param tournamentId ID del torneo/liga
 */
export const fetchADCCTournamentMatches = async (tournamentId: string | number): Promise<any[]> => {
    try {
        const response = await fetch(`${API_BASE}/torneo/${tournamentId}`, {
            headers: {
                'Authorization': `Bearer ${TOKEN}`
            }
        });

        if (!response.ok) {
            throw new Error(`Error fetching ADCC tournament matches: ${response.statusText}`);
        }

        const data = await response.json();
        // La API suele devolver un array de partidos directamente o dentro de una propiedad
        return Array.isArray(data) ? data : (data.partidos || data.data || []);
    } catch (error) {
        console.error(`Error in fetchADCCTournamentMatches (${tournamentId}):`, error);
        return [];
    }
};

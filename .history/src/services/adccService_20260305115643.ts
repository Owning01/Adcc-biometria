
const API_BASE = '/api-adcc/api';
const TOKEN = '9f4b7d2a5e3c1a8f6b0d9c4e7a3b8f1c2d6e0f9a4b3c2d1e0f7a6b5c4d3e2f1';

export interface ADCCMatch {
    id: number;
    dia: string;
    local_nombre: string;
    local_escudo: string;
    visitante_nombre: string;
    visitante_escudo: string;
    res_local: number | null;
    res_visitante: number | null;
    estado_partido: string;
    liga: string;
    categoria: string;
}

export interface ADCCPlayer {
    jleid: number;
    dni: number;
    nombre: string;
    apellido: string;
    imagen: string;
    imagen_url?: string;
    sancionado: boolean;
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


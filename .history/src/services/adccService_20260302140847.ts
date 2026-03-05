
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

    if (!response.ok) throw new Error('Error al obtener partidos de ADCC');
    return response.json();
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

    if (!response.ok) throw new Error(`Error al obtener detalle del partido ${id}`);
    return response.json();
};

import {$fetch} from 'ofetch';

export interface FAANotamsResponse {
    status: 'Success';
    data: {
        geojson: {
            properties: {
                coreNOTAMData: {
                    notam: {
                        id?: string;
                        series?: string;
                        number?: string;
                        type?: string;
                        issued?: string;
                        affectedFIR?: string;
                        selectionCode?: string;
                        traffic?: string;
                        purpose?: string;
                        scope?: string;
                        minimumFL?: string;
                        maximumFL?: string;
                        location?: string;
                        icaoLocation?: string;
                        lastUpdated?: string;
                        effectiveStart?: string;
                        effectiveEnd?: string;
                        text?: string;
                        classification?: string;
                        schedule?: string;
                    };
                    notamTranslation: {
                        type: 'ICAO';
                        formattedText: string;
                    }[];
                };
            };
        }[];
    };
}

export interface VatsimAirportDataNotam {
    number: string;
    type: 'N' | 'R' | 'C';
    issued: string;
    effectiveFrom: string;
    effectiveTo: string | 'PERM';
    text: string;
    formattedText?: string;
    classification: 'INTL' | 'MIL' | 'DOM' | 'LMIL' | 'FDC';
    schedule?: string;
    id?: string;
    series?: string;
    affectedFIR?: string;
    selectionCode?: string;
    traffic?: string;
    purpose?: string;
    scope?: string;
    minimumFL?: string;
    maximumFL?: string;
    location?: string;
    icaoLocation?: string;
    lastUpdated?: string;
}

let token = '';
let expire = 0;
let tokenRequest: Promise<void> | undefined;
let requestQueue = Promise.resolve();
let nextRequestAt = 0;
const notamCache = new Map<string, { expiresAt: number; data: VatsimAirportDataNotam[] }>();
const NOTAM_CACHE_TTL = 5 * 60_000;

async function faaFetch<T>(url: string, options: Parameters<typeof $fetch<T>>[1]): Promise<T> {
    const request = requestQueue.then(async () => {
        const wait = Math.max(0, nextRequestAt - Date.now());
        if (wait) await new Promise(resolve => setTimeout(resolve, wait));
        nextRequestAt = Date.now() + 1_000;
        return $fetch<T>(url, options);
    });
    requestQueue = request.then(() => undefined, () => undefined);
    return request;
}

export async function getAirportNotams(icao: string): Promise<VatsimAirportDataNotam[]> {
    if (typeof icao !== 'string' || !/^[A-Z0-9]{4}$/i.test(icao)) return [];
    icao = icao.toUpperCase();
    const cached = notamCache.get(icao);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const config = useRuntimeConfig();
    const clientId = config.FAA_NOTAMS_CLIENT_ID ?? process.env.FAA_NOTAMS_CLIENT_ID;
    const clientSecret = config.FAA_NOTAMS_CLIENT_SECRET ?? process.env.FAA_NOTAMS_CLIENT_SECRET;

    if (!clientId || !clientSecret) return [];

    if (!token || expire < Date.now()) {
        if (!tokenRequest) {
            tokenRequest = (async () => {
        const params = new URLSearchParams();
        params.set('grant_type', 'client_credentials');

        const faaTokenRequest = await faaFetch<{
            access_token: string;
            expires_in: string;
        }>('https://api-nms.aim.faa.gov/v1/auth/token', {
            method: 'POST',
            body: params,
            headers: {
                Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
            },
        });
        token = faaTokenRequest.access_token;
        expire = Date.now() + (1000 * (Number(faaTokenRequest.expires_in) - 5));
            })().finally(() => { tokenRequest = undefined; });
        }
        await tokenRequest;
    }

    const notams: VatsimAirportDataNotam[] = [];
    const notamsText: string[] = [];

    const url = new URL('https://api-nms.aim.faa.gov/nmsapi/v1/notams');
    url.searchParams.set('nmsResponseFormat', 'geoJson');
    url.searchParams.set('location', icao);

    const data = await faaFetch<FAANotamsResponse>(url.toString(), {
        headers: {
            Authorization: `Bearer ${token}`,
            nmsResponseFormat: 'GEOJSON',
        },
    });

    if (!Array.isArray(data?.data?.geojson)) return [];

    for (const notam of data.data.geojson.toSorted((a, b) => new Date(b.properties.coreNOTAMData.notam.effectiveStart ?? 0).getTime() - new Date(a.properties.coreNOTAMData.notam.effectiveStart ?? 0).getTime())) {
        const data = notam.properties.coreNOTAMData.notam;

        if (data.effectiveEnd && data.effectiveEnd !== 'PERM' && data.effectiveEnd.startsWith('20') && new Date(data.effectiveEnd).getTime() < Date.now()) continue;

        const formattedText = notam.properties.coreNOTAMData.notamTranslation?.find(x => x.type === 'ICAO')?.formattedText;

        notams.push({
            number: data.number ?? '',
            type: (data.type ?? 'N') as any,
            issued: data.issued ?? '',
            effectiveFrom: data.effectiveStart ?? '',
            effectiveTo: data.effectiveEnd ?? '',
            text: data.text ?? '',
            formattedText: formattedText,
            classification: (data.classification ?? 'DOM') as any,
            schedule: data.schedule || undefined,
            scope: data.scope,
        });
    }

    notamCache.set(icao, { expiresAt: Date.now() + NOTAM_CACHE_TTL, data: notams });
    return notams;
}

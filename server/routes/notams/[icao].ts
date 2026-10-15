import {getAirportNotams} from "~~/utils";

export default defineEventHandler(async (event) => {
    const icao = getRouterParam(event, 'icao');
    if (!icao) {
        throw createError({ statusCode: 400, statusMessage: 'ICAO code is required' });
    }
    return getAirportNotams(icao);
})

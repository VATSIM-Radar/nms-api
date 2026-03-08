import {getAirportNotams} from "~~/utils";

export default defineEventHandler(async (event) => {
    return getAirportNotams(getRouterParam(event, 'icao'))
})
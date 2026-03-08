export default defineNitroConfig({
    srcDir: "server",

    compatibilityDate: "2026-03-08",
    runtimeConfig: {
        FAA_NOTAMS_CLIENT_ID: process.env.FAA_NOTAMS_CLIENT_ID ?? '',
        FAA_NOTAMS_CLIENT_SECRET: process.env.FAA_NOTAMS_CLIENT_SECRET ?? '',
    },
});

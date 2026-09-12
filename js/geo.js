/**
 * geo.js
 * Real-world grounding for the "departure airport" setting (js/settings.js)
 * and the flight visual (js/focus.js): turns the browser's own Geolocation
 * API into a nearest-real-airport lookup over TFS.AIRPORTS
 * (data/airports.js), or just picks one at random. The coordinate the
 * browser reports is used locally only, for one nearest-airport comparison,
 * and is never stored or sent anywhere — this app doesn't have a server to
 * send it to in the first place.
 *
 * Every call here fails soft: no geolocation support, a denied permission,
 * or a timeout all just reject the returned promise rather than throwing,
 * so a caller can always fall back to the current setting or Bangkok
 * without a try/catch of its own.
 */
(function (global) {
    'use strict';

    const TFS = global.TFS = global.TFS || {};
    const U = TFS.Utils;

    function airportById(id) {
        return (TFS.AIRPORTS || []).find((a) => a.id === id) || null;
    }

    function nearestAirport(latlng) {
        const list = TFS.AIRPORTS || [];
        if (!list.length) return null;
        return list.reduce((best, a) => (U.haversineKm(latlng, a.latlng) < U.haversineKm(latlng, best.latlng) ? a : best), list[0]);
    }

    function randomAirport() {
        const list = TFS.AIRPORTS || [];
        return list.length ? list[Math.floor(Math.random() * list.length)] : null;
    }

    /** Resolves to the real airport nearest the device's current location.
     *  Rejects (never hangs) if geolocation isn't supported, permission is
     *  denied, or the browser can't get a fix within the timeout. */
    function nearestAirportFromDevice() {
        return new Promise((resolve, reject) => {
            if (!('geolocation' in navigator)) { reject(new Error('geolocation_unsupported')); return; }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const nearest = nearestAirport([pos.coords.latitude, pos.coords.longitude]);
                    if (nearest) resolve(nearest); else reject(new Error('no_airports'));
                },
                (err) => reject(err),
                { timeout: 8000, maximumAge: 5 * 60 * 1000 }
            );
        });
    }

    TFS.Geo = { airportById, nearestAirport, randomAirport, nearestAirportFromDevice };

})(window);

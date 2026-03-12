// v2026-03-06 — replace ALL files, hard refresh Cmd+Shift+R
// ════════════════════════════════════════════════════════
//  main.js — Data loading + initialization
//  Loads world + US states + US counties for zoom feature
// ════════════════════════════════════════════════════════

(async function main() {

    const loadingEl = document.createElement("p");
    loadingEl.id = "loading-msg";
    loadingEl.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);" +
        "font-size:0.8rem;color:#888;z-index:9999;letter-spacing:2px;";
    loadingEl.textContent = "Loading data\u2026";
    document.body.appendChild(loadingEl);

    async function loadCSV(path, parser) {
        try {
            const data = await d3.csv(path, parser);
            console.log("\u2713 " + path + ": " + data.length + " rows");
            return data;
        } catch (e) {
            console.warn("\u2717 " + path + ":", e.message);
            return null;
        }
    }

    // Row parsers
    const parseBeeswarm = d => ({
        country_group: d.country_group,
        sponsor_cat: d.sponsor_cat === "NA" ? null : +d.sponsor_cat,
        year_bucket: d.year_bucket, gender: d.gender,
        n_children: +d.n_children, dot_id: +d.dot_id
    });
    const parseMonthly = d => ({
        month: d.month, country_group: d.country_group, gender: d.gender, n: +d.n
    });
    const parseMonthlyGender = d => ({
        month: d.month, gender: d.gender, n: +d.n
    });
    const parseSponsorCountry = d => ({
        country_group: d.country_group,
        sponsor_cat: d.sponsor_cat === "NA" ? null : +d.sponsor_cat,
        n: +d.n, pct: +d.pct
    });
    const parseSponsorYear = d => ({
        year_entry: +d.year_entry,
        sponsor_cat: d.sponsor_cat === "NA" ? null : +d.sponsor_cat,
        n: +d.n, pct: +d.pct
    });
    const parseSponsorGender = d => ({
        gender: d.gender,
        sponsor_cat: d.sponsor_cat === "NA" ? null : +d.sponsor_cat,
        n: +d.n, pct: +d.pct
    });
    const parseZip = d => ({
        sponsor_zip: d.sponsor_zip, country_group: d.country_group,
        gender: d.gender,
        sponsor_cat: d.sponsor_cat === "NA" ? null : +d.sponsor_cat,
        year_entry: +d.year_entry, n: +d.n,
        lat: +d.lat, lng: +d.lng, major_city: d.major_city, state: d.state
    });
    try {
        const [
            beeswarmData, monthlyCountry, monthlyGender,
            sponsorByCountry, sponsorByYear, sponsorByGender,
            zipDetail,
            world, us, counties
        ] = await Promise.all([
            loadCSV("data/processed/beeswarm_agg.csv", parseBeeswarm),
            loadCSV("data/processed/monthly_counts.csv", parseMonthly),
            loadCSV("data/processed/monthly_gender.csv", parseMonthlyGender),
            loadCSV("data/processed/sponsor_by_country.csv", parseSponsorCountry),
            loadCSV("data/processed/sponsor_by_year.csv", parseSponsorYear),
            loadCSV("data/processed/sponsor_by_gender.csv", parseSponsorGender),
            loadCSV("data/processed/zip_map_detail.csv", parseZip),
            d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
            d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),
            d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json")
        ]);

        const worldGeo = topojson.feature(world, world.objects.countries);
        const statesGeo = topojson.feature(us, us.objects.states);
        const countiesGeo = counties ? topojson.feature(counties, counties.objects.counties) : null;

        // State destinations for migration map
        const stateDestinations = {};
        if (zipDetail) {
            zipDetail.forEach(d => {
                if (!stateDestinations[d.country_group]) stateDestinations[d.country_group] = {};
                const sm = stateDestinations[d.country_group];
                sm[d.state] = (sm[d.state] || 0) + d.n;
            });
            for (const c in stateDestinations) {
                const sm = stateDestinations[c];
                stateDestinations[c] = Object.entries(sm)
                    .map(([state, n]) => ({ state, n }))
                    .sort((a, b) => b.n - a.n);
            }
        }

        // Year filter
        if (zipDetail) {
            const years = [...new Set(zipDetail.map(d => d.year_entry))].sort();
            const sel = document.getElementById("filter-year");
            years.forEach(y => {
                const o = document.createElement("option");
                o.value = y; o.textContent = y; sel.appendChild(o);
            });
        }

        if (beeswarmData) migration.init(beeswarmData, worldGeo, statesGeo, stateDestinations);
        if (monthlyCountry && monthlyGender) timeline.init(monthlyCountry, monthlyGender);
        if (sponsorByCountry && sponsorByYear && sponsorByGender)
            sponsors.init(sponsorByCountry, sponsorByYear, sponsorByGender);

        // Aggregate ZIP detail → one row per ZIP (for state zoom bubbles)
        // This replaces the zip_totals_agg.csv file entirely
        let zipAggData = [];
        if (zipDetail) {
            const byZip = {};
            zipDetail.forEach(d => {
                if (!byZip[d.sponsor_zip]) {
                    byZip[d.sponsor_zip] = {
                        zip: d.sponsor_zip, lat: d.lat, lng: d.lng,
                        state: d.state, city: d.major_city, n: 0
                    };
                }
                byZip[d.sponsor_zip].n += d.n;
            });
            zipAggData = Object.values(byZip).filter(d => d.n > 0);
            console.log("\u2713 zip agg (computed):", zipAggData.length, "ZIPs");
            if (zipAggData.length > 0) console.log("  sample:", JSON.stringify(zipAggData[0]));
        }

        initCustomSelects();

        if (zipDetail)
            usMap.init(statesGeo, countiesGeo, zipDetail, zipAggData);

        scrolly.init();
        console.log("\u2713 All modules initialized");

    } catch (err) {
        console.error("Initialization failed:", err);
    } finally {
        const msg = document.getElementById("loading-msg");
        if (msg) msg.remove();
    }
})();
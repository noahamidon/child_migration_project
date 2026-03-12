// v2026-03-06 — replace ALL files, hard refresh Cmd+Shift+R
// ════════════════════════════════════════════════════════
//  us_map.js — Choropleth + click-to-zoom with ZIP bubbles
//  Dramatic bubbles, density shading, neighboring states visible
// ════════════════════════════════════════════════════════

const usMap = (() => {
    let svg, g, stateG, dotG;
    let projection, path;
    let rawData = [], zipAgg = [];
    let stateFeatures;
    let tooltip;
    let width, height;
    let zoomedState = null;
    let colorScale;
    let perCapita = false;

    // 2020 Census state populations
    const STATE_POP = {
        AL:5024279, AK:733391, AZ:7151502, AR:3011524, CA:39538223, CO:5773714,
        CT:3605944, DE:989948, FL:21538187, GA:10711908, HI:1455271, ID:1839106,
        IL:12812508, IN:6785528, IA:3190369, KS:2937880, KY:4505836, LA:4657757,
        ME:1362359, MD:6177224, MA:7029917, MI:10077331, MN:5706494, MS:2961279,
        MO:6154913, MT:1084225, NE:1961504, NV:3104614, NH:1377529, NJ:9288994,
        NM:2117522, NY:20201249, NC:10439388, ND:779094, OH:11799448, OK:3959353,
        OR:4237256, PA:13002700, RI:1097379, SC:5118425, SD:886667, TN:6910840,
        TX:29145505, UT:3271616, VT:643077, VA:8631393, WA:7705281, WV:1793716,
        WI:5893718, WY:576851, DC:689545, PR:3285874
    };

    const SN2A = {
        "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR",
        "California":"CA","Colorado":"CO","Connecticut":"CT","Delaware":"DE",
        "Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID",
        "Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS",
        "Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD",
        "Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS",
        "Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV",
        "New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY",
        "North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK",
        "Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC",
        "South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT",
        "Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV",
        "Wisconsin":"WI","Wyoming":"WY","District of Columbia":"DC","Puerto Rico":"PR"
    };

    function abbrOf(d) {
        return d.properties.postal || d.properties.STUSPS || d.properties.abbr
            || SN2A[d.properties.name] || "";
    }

    function init(statesGeo, countiesGeo, detailData, zipAggData) {
        svg = d3.select("#us-map-svg");
        tooltip = d3.select("#map-tooltip");
        const ctr = document.getElementById("us-map-container");
        width = ctr.clientWidth || 900;
        height = ctr.clientHeight || 500;
        svg.attr("width", width).attr("height", height);


        projection = d3.geoAlbersUsa().fitSize([width, height], statesGeo);
        path = d3.geoPath().projection(projection);

        stateFeatures = statesGeo.features;
        rawData = detailData;
        zipAgg = zipAggData || [];

        g = svg.append("g");
        stateG = g.append("g").attr("class", "state-layer");
        dotG   = g.append("g").attr("class", "dot-layer");

        // Draw states
        stateG.selectAll("path.state")
            .data(stateFeatures).enter().append("path")
            .attr("class", "state").attr("d", path)
            .attr("fill", "#f4f2ee").attr("stroke", "#c8c2b8").attr("stroke-width", 1)
            .style("cursor", "pointer")
            .on("mouseover", onHover).on("mousemove", onMove).on("mouseout", onOut)
            .on("click", onStateClick);

        // Back button
        const bk = svg.append("g").attr("class", "back-btn").attr("opacity", 0)
            .style("cursor", "pointer").on("click", zoomOut);
        bk.append("rect").attr("x", 12).attr("y", 12).attr("width", 72).attr("height", 28)
            .attr("rx", 4).attr("fill", "#edeae5").attr("stroke", "#c8c2b8");
        bk.append("text").attr("x", 48).attr("y", 31)
            .attr("text-anchor", "middle").attr("fill", "#555")
            .attr("font-size", "0.75rem").text("\u2190 Back");

        // Legend — positioned above Michigan
        const defs = svg.append("defs");
        const CHORO = ["#fdf4e8", "#d4714a", "#943c3c"];
        const grad = defs.append("linearGradient").attr("id", "map-grad");
        grad.append("stop").attr("offset", "0%").attr("stop-color", CHORO[0]);
        grad.append("stop").attr("offset", "50%").attr("stop-color", CHORO[1]);
        grad.append("stop").attr("offset", "100%").attr("stop-color", CHORO[2]);
        const miPt = projection([-84.5, 47.5]);
        const lgX = miPt ? miPt[0] - 100 : width - 230;
        const lgY = miPt ? miPt[1] - 55 : height - 45;
        const lg = svg.append("g").attr("transform", `translate(${lgX},${lgY})`);
        lg.append("rect").attr("width", 200).attr("height", 12).attr("rx", 3).attr("fill", "url(#map-grad)");
        lg.append("text").attr("x", 0).attr("y", 26).attr("fill", "#444").attr("font-size", "0.7rem").text("0");
        lg.append("text").attr("class", "legend-max").attr("x", 200).attr("y", 26)
            .attr("text-anchor", "end").attr("fill", "#444").attr("font-size", "0.7rem");
        lg.append("text").attr("class", "legend-label").attr("x", 100).attr("y", -6).attr("text-anchor", "middle")
            .attr("fill", "#444").attr("font-size", "0.7rem").text("Children placed");

        updateMap({});

        ["filter-country", "filter-year", "filter-sponsor", "filter-gender"].forEach(id => {
            const el = document.getElementById(id);
            el.addEventListener("change", () => {
                if (zoomedState) zoomOut();
                updateMap(getFilters());
            });
            // Prevent scroll wheel from accidentally changing the value while
            // the user is scrolling the page (only block when dropdown is closed)
            el.addEventListener("wheel", e => {
                if (document.activeElement !== el) e.preventDefault();
            }, { passive: false });
        });

        document.getElementById("toggle-percapita").addEventListener("click", function() {
            perCapita = !perCapita;
            this.dataset.active = perCapita;
            this.querySelectorAll(".toggle-opt").forEach((el, i) => {
                el.classList.toggle("active", perCapita ? i === 1 : i === 0);
            });
            if (zoomedState) zoomOut();
            updateMap(getFilters());
        });

        console.log("  us map:", rawData.length, "detail,", zipAgg.length, "zip agg");
    }

    function getFilters() {
        return {
            country: document.getElementById("filter-country").value,
            year: document.getElementById("filter-year").value,
            sponsor: document.getElementById("filter-sponsor").value,
            gender: document.getElementById("filter-gender").value
        };
    }

    function filterData(f) {
        let d = rawData;
        if (f.country && f.country !== "all") d = d.filter(r => r.country_group === f.country);
        if (f.year && f.year !== "all") d = d.filter(r => String(r.year_entry) === f.year);
        if (f.sponsor && f.sponsor !== "all") d = d.filter(r => String(r.sponsor_cat) === f.sponsor);
        if (f.gender && f.gender !== "all") d = d.filter(r => r.gender === f.gender);
        return d;
    }

    function stateValue(abbr, rawCount) {
        if (!perCapita) return rawCount;
        const pop = STATE_POP[abbr];
        return pop ? (rawCount / pop) * 100000 : 0;
    }

    function updateMap(f) {
        const filtered = filterData(f);
        const byState = d3.rollup(filtered, v => d3.sum(v, r => r.n), r => r.state);
        const scaledValues = [...byState.entries()].map(([a, n]) => stateValue(a, n));
        const mx = d3.max(scaledValues) || 1;
        colorScale = d3.scaleLinear().domain([0, mx / 2, mx])
            .range(["#fdf4e8", "#d4714a", "#943c3c"]).interpolate(d3.interpolateRgb);
        svg.select(".legend-max").text(perCapita ? d3.format(".1f")(mx) : d3.format(",")(mx));
        svg.select(".legend-label").text(perCapita ? "Per 100k residents" : "Children placed");

        stateG.selectAll("path.state").transition("fill").duration(600)
            .attr("fill", function(d) {
                const a = abbrOf(d);
                const raw = byState.get(a) || 0;
                const v = stateValue(a, raw);
                this.__val = v; this.__abbr = a; this.__name = d.properties.name || a;
                this.__raw = raw;
                return v > 0 ? colorScale(v) : "#f4f2ee";
            });

        const sorted = [...byState.entries()].sort((a, b) => b[1] - a[1]);
        const totalN = d3.sum(filtered, r => r.n);
        document.getElementById("map-stats").innerHTML = `
            <h3>${d3.format(",")(totalN)} children</h3>
            <p style="font-size:0.8rem;color:#888;margin-bottom:16px">matching current filters</p>
            <h4>Top States</h4>
            ${sorted.slice(0, 10).map(([s, n]) =>
                `<p><span style="color:#943c3c;font-weight:600">${s}</span> \u2014 ${d3.format(",")(n)}</p>`
            ).join("")}
            <p style="margin-top:16px;font-size:0.72rem;color:#888">Click any state to see ZIP-level detail</p>
        `;
    }

    function onStateClick(event, d) {
        event.stopPropagation();
        const a = abbrOf(d);
        if (zoomedState === a) { zoomOut(); return; }
        zoomIn(d, a);
    }

    function zoomIn(feat, stAbbr) {
        zoomedState = stAbbr;
        const stName = feat.properties.name || stAbbr;

        // Compute zoom
        const [[x0, y0], [x1, y1]] = path.bounds(feat);
        const bw = x1 - x0, bh = y1 - y0;
        const scale = Math.min(8, 0.8 / Math.max(bw / width, bh / height));
        const tx = width / 2 - scale * (x0 + x1) / 2;
        const ty = height / 2 - scale * (y0 + y1) / 2;

        g.transition().duration(750).attr("transform", `translate(${tx},${ty}) scale(${scale})`);

        // Neighboring states: keep choropleth color, slightly dimmed. Selected state: outline only.
        stateG.selectAll("path.state").transition("fill").duration(600)
            .attr("fill", function(d) {
                const a = abbrOf(d);
                if (a === stAbbr) return "#f7f5f2";
                const v = this.__val || 0;
                return v > 0 ? colorScale(v) : "#f4f2ee";
            })
            .attr("opacity", function(d) {
                const a = abbrOf(d);
                if (a === stAbbr) return 1;
                return 0.75;
            })
            .attr("stroke", function(d) {
                const a = abbrOf(d);
                return a === stAbbr ? "#943c3c" : "#b0a99f";
            })
            .attr("stroke-width", function(d) {
                const a = abbrOf(d);
                return a === stAbbr ? 2.5 / scale : 1.8 / scale;
            });

        showZipDots(stAbbr, scale);

        svg.select(".back-btn").transition().duration(400).attr("opacity", 1);

        // Sidebar
        const filtered = filterData(getFilters()).filter(r => r.state === stAbbr);
        const byZip = d3.rollup(filtered, v => d3.sum(v, r => r.n), r => r.sponsor_zip);
        const sorted = [...byZip.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
        const zipLookup = {};
        zipAgg.forEach(z => { zipLookup[z.zip] = z.city; });
        const totalN = d3.sum(filtered, r => r.n);

        document.getElementById("map-stats").innerHTML = `
            <h3>${stName}</h3>
            <p style="font-size:0.9rem;color:#555;margin-bottom:4px">${d3.format(",")(totalN)} children placed</p>
            <p style="font-size:0.72rem;color:#888;margin-bottom:16px">Bubble size = children at each ZIP code</p>
            <h4>Top ZIP Codes</h4>
            ${sorted.map(([zip, n]) => {
                const city = zipLookup[zip] || "";
                return `<p><span style="color:#943c3c;font-weight:600">${city || zip}</span>${city ? " (" + zip + ")" : ""} \u2014 ${d3.format(",")(n)}</p>`;
            }).join("")}
            <p style="margin-top:16px;font-size:0.72rem;color:#888">Click "\u2190 Back" to return</p>
        `;
    }

    function showZipDots(stAbbr, scale) {
        dotG.selectAll("*").remove();

        const stZips = zipAgg.filter(z => z.state === stAbbr && z.n > 0);
        console.log("showZipDots:", stAbbr, stZips.length, "ZIPs");

        if (!stZips.length) return;

        const maxN = d3.max(stZips, d => d.n);
        // Dramatic sizing: min 3px, max 20px (scaled for zoom)
        const rScale = d3.scaleSqrt().domain([1, maxN]).range([3 / scale, 20 / scale]);

        // Sort largest first so small dots render on top
        stZips.sort((a, b) => b.n - a.n);


        // Second pass: solid bubbles
        dotG.selectAll("circle.bubble")
            .data(stZips).enter().append("circle")
            .attr("class", "bubble")
            .attr("cx", d => { const p = projection([d.lng, d.lat]); return p ? p[0] : -9999; })
            .attr("cy", d => { const p = projection([d.lng, d.lat]); return p ? p[1] : -9999; })
            .style("--bubble-r", d => rScale(d.n) + "px")
            .style("--bubble-delay", (_d, i) => Math.min(i, 500) + "ms")
            .attr("fill", "#943c3c")
            .attr("fill-opacity", 0.45)
            .attr("stroke", "#943c3c")
            .attr("stroke-opacity", 0.85)
            .attr("stroke-width", 0.6 / scale)
            .on("mouseover", function(event, d) {
                tooltip.html(`<h3>${d.city || d.zip}</h3><p>ZIP ${d.zip}</p><p>${d3.format(",")(d.n)} children</p>`)
                    .style("opacity", 1);
                d3.select(this).attr("fill-opacity", 0.75).attr("stroke-width", 1.5 / scale);
            })
            .on("mousemove", function(event) {
                const [mx, my] = d3.pointer(event, svg.node());
                positionTooltip(mx, my);
            })
            .on("mouseout", function() {
                tooltip.style("opacity", 0);
                d3.select(this).attr("fill-opacity", 0.45).attr("stroke-width", 0.6 / scale);
            });

        dotG.attr("opacity", 1);
    }

    function zoomOut() {
        zoomedState = null;
        g.transition().duration(750).attr("transform", "");

        stateG.selectAll("path.state").transition("style").duration(600)
            .attr("opacity", 1).attr("stroke", "#c8c2b8").attr("stroke-width", 1);

        updateMap(getFilters());

        dotG.selectAll("circle").transition().duration(400)
            .attr("fill-opacity", 0).attr("stroke-opacity", 0)
            .on("end", function() { d3.select(this).remove(); });
        svg.select(".back-btn").transition().duration(400).attr("opacity", 0);
    }

    function onHover(event, d) {
        if (zoomedState) return;
        const name = this.__name || abbrOf(d);
        const val = this.__val || 0;
        const rawVal = this.__raw != null ? this.__raw : val;
        const dispVal = perCapita && STATE_POP[this.__abbr]
            ? `${d3.format(".1f")(stateValue(this.__abbr, rawVal))} per 100k (${d3.format(",")(rawVal)} total)`
            : `${d3.format(",")(rawVal)} children`;
        tooltip.html(`<h3>${name}</h3><p>${dispVal}</p>`)
            .style("opacity", 1);
        d3.select(this).attr("stroke", "#2c2c2c").attr("stroke-width", 1);
    }

    function positionTooltip(mx, my) {
        const ttWidth = tooltip.node().offsetWidth || 160;
        const east = mx > width * 0.75;
        tooltip.style("left", east ? (mx - ttWidth - 15) + "px" : (mx + 15) + "px")
               .style("top", (my - 10) + "px");
    }

    function onMove(event) {
        const [mx, my] = d3.pointer(event, svg.node());
        positionTooltip(mx, my);
    }

    function onOut() {
        tooltip.style("opacity", 0);
        if (!zoomedState) d3.select(this).attr("stroke", "#c8c2b8").attr("stroke-width", 1);
    }

    return { init, updateMap };
})();
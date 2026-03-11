// v2026-03-06 — replace ALL files, hard refresh Cmd+Shift+R
// ════════════════════════════════════════════════════════
//  sponsors.js — Sponsor category visualizations
//  Fixed layout: legend always top-center, content always centered
// ════════════════════════════════════════════════════════

const sponsors = (() => {
    let svg, g, legendG, contentG, width, height, margin;
    let dataByCountry, dataByYear, dataByGender;
    let ready = false;
    let currentStep = null;

    const CATC = { 1: "#3d6e4e", 2: "#9e862f", 3: "#943c3c" };
    const CATL = { 1: "Parent / Guardian", 2: "Relative", 3: "Non-relative" };

    // Fixed layout zones
    const LEGEND_Y = 0;
    const CONTENT_TOP = 55;   // content starts below legend

    function init(byCountry, byYear, byGender) {
        svg = d3.select("#sponsor-svg");
        const ctr = document.getElementById("sponsor-sticky");
        const W = ctr.clientWidth || window.innerWidth;
        const H = ctr.clientHeight || window.innerHeight;
        svg.attr("width", W).attr("height", H);

        margin = { top: 50, right: 50, bottom: 40, left: 50 };
        width  = W - margin.left - margin.right;
        height = H - margin.top - margin.bottom;

        g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        // Persistent legend — always top center, never moves
        legendG = g.append("g").attr("class", "sponsor-legend")
            .attr("transform", `translate(0, ${LEGEND_Y})`);
        [1, 2, 3].forEach((cat, i) => {
            const zoneW = width / 3;
            const label = CATL[cat];
            // Approximate content width: 14px rect + 8px gap + ~7.5px/char
            const contentW = 14 + 8 + label.length * 7.5;
            const startX = zoneW * i + (zoneW - contentW) / 2;
            legendG.append("rect").attr("x", startX).attr("y", 0)
                .attr("width", 14).attr("height", 14).attr("rx", 2)
                .attr("fill", CATC[cat]);
            legendG.append("text").attr("x", startX + 22).attr("y", 12)
                .attr("fill", "#555").attr("font-size", "0.78rem")
                .text(label);
        });

        // Content area — below legend, centered
        contentG = g.append("g").attr("class", "sponsor-content")
            .attr("transform", `translate(0, ${CONTENT_TOP})`);

        dataByCountry = byCountry;
        dataByYear    = byYear;
        dataByGender  = byGender;
        ready = true;

        drawOverall();
    }

    // Available content area dimensions
    function contentH() { return height - CONTENT_TOP - 10; }

    // ─── Shared: draw a horizontal stacked bar ───
    function stackedBar(parent, x, y, w, h, cats, delay) {
        delay = delay || 0;
        let xOff = 0;
        cats.filter(d => d.cat != null).sort((a, b) => a.cat - b.cat).forEach(d => {
            const bw = d.pct * w;
            parent.append("rect")
                .attr("x", x + xOff).attr("y", y)
                .attr("width", 0).attr("height", h).attr("rx", 3)
                .attr("fill", CATC[d.cat]).attr("opacity", 0.9)
                .transition().duration(700).delay(delay).ease(d3.easeCubicOut)
                .attr("width", bw);

            if (bw > 40) {
                parent.append("text")
                    .attr("x", x + xOff + bw / 2).attr("y", y + h / 2 + 5)
                    .attr("text-anchor", "middle")
                    .attr("fill", "#fff")
                    .attr("font-size", h > 35 ? "0.9rem" : "0.72rem")
                    .attr("font-weight", 400).attr("opacity", 0)
                    .text(Math.round(d.pct * 100) + "%")
                    .transition().delay(delay + 400).duration(350).attr("opacity", 1);
            }
            xOff += bw;
        });
    }

    // ─── OVERALL ───
    function drawOverall() {
        contentG.selectAll("*").remove();
        currentStep = "sponsor-overall";

        const cH = contentH();
        const totals = {};
        let total = 0;
        dataByCountry.forEach(d => {
            if (d.sponsor_cat == null) return;
            totals[d.sponsor_cat] = (totals[d.sponsor_cat] || 0) + d.n;
            total += d.n;
        });

        const barW = Math.min(width * 0.7, 650);
        const barH = 55;
        const barX = (width - barW) / 2;
        const barY = (cH - barH) / 2 - 20;

        // Title
        contentG.append("text").attr("x", width / 2).attr("y", barY - 25)
            .attr("text-anchor", "middle").attr("fill", "#2c2c2c")
            .attr("font-size", "1.05rem").attr("font-weight", 500)
            .text(d3.format(",")(total) + " children released to sponsors");

        const cats = [1, 2, 3].map(c => ({ cat: c, pct: (totals[c] || 0) / total, n: totals[c] || 0 }));
        stackedBar(contentG, barX, barY, barW, barH, cats);

        // Counts below bar
        let xOff = 0;
        cats.forEach(d => {
            const bw = d.pct * barW;
            contentG.append("text")
                .attr("x", barX + xOff + bw / 2).attr("y", barY + barH + 20)
                .attr("text-anchor", "middle").attr("fill", "#888")
                .attr("font-size", "0.7rem")
                .text(d3.format(",")(d.n));
            xOff += bw;
        });
    }

    // ─── BY COUNTRY ───
    function drawByCountry() {
        contentG.selectAll("*").remove();
        currentStep = "sponsor-by-country";

        const cH = contentH();
        const countries = ["Guatemala", "Honduras", "El Salvador", "Mexico", "Other"];
        const barW = Math.min(width * 0.55, 500);
        const barH = 26;
        const gap = (cH - 20) / countries.length;
        // Center the full group (label + bar + count) around width/2
        const labelMaxW = 75, countMaxW = 55;
        const barX = (width - (labelMaxW + 14 + barW + 12 + countMaxW)) / 2 + labelMaxW + 14;
        const startY = 15;

        countries.forEach((c, ci) => {
            const rows = dataByCountry.filter(d => d.country_group === c && d.sponsor_cat != null);
            if (!rows.length) return;
            const y = startY + ci * gap;
            const total = d3.sum(rows, d => d.n);

            // Country label (left of bar)
            contentG.append("text")
                .attr("x", barX - 14).attr("y", y + barH / 2 + 5)
                .attr("text-anchor", "end").attr("fill", "#555")
                .attr("font-size", "0.82rem").attr("font-weight", 400)
                .text(c);

            const cats = rows.map(d => ({ cat: d.sponsor_cat, pct: d.pct, n: d.n }));
            stackedBar(contentG, barX, y, barW, barH, cats, ci * 80);

            // Total (right of bar)
            contentG.append("text")
                .attr("x", barX + barW + 12).attr("y", y + barH / 2 + 5)
                .attr("fill", "#666").attr("font-size", "0.68rem")
                .text(d3.format(",")(total));
        });
    }

    // ─── TREND ───
    function drawTrend() {
        contentG.selectAll("*").remove();
        currentStep = "sponsor-trend";

        const cH = contentH();
        const valid = dataByYear.filter(d => d.sponsor_cat != null);
        const years = [...new Set(valid.map(d => d.year_entry))].sort();

        const chartML = 55, chartMB = 40, chartMR = 20;
        const chartW = width - chartML - chartMR;
        const chartH = cH - chartMB - 10;
        const chartX = (width - chartW - chartML) / 2 + chartML;

        const tG = contentG.append("g").attr("transform", `translate(${chartX - chartML}, 0)`);
        const inner = tG.append("g").attr("transform", `translate(${chartML}, 0)`);

        const xB = d3.scaleBand().domain(years).range([0, chartW]).padding(0.25);
        const yM = d3.max(d3.rollups(valid, v => d3.sum(v, d => d.n), d => d.year_entry), d => d[1]);
        const yS = d3.scaleLinear().domain([0, yM]).nice().range([chartH, 0]);

        // Y axis
        const yAx = inner.append("g").call(d3.axisLeft(yS).ticks(5).tickFormat(d3.format("~s")));
        yAx.selectAll("text").attr("fill", "#888");
        yAx.selectAll("line,.domain").attr("stroke", "#c8c2b8");

        // Bars
        years.forEach((yr, yi) => {
            const rows = valid.filter(d => d.year_entry === yr).sort((a, b) => a.sponsor_cat - b.sponsor_cat);
            let y0 = chartH;
            rows.forEach(d => {
                const bH = chartH - yS(d.n);
                inner.append("rect")
                    .attr("x", xB(yr)).attr("y", y0)
                    .attr("width", xB.bandwidth()).attr("height", 0)
                    .attr("fill", CATC[d.sponsor_cat]).attr("opacity", 0.85).attr("rx", 2)
                    .transition().duration(600).delay(yi * 35)
                    .attr("y", y0 - bH).attr("height", bH);
                y0 -= bH;
            });
            inner.append("text")
                .attr("x", xB(yr) + xB.bandwidth() / 2).attr("y", chartH + 16)
                .attr("text-anchor", "middle").attr("fill", "#888").attr("font-size", "0.62rem")
                .text(yr);
        });

        // Cat 3 annotation
        const cat3 = years.map(yr => {
            const rows = valid.filter(d => d.year_entry === yr);
            const tot = d3.sum(rows, d => d.n);
            const c3 = d3.sum(rows.filter(d => d.sponsor_cat === 3), d => d.n);
            return tot > 0 ? c3 / tot : 0;
        });
        inner.append("text")
            .attr("x", chartW).attr("y", -5)
            .attr("text-anchor", "end").attr("fill", "#943c3c").attr("font-size", "0.75rem")
            .attr("opacity", 0)
            .text("Non-relative sponsors: " + Math.round(cat3[0] * 100) + "% \u2192 " + Math.round(cat3[cat3.length - 1] * 100) + "%")
            .transition().delay(700).duration(500).attr("opacity", 1);
    }

    // ─── BY GENDER ───
    function drawGender() {
        contentG.selectAll("*").remove();
        currentStep = "sponsor-gender";

        const cH = contentH();
        const barW = Math.min(width * 0.55, 500);
        const barH = 38;
        const barX = (width - barW) / 2;
        const centerY = cH / 2 - 40;

        ["M", "F"].forEach((gen, gi) => {
            const rows = dataByGender.filter(d => d.gender === gen && d.sponsor_cat != null);
            const total = d3.sum(rows, d => d.n);
            const y = centerY + gi * 80;

            // Label
            contentG.append("text")
                .attr("x", width / 2).attr("y", y - 12)
                .attr("text-anchor", "middle").attr("fill", "#2c2c2c")
                .attr("font-size", "0.95rem").attr("font-weight", 500)
                .text((gen === "M" ? "Male" : "Female") + " \u2014 " + d3.format(",")(total));

            const cats = rows.map(d => ({ cat: d.sponsor_cat, pct: d.pct, n: d.n }));
            stackedBar(contentG, barX, y, barW, barH, cats, gi * 150);
        });

        // Comparison callout
        const mCat3 = dataByGender.find(d => d.gender === "M" && d.sponsor_cat === 3);
        const fCat3 = dataByGender.find(d => d.gender === "F" && d.sponsor_cat === 3);
        if (mCat3 && fCat3) {
            contentG.append("text")
                .attr("x", width / 2).attr("y", centerY + 185)
                .attr("text-anchor", "middle").attr("fill", "#943c3c")
                .attr("font-size", "0.8rem").attr("opacity", 0)
                .text("Boys: " + Math.round(mCat3.pct * 100) + "% non-relative vs Girls: " + Math.round(fCat3.pct * 100) + "%")
                .transition().delay(800).duration(500).attr("opacity", 1);
        }
    }

    function onStep(stepId) {
        if (!ready || stepId === currentStep) return;
        switch (stepId) {
            case "sponsor-overall":    drawOverall(); break;
            case "sponsor-by-country": drawByCountry(); break;
            case "sponsor-trend":      drawTrend(); break;
            case "sponsor-gender":     drawGender(); break;
        }
    }

    return { init, onStep };
})();
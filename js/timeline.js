// v2026-03-11
// ════════════════════════════════════════════════════════
//  timeline.js — Stacked area chart
//  month column is a STRING "2015-01-01" (not a Date object)
// ════════════════════════════════════════════════════════

const timeline = (() => {
    let svg, g, width, height, margin;
    let xScale, yScale, areaGen;
    let stackedByCountry, stackedByGender;
    let currentMode = "country";

    const COUNTRY_COLORS = {
        Guatemala: "#943c3c", Honduras: "#b07348",
        "El Salvador": "#9e862f", Mexico: "#3d6e4e", Other: "#4a6180"
    };
    const GENDER_COLORS = { M: "#4a6180", F: "#943c3c" };
    const COUNTRIES = ["Guatemala", "Honduras", "El Salvador", "Mexico", "Other"];

    function buildStack(data, keys, groupKey) {
        const nested = d3.rollup(data, v => d3.sum(v, d => d.n), d => d.month, d => d[groupKey]);
        const months = [...nested.keys()].sort();
        const table = months.map(m => {
            const row = { month: new Date(m) };
            keys.forEach(k => { row[k] = nested.get(m)?.get(k) || 0; });
            return row;
        });
        return d3.stack().keys(keys)(table);
    }

    function styleAxis(sel) {
        sel.selectAll("text").attr("fill", "#888");
        sel.selectAll("line").attr("stroke", "#c8c2b8");
        sel.selectAll(".domain").attr("stroke", "#c8c2b8");
    }

    function init(monthlyByCountry, monthlyByGender) {
        svg = d3.select("#timeline-svg");
        const container = document.getElementById("timeline-sticky");
        const W = container.clientWidth || window.innerWidth;
        const H = container.clientHeight || window.innerHeight;
        svg.attr("width", W).attr("height", H);
        // Right margin shrunk — legend now lives inside the chart at the top
        margin = { top: 58, right: 20, bottom: 50, left: 60 };
        width = W - margin.left - margin.right;
        height = H - margin.top - margin.bottom;

        g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        stackedByCountry = buildStack(monthlyByCountry, COUNTRIES, "country_group");
        stackedByGender  = buildStack(monthlyByGender,  ["M", "F"], "gender");

        const allMonths = stackedByCountry[0].map(d => d.data.month);
        xScale = d3.scaleTime().domain(d3.extent(allMonths)).range([0, width]);
        const yMax = d3.max(stackedByCountry[stackedByCountry.length - 1], d => d[1]);
        yScale = d3.scaleLinear().domain([0, yMax]).nice().range([height, 0]);

        // Stacked area gen (shared)
        areaGen = d3.area()
            .x(d => xScale(d.data.month))
            .y0(d => yScale(d[0]))
            .y1(d => yScale(d[1]))
            .curve(d3.curveMonotoneX);


        const xAx = g.append("g").attr("class", "x-axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(xScale).ticks(d3.timeYear.every(1)).tickFormat(d3.timeFormat("%Y")));
        styleAxis(xAx);
        const yAx = g.append("g").attr("class", "y-axis")
            .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format("~s")));
        styleAxis(yAx);

        // Legend — horizontal strip inside chart, above the plot area
        const legendG = g.append("g").attr("class", "timeline-legend")
            .attr("transform", `translate(0, -34)`);
        drawLegend(legendG, COUNTRIES, COUNTRY_COLORS);

        g.append("line").attr("class", "anno-line").attr("stroke", "#943c3c")
            .attr("stroke-width", 1.5).attr("stroke-dasharray", "4,4").attr("opacity", 0);
        g.append("text").attr("class", "anno-label").attr("fill", "#2c2c2c")
            .attr("font-size", "0.75rem").attr("font-weight", 300).attr("opacity", 0);
    }

    // Horizontal legend — drawn at y=0 relative to the legendG group
    function drawLegend(lg, keys, colors) {
        lg.selectAll("*").remove();
        const itemW = keys.length > 2 ? 135 : 90;
        const startX = Math.max(0, (width - keys.length * itemW) / 2);
        keys.forEach((k, i) => {
            const label = k === "M" ? "Male" : k === "F" ? "Female" : k;
            const x = startX + i * itemW;
            lg.append("rect").attr("x", x).attr("y", -9)
                .attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", colors[k]);
            lg.append("text").attr("x", x + 14).attr("y", 0)
                .attr("fill", "#555").attr("font-size", "0.72rem").text(label);
        });
    }

    function drawLayers(stacked, keys, colors) {
        g.selectAll("path.area-layer").remove();
        g.selectAll("path.area-layer").data(stacked).enter().append("path")
            .attr("class", "area-layer").attr("d", areaGen)
            .attr("fill", (d, i) => colors[keys[i]]).attr("opacity", 0)
            .transition().duration(800).attr("opacity", 0.8);
    }

    // Build a proportional area gen — each series fills its share of the full height.
    // totals[i] = grand total across all series at time point i.
    function makeProportionalGen(stacked) {
        const totals = stacked[stacked.length - 1].map(d => d[1] || 1);
        return d3.area()
            .x(d => xScale(d.data.month))
            .y0((d, i) => height * (1 - d[0] / totals[i]))
            .y1((d, i) => height * (1 - d[1] / totals[i]))
            .curve(d3.curveMonotoneX);
    }

    // Draw 100% proportional stacked areas filling the full chart height
    function drawProportional(stacked, keys, colors) {
        g.selectAll("path.area-layer").remove();
        const propGen = makeProportionalGen(stacked);
        g.selectAll("path.area-layer").data(stacked).enter().append("path")
            .attr("class", "area-layer")
            .attr("d", propGen)
            .attr("fill", (d, i) => colors[keys[i]])
            .attr("opacity", 0)
            .transition().duration(700).attr("opacity", 0.85);
        // Hide count axis — proportional view has no meaningful y axis
        g.select(".y-axis").transition().duration(400).attr("opacity", 0);
    }

    // Melt the current paths (proportional) into absolute stacked form
    function meltToStacked(stacked, keys, colors) {
        const existing = g.selectAll("path.area-layer");
        if (!existing.empty()) {
            existing.transition().duration(1500).ease(d3.easeCubicInOut)
                .attr("d", areaGen)
                .attr("opacity", 0.8);
            g.select(".y-axis").transition().delay(800).duration(600).attr("opacity", 1);
        } else {
            drawLayers(stacked, keys, colors);
            g.select(".y-axis").attr("opacity", 1);
        }
    }

    // Melt current absolute stacked paths into proportional form
    function meltToProportional(stacked, keys, colors) {
        const propGen = makeProportionalGen(stacked);
        const existing = g.selectAll("path.area-layer");
        if (!existing.empty()) {
            existing.transition().duration(1500).ease(d3.easeCubicInOut)
                .attr("d", propGen)
                .attr("opacity", 0.85);
            g.select(".y-axis").transition().duration(400).attr("opacity", 0);
        } else {
            drawProportional(stacked, keys, colors);
        }
    }

    function showAnno(date, label) {
        const x = xScale(date);
        g.select(".anno-line").attr("x1",x).attr("y1",0).attr("x2",x).attr("y2",height)
            .transition().duration(500).attr("opacity", 0.6);
        g.select(".anno-label").attr("x",x+8).attr("y",20).text(label)
            .transition().duration(500).attr("opacity", 0.8);
    }
    function hideAnno() {
        g.select(".anno-line").transition().duration(300).attr("opacity", 0);
        g.select(".anno-label").transition().duration(300).attr("opacity", 0);
    }

    function onStep(stepId) {
        const annos = {
            "timeline-2019-surge": { d: new Date("2019-05-15"), l: "2019 surge" },
            "timeline-covid":      { d: new Date("2020-04-15"), l: "Title 42" },
            "timeline-2021-spike": { d: new Date("2021-09-15"), l: "2021 peak" }
        };

        if (stepId === "timeline-gender") {
            hideAnno();
            if (currentMode !== "gender") {
                currentMode = "gender";
                const ym = d3.max(stackedByGender[stackedByGender.length-1], d=>d[1]);
                yScale.domain([0,ym]).nice();
                g.select(".y-axis").transition().duration(600).attr("opacity", 1)
                    .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format("~s")))
                    .selection().call(styleAxis);
                drawLayers(stackedByGender, ["M","F"], GENDER_COLORS);
                drawLegend(svg.select(".timeline-legend"), ["M","F"], GENDER_COLORS);
            }
            return;
        }

        if (stepId === "timeline-gender-prop") {
            hideAnno();
            if (currentMode !== "gender") {
                // Switch to gender first (absolute), then immediately melt to proportional
                currentMode = "gender";
                const ym = d3.max(stackedByGender[stackedByGender.length-1], d=>d[1]);
                yScale.domain([0,ym]).nice();
                g.select(".y-axis").attr("opacity", 1)
                    .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format("~s")))
                    .selection().call(styleAxis);
                drawLayers(stackedByGender, ["M","F"], GENDER_COLORS);
                drawLegend(svg.select(".timeline-legend"), ["M","F"], GENDER_COLORS);
                // Then melt to proportional after a short delay
                setTimeout(() => meltToProportional(stackedByGender, ["M","F"], GENDER_COLORS), 900);
            } else {
                meltToProportional(stackedByGender, ["M","F"], GENDER_COLORS);
            }
            return;
        }

        // Country-mode steps — ensure y scale is set for country data
        const switchingBack = currentMode !== "country";
        if (switchingBack) {
            currentMode = "country";
            const ym = d3.max(stackedByCountry[stackedByCountry.length-1], d=>d[1]);
            yScale.domain([0,ym]).nice();
            g.select(".y-axis").transition().duration(600)
                .call(d3.axisLeft(yScale).ticks(5).tickFormat(d3.format("~s")))
                .selection().call(styleAxis);
            drawLegend(svg.select(".timeline-legend"), COUNTRIES, COUNTRY_COLORS);
        }

        if (stepId === "timeline-density") {
            hideAnno();
            drawProportional(stackedByCountry, COUNTRIES, COUNTRY_COLORS);
        } else if (stepId === "timeline-all") {
            hideAnno();
            meltToStacked(stackedByCountry, COUNTRIES, COUNTRY_COLORS);
        } else {
            if (switchingBack) drawLayers(stackedByCountry, COUNTRIES, COUNTRY_COLORS);
            annos[stepId] ? showAnno(annos[stepId].d, annos[stepId].l) : hideAnno();
        }
    }

    return { init, onStep };
})();

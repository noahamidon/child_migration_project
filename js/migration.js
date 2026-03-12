// v2026-03-06 — replace ALL files, hard refresh Cmd+Shift+R
// ════════════════════════════════════════════════════════
//  migration.js — Geo dot migration
//  Smooth transitions, country color legend, staggered movement
// ════════════════════════════════════════════════════════

const migration = (() => {
    let svg, zoomG, mapG, dotG, uiG, width, height;
    let projection, pathGen;
    let dotsData = [];
    let _driftActive = false;

    const CC = {
        Guatemala: "#943c3c", Honduras: "#b07348",
        "El Salvador": "#9e862f", Mexico: "#3d6e4e", Other: "#4a6180"
    };
    const CATC = { 1: "#3d6e4e", 2: "#9e862f", 3: "#943c3c" };
    const COUNTRIES = ["Guatemala", "Honduras", "El Salvador", "Mexico", "Other"];

    const ORIGIN = {
        Guatemala: [-90.5, 14.6], Honduras: [-87.2, 14.1],
        "El Salvador": [-88.9, 13.7], Mexico: [-102.5, 23.6], Other: [-84.0, 10.0]
    };

    const ST = {
        CA:[-119.4,36.8],TX:[-99.3,31.5],FL:[-81.5,27.8],NY:[-75.5,42.8],
        NJ:[-74.4,40.1],MD:[-76.6,39.0],VA:[-78.5,37.5],NC:[-79.5,35.6],
        GA:[-83.5,32.8],IL:[-89.0,40.0],TN:[-86.5,35.5],LA:[-91.5,31.0],
        PA:[-77.5,41.0],OH:[-82.5,40.0],SC:[-81.0,34.0],MA:[-71.5,42.2],
        AL:[-86.5,32.5],IN:[-86.0,40.0],MN:[-94.0,46.0],MI:[-84.5,44.0],
        CO:[-105.5,39.0],AZ:[-111.5,34.3],WA:[-120.5,47.5],OR:[-120.5,44.0],
        CT:[-72.7,41.6],MO:[-92.0,38.5],WI:[-89.5,44.5],KY:[-85.0,37.8],
        NE:[-99.5,41.5],IA:[-93.5,42.0],KS:[-98.5,38.5],OK:[-97.5,35.5],
        AR:[-92.0,35.0],MS:[-89.5,32.5],NV:[-116.5,39.0],UT:[-111.5,39.5],
        NM:[-105.5,34.5],DC:[-77.0,38.9],DE:[-75.5,39.0],RI:[-71.5,41.7],
        PR:[-66.5,18.2]
    };

    // Actual US-Mexico border waypoints (west → east, key geographic inflection points)
    const BORDER_PTS = [
        [-117.12, 32.53],  // Pacific/Tijuana (CA start)
        [-116.67, 32.56],  // east of Tijuana
        [-116.10, 32.62],  // near Tecate
        [-115.75, 32.65],  // Campo area
        [-115.47, 32.67],  // Mexicali/Calexico
        [-114.72, 32.72],  // Colorado River (CA/AZ tripoint)
        [-114.74, 32.60],  // descending briefly along Colorado River
        [-114.75, 32.48],  // San Luis Río Colorado (border turns SE here)
        [-114.40, 32.28],  // heading SE through AZ desert
        [-113.90, 32.05],  // continuing SE
        [-113.50, 31.95],  // west AZ desert
        [-113.10, 31.90],  // approaching Lukeville
        [-112.82, 31.87],  // Lukeville/Sonoyta
        [-112.45, 31.65],  // SE toward Nogales
        [-112.10, 31.50],  // continuing SE
        [-111.70, 31.42],  // approaching Nogales
        [-111.07, 31.34],  // Nogales, AZ
        [-110.55, 31.33],  // between Nogales and Naco
        [-110.00, 31.33],  // Naco/Bisbee area
        [-109.75, 31.33],  // approaching Douglas
        [-109.56, 31.33],  // Douglas/Agua Prieta
        [-108.21, 31.47],  // Antelope Wells (NM begins)
        [-107.22, 31.78],  // NM mid-border
        [-106.53, 31.78],  // El Paso/Juárez (Rio Grande begins)
        [-105.70, 31.04],  // Fort Hancock/Sierra Blanca area
        [-104.90, 30.18],  // Candelaria/Ruidosa area
        [-104.38, 29.56],  // Presidio/Ojinaga
        [-103.71, 29.30],  // Big Bend (entering the bend)
        [-103.15, 29.05],  // Big Bend (southernmost curve)
        [-102.50, 29.42],  // Big Bend (exiting, heading NE)
        [-101.79, 29.78],  // Langtry/Amistad reservoir
        [-100.85, 29.36],  // Del Rio/Acuña
        [-100.50, 28.71],  // Eagle Pass/Piedras Negras
        [ -99.84, 28.14],  // between Eagle Pass and Laredo
        [ -99.51, 27.50],  // Laredo/Nuevo Laredo
        [ -99.01, 26.40],  // Roma
        [ -98.80, 26.38],  // Rio Grande City
        [ -98.23, 26.07],  // McAllen/Reynosa
        [ -97.80, 26.01],  // Mission/Hidalgo area
        [ -97.47, 25.97],  // Harlingen area
        [ -97.15, 25.96],  // Brownsville/Matamoros (Gulf coast)
    ];
    // Precompute cumulative distances along border for uniform t→[lon,lat] mapping
    const _bd = (() => {
        const d = [0];
        for (let i = 1; i < BORDER_PTS.length; i++) {
            const dx = BORDER_PTS[i][0] - BORDER_PTS[i-1][0];
            const dy = BORDER_PTS[i][1] - BORDER_PTS[i-1][1];
            d.push(d[i-1] + Math.sqrt(dx*dx + dy*dy));
        }
        return d;
    })();
    const _bTotal = _bd[_bd.length - 1];
    function borderPoint(t) {
        const target = t * _bTotal;
        let i = 1;
        while (i < _bd.length - 1 && _bd[i] < target) i++;
        const segT = (_bd[i] - _bd[i-1]) === 0 ? 0 :
            (target - _bd[i-1]) / (_bd[i] - _bd[i-1]);
        return [
            BORDER_PTS[i-1][0] + segT * (BORDER_PTS[i][0] - BORDER_PTS[i-1][0]),
            BORDER_PTS[i-1][1] + segT * (BORDER_PTS[i][1] - BORDER_PTS[i-1][1])
        ];
    }

    function srand(s) { let x = Math.sin(s*9301+49297)*49297; return x-Math.floor(x); }

    function circJ(seed, r) {
        const rad = Math.sqrt(srand(seed)) * r;
        const a = srand(seed+7777) * Math.PI * 2;
        return [rad*Math.cos(a), rad*Math.sin(a)];
    }

    function proj(lon, lat) {
        const p = projection([lon, lat]);
        return p || [width/2, height/2];
    }

    function pickSt(list, seed) {
        if (!list || !list.length) return "TX";
        const tot = list.reduce((s,d) => s+d.n, 0);
        let r = srand(seed+50000) * tot;
        for (const s of list) { r -= s.n; if (r<=0) return s.state; }
        return list[0].state;
    }

    function zoomToGeo(lon, lat, factor, dur=1100) {
        const p = projection([lon, lat]);
        if (!p) return;
        const tx = width / 2 - factor * p[0];
        const ty = height / 2 - factor * p[1];
        zoomG.transition("zoom").duration(dur).ease(d3.easeCubicInOut)
            .attr("transform", `translate(${tx},${ty}) scale(${factor})`);
    }

    function resetZoom(dur=1100) {
        zoomG.transition("zoom").duration(dur).ease(d3.easeCubicInOut)
            .attr("transform", "");
    }

    function driftDot(sel, d, tick) {
        if (!_driftActive) return;
        const dx = (srand(d.dot_id + tick * 97 + 50000) - 0.5) * 14;
        const dy = (srand(d.dot_id + tick * 97 + 60000) - 0.5) * 14;
        const dur = 1600 + srand(d.dot_id + tick * 97 + 70000) * 1200;
        sel.transition("drift")
            .duration(dur).ease(d3.easeSinInOut)
            .attr("cx", d.oX + dx).attr("cy", d.oY + dy)
            .on("end", () => driftDot(sel, d, tick + 1));
    }

    function startDrift() {
        _driftActive = true;
        dotG.selectAll("circle").each(function(d) {
            const delay = srand(d.dot_id + 88888) * 1200;
            const sel = d3.select(this);
            setTimeout(() => driftDot(sel, d, 0), delay);
        });
    }

    function stopDrift() {
        _driftActive = false;
        dotG.selectAll("circle").interrupt("drift");
    }

    function init(beeData, worldGeo, usGeo, stateDest) {
        svg = d3.select("#beeswarm-svg");
        const ctr = document.getElementById("beeswarm-sticky");
        width = ctr.clientWidth || window.innerWidth;
        height = ctr.clientHeight || window.innerHeight;
        svg.attr("width", width).attr("height", height);

        projection = d3.geoMercator()
            .center([-92, 28])
            .scale(width * 0.65)
            .translate([width*0.45, height*0.62]);
        pathGen = d3.geoPath().projection(projection);

        zoomG = svg.append("g").attr("class","zoom-layer");
        mapG = zoomG.append("g").attr("class","map-layer");
        dotG = zoomG.append("g").attr("class","dot-layer");
        uiG  = svg.append("g").attr("class","ui-layer");  // fixed — not zoomed

        // Map
        if (worldGeo) {
            const ca = new Set(["Guatemala","Honduras","El Salvador","Mexico",
                "Belize","Nicaragua","Costa Rica","Panama","Colombia","Cuba"]);
            mapG.selectAll("path.wc").data(worldGeo.features).enter().append("path")
                .attr("class","wc").attr("d",pathGen)
                .attr("fill", d => {
                    const n = d.properties.name;
                    return n==="United States of America"?"#edeae5":ca.has(n)?"#e3ded7":"#f0ede8";
                }).attr("stroke","#c8c2b8").attr("stroke-width",0.5);
        }
        if (usGeo) {
            mapG.selectAll("path.st").data(usGeo.features).enter().append("path")
                .attr("class","st").attr("d",pathGen)
                .attr("fill","none").attr("stroke","#c8c2b8").attr("stroke-width",0.3);
        }

        // Build dots
        dotsData = beeData.map(d => {
            const id = d.dot_id;
            const o = ORIGIN[d.country_group] || ORIGIN.Other;
            const oj = circJ(id, 2.8);
            const dst = pickSt(stateDest[d.country_group], id);
            const dc = ST[dst] || [-98,38];
            const dj = circJ(id+20000, 1.5);

            const oP = proj(o[0]+oj[0], o[1]+oj[1]);
            const dP = proj(dc[0]+dj[0], dc[1]+dj[1]);
            // Journey midpoint: spread along the full US-Mexico border
            // Border runs from ~-117 (San Diego/Tijuana) to ~-97 (Brownsville/Matamoros)
            // Latitude varies: ~32.5 at CA end, ~26 at TX end
            const borderT = srand(id + 40000);  // 0-1, position along actual border
            const [borderLon, borderLat] = borderPoint(borderT);
            const jitter = circJ(id + 41000, 0.7);
            const mP = proj(borderLon + jitter[0] * 0.5, borderLat + jitter[1] * 0.5);

            return {
                ...d, oX:oP[0], oY:oP[1], dX:dP[0], dY:dP[1],
                mX:mP[0], mY:mP[1], dst,
                // Stagger delay based on country (so countries move in waves)
                _delay: COUNTRIES.indexOf(d.country_group) * 150 + srand(id+99999) * 300
            };
        });

        // Draw dots
        dotG.selectAll("circle").data(dotsData, d=>d.dot_id)
            .enter().append("circle")
            .attr("r", 1.1)
            .attr("cx", d=>d.oX).attr("cy", d=>d.oY)
            .attr("fill", d=>CC[d.country_group]||"#888")
            .attr("opacity", 0.45);

        // LEGEND (top-left, no overlap with dots)
        const leg = uiG.append("g").attr("class","color-legend")
            .attr("transform", `translate(20, 20)`);
        COUNTRIES.forEach((c, i) => {
            leg.append("circle").attr("cx", 6).attr("cy", i*22)
                .attr("r", 5).attr("fill", CC[c]);
            leg.append("text").attr("x", 18).attr("y", i*22+5)
                .attr("fill","#666").attr("font-size","0.75rem")
                .attr("font-weight",300).text(c);
        });

        // Cat labels (hidden until sponsor-type step)
        const catNames = {1:"Parent/Guardian", 2:"Relative", 3:"Non-relative"};
        [1,2,3].forEach(c => {
            const xP = {1:0.2, 2:0.5, 3:0.8};
            uiG.append("text").attr("class","cl")
                .attr("x", width*xP[c]).attr("y", height*0.08)
                .attr("text-anchor","middle").attr("fill",CATC[c])
                .attr("font-size","0.85rem").attr("font-weight",500)
                .attr("opacity",0).text(catNames[c]);
        });

        console.log("migration:", dotsData.length, "dots |",
            "origin:", Math.round(dotsData[0]?.oX)+","+Math.round(dotsData[0]?.oY),
            "dest:", Math.round(dotsData[0]?.dX)+","+Math.round(dotsData[0]?.dY));
    }

    function onStep(stepId) {
        console.log("migration:", stepId);
        const circles = dotG.selectAll("circle");

        // Defaults
        uiG.selectAll(".cl").transition("ui").duration(400).attr("opacity",0);
        uiG.select(".color-legend").transition("ui").duration(400).attr("opacity",1);
        mapG.transition("map").duration(800).attr("opacity",1);

        if (stepId === "ca-wide") {
            zoomToGeo(-89.5, 15.5, 2.0);
            stopDrift();
            setTimeout(startDrift, 1400);
        }
        else if (stepId === "origin-cluster") {
            zoomToGeo(-89, 14.2, 3.2);
            stopDrift();
            circles.transition("dots")
                .duration(1200).delay(d => d._delay * 0.3).ease(d3.easeCubicInOut)
                .attr("cx", d => d.oX).attr("cy", d => d.oY).attr("r", 1.1).attr("opacity", 0.45)
                .attr("fill", d => CC[d.country_group]||"#888");
            setTimeout(startDrift, 1600);
        }
        else if (stepId === "origin-split") {
            zoomToGeo(-91, 16.5, 2.2);
            stopDrift();
            circles.transition("dots")
                .duration(1200).delay(d => d._delay * 0.3).ease(d3.easeCubicInOut)
                .attr("cx", d => d.oX).attr("cy", d => d.oY).attr("r", 1.1).attr("opacity", 0.45)
                .attr("fill", d => CC[d.country_group]||"#888");
            setTimeout(startDrift, 1600);
        }
        else if (stepId === "journey") {
            _driftActive = false;
            resetZoom();
            setTimeout(() => {
                dotG.selectAll("circle").interrupt("drift");
                dotG.selectAll("circle").transition("dots")
                    .duration(2000).delay(d => d._delay).ease(d3.easeCubicInOut)
                    .attr("cx", d => d.mX).attr("cy", d => d.mY).attr("r", 1.1).attr("opacity", 0.45);
            }, 1100);
        }
        else if (stepId === "us-landing") {
            _driftActive = false;
            zoomToGeo(-96, 38, 1.4);
            setTimeout(() => {
                dotG.selectAll("circle").interrupt("drift");
                dotG.selectAll("circle").transition("dots")
                    .duration(2500).delay(d => d._delay).ease(d3.easeCubicInOut)
                    .attr("cx", d => d.dX).attr("cy", d => d.dY).attr("r", 1.1).attr("opacity", 0.45);
            }, 1100);
        }
        else if (stepId === "sponsor-type") {
            stopDrift();
            resetZoom(600);
            uiG.selectAll(".cl").transition("ui").duration(600).attr("opacity",1);
            uiG.select(".color-legend").transition("ui").duration(400).attr("opacity",0);
            mapG.transition("map").duration(800).attr("opacity",0.08);

            const xP = {1:0.2, 2:0.5, 3:0.8};
            circles.transition("dots")
                .duration(1800).delay(d => srand(d.dot_id+60000)*400).ease(d3.easeCubicInOut)
                .attr("cx", d => width*(xP[d.sponsor_cat]||0.5) + (srand(d.dot_id+60000)-0.5)*width*0.14)
                .attr("cy", d => height*0.18 + srand(d.dot_id+70000)*height*0.65)
                .attr("r", 2.2).attr("opacity", 0.7)
                .attr("fill", d => CATC[d.sponsor_cat]||"#888");
        }
    }

    return { init, onStep };
})();
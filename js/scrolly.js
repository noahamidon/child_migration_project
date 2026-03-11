// v2026-03-06 — replace ALL files, hard refresh Cmd+Shift+R
// ════════════════════════════════════════════════════════
//  scrolly.js — IntersectionObserver (no Scrollama dependency)
//  + visible on-screen debug panel
// ════════════════════════════════════════════════════════

const scrolly = {
    init() {
        // Debug panel (top-right corner) — shows which step is active
        const debug = document.createElement("div");
        debug.id = "scroll-debug";
        debug.style.cssText = "display:none" +
            "background:rgba(255,255,255,0.92);color:#943c3c;padding:8px 14px;" +
            "font-family:monospace;font-size:12px;border-radius:6px;" +
            "pointer-events:none;max-width:250px;line-height:1.6;";
        debug.textContent = "scroll debug: waiting…";
        document.body.appendChild(debug);

        const handlers = {
            // Migration map steps
            "ca-wide":        migration.onStep,
            "origin-cluster": migration.onStep,
            "origin-split":   migration.onStep,
            "journey":        migration.onStep,
            "us-landing":     migration.onStep,
            "sponsor-type":   migration.onStep,
            // Timeline steps
            "timeline-density":    timeline.onStep,
            "timeline-all":        timeline.onStep,
            "timeline-2019-surge": timeline.onStep,
            "timeline-covid":      timeline.onStep,
            "timeline-2021-spike": timeline.onStep,
            "timeline-gender":      timeline.onStep,
            "timeline-gender-prop": timeline.onStep,
            // Sponsor steps
            "sponsor-overall":    sponsors.onStep,
            "sponsor-by-country": sponsors.onStep,
            "sponsor-trend":      sponsors.onStep,
            "sponsor-gender":     sponsors.onStep,
        };

        // Observe ALL .step elements
        const steps = document.querySelectorAll(".step");
        console.log("scrolly: found", steps.length, "steps");
        debug.textContent = "steps found: " + steps.length;

        if (steps.length === 0) {
            debug.textContent = "ERROR: no .step elements found!";
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                const el = entry.target;
                const stepId = el.dataset.step;
                if (!stepId) return;

                // Mark active
                steps.forEach(s => s.classList.remove("is-active"));
                el.classList.add("is-active");

                // Update debug panel
                debug.innerHTML = "<b>Active:</b> " + stepId;

                // Dispatch to handler
                const handler = handlers[stepId];
                if (handler) {
                    try {
                        handler(stepId);
                    } catch (err) {
                        debug.innerHTML += "<br><span style='color:red'>ERROR: " + err.message + "</span>";
                        console.error("Step handler error for", stepId, err);
                    }
                } else {
                    debug.innerHTML += "<br><span style='color:orange'>no handler!</span>";
                }
            });
        }, {
            // Trigger when step crosses the middle of the viewport
            rootMargin: "-50% 0px -50% 0px",
            threshold: 0
        });

        steps.forEach(step => observer.observe(step));
        console.log("scrolly: IntersectionObserver active on", steps.length, "steps");
    }
};
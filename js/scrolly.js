// v2026-03-06 — replace ALL files, hard refresh Cmd+Shift+R
// ════════════════════════════════════════════════════════
//  scrolly.js — IntersectionObserver (no Scrollama dependency)
//  + visible on-screen debug panel
// ════════════════════════════════════════════════════════

const scrolly = {
    init() {
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

        if (steps.length === 0) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                const el = entry.target;
                const stepId = el.dataset.step;
                if (!stepId) return;

                // Mark active
                steps.forEach(s => s.classList.remove("is-active"));
                el.classList.add("is-active");

                // Dispatch to handler
                const handler = handlers[stepId];
                if (handler) {
                    try {
                        handler(stepId);
                    } catch (err) {
                        console.error("Step handler error for", stepId, err);
                    }
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
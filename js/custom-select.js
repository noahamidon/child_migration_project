// custom-select.js — fully styled dropdown replacing native <select>
// The native <select> stays hidden in the DOM; all existing .value reads
// and addEventListener("change") calls continue to work unchanged.

function customSelect(selectEl) {
    const wrapper = document.createElement("div");
    wrapper.className = "csel";
    selectEl.parentNode.insertBefore(wrapper, selectEl);
    wrapper.appendChild(selectEl);
    selectEl.style.display = "none";

    const trigger = document.createElement("div");
    trigger.className = "csel-trigger";
    trigger.setAttribute("tabindex", "0");
    trigger.setAttribute("role", "combobox");
    wrapper.appendChild(trigger);

    const list = document.createElement("div");
    list.className = "csel-list";
    list.setAttribute("role", "listbox");
    wrapper.appendChild(list);

    function updateTrigger() {
        const opt = selectEl.options[selectEl.selectedIndex];
        trigger.textContent = opt ? opt.textContent : "";
        trigger.style.color = (opt && opt.style.color) ? opt.style.color : "";
        trigger.style.fontWeight = (opt && opt.style.fontWeight) ? opt.style.fontWeight : "";
    }

    function buildList() {
        list.innerHTML = "";
        Array.from(selectEl.options).forEach((opt, i) => {
            const item = document.createElement("div");
            item.className = "csel-opt" + (i === selectEl.selectedIndex ? " selected" : "");
            item.dataset.value = opt.value;
            item.textContent = opt.textContent;
            item.setAttribute("role", "option");
            if (opt.style.color)      item.style.color      = opt.style.color;
            if (opt.style.fontWeight) item.style.fontWeight = opt.style.fontWeight;
            item.addEventListener("click", () => {
                selectEl.value = opt.value;
                selectEl.dispatchEvent(new Event("change", { bubbles: true }));
                close();
            });
            list.appendChild(item);
        });
    }

    function open() {
        document.querySelectorAll(".csel.open").forEach(el => {
            if (el !== wrapper) el.classList.remove("open");
        });
        wrapper.classList.add("open");
    }

    function close() {
        wrapper.classList.remove("open");
        Array.from(list.children).forEach((item, i) => {
            item.classList.toggle("selected", i === selectEl.selectedIndex);
        });
        updateTrigger();
    }

    trigger.addEventListener("click", () =>
        wrapper.classList.contains("open") ? close() : open()
    );

    trigger.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            wrapper.classList.contains("open") ? close() : open();
        } else if (e.key === "Escape") {
            close();
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            const next = Math.min(selectEl.selectedIndex + 1, selectEl.options.length - 1);
            if (next !== selectEl.selectedIndex) {
                selectEl.selectedIndex = next;
                selectEl.dispatchEvent(new Event("change", { bubbles: true }));
                buildList();
                updateTrigger();
            }
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            const prev = Math.max(selectEl.selectedIndex - 1, 0);
            if (prev !== selectEl.selectedIndex) {
                selectEl.selectedIndex = prev;
                selectEl.dispatchEvent(new Event("change", { bubbles: true }));
                buildList();
                updateTrigger();
            }
        }
    });

    document.addEventListener("click", e => {
        if (!wrapper.contains(e.target)) close();
    });

    buildList();
    updateTrigger();
}

function initCustomSelects() {
    ["filter-country", "filter-year", "filter-sponsor", "filter-gender"].forEach(id => {
        const el = document.getElementById(id);
        if (el) customSelect(el);
    });
}

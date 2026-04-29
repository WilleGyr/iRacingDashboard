// =============================================================
// Main app: rendering, event wiring, time ticking.
// Vanilla JS, no framework. Re-renders the whole dynamic regions
// on state change. Granular updates only for the per-second timer.
// =============================================================

// ---------------- utilities ----------------
function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const k in attrs) {
        if (k === "class") e.className = attrs[k];
        else if (k === "style") {
            // CSS custom properties (--foo) can't be set via style[key] — must use setProperty.
            for (const sk in attrs[k]) {
                if (sk.startsWith("--")) e.style.setProperty(sk, attrs[k][sk]);
                else e.style[sk] = attrs[k][sk];
            }
        }
        else if (k === "dataset") Object.assign(e.dataset, attrs[k]);
        else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else if (k === "html") e.innerHTML = attrs[k];
        else e.setAttribute(k, attrs[k]);
    }
    for (const c of [].concat(children)) {
        if (c == null || c === false) continue;
        e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return e;
}

function formatMs(ms) {
    if (ms == null || isNaN(ms)) return "—";
    const sign = ms < 0 ? "-" : "";
    ms = Math.abs(ms);
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const t = Math.floor(ms % 1000);
    return `${sign}${m}:${String(s).padStart(2, "0")}.${String(t).padStart(3, "0")}`;
}

function formatHms(ms) {
    if (ms == null || isNaN(ms)) return "--:--:--";
    const sign = ms < 0 ? "-" : "";
    ms = Math.abs(ms);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Parse "M:SS.mmm" or "MM:SS.mmm" or "SS.mmm" or pure digits into ms.
// Pure-digit fallback: right-aligned — last 3 digits = ms, prev 2 = sec, rest = min.
function parseLapTime(str) {
    if (!str) return null;
    str = str.trim();

    if (/^\d+$/.test(str) && str.length >= 3) {
        const ms  = parseInt(str.slice(-3), 10);
        const rest = str.slice(0, -3);
        const sec = parseInt(rest.slice(-2) || "0", 10);
        const min = parseInt(rest.slice(0, -2) || "0", 10);
        if (sec > 59) return null;
        const total = min * 60000 + sec * 1000 + ms;
        return total > 0 ? total : null;
    }

    const m = str.match(/^(?:(\d{1,2}):)?(\d{1,2})(?:\.(\d{1,3}))?$/);
    if (!m) return null;
    const minutes = m[1] ? parseInt(m[1], 10) : 0;
    const seconds = parseInt(m[2], 10);
    if (seconds > 59) return null;
    let millis = 0;
    if (m[3]) millis = parseInt(m[3].padEnd(3, "0"), 10);
    const total = minutes * 60000 + seconds * 1000 + millis;
    if (total <= 0) return null;
    return total;
}

// Pure-digit input → "M:SS.mmm" string. Other input is left untouched.
function autoFormatLapTime(raw) {
    if (!raw) return raw;
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) return raw;
    if (trimmed.length < 3) return raw;
    const ms  = trimmed.slice(-3);
    const rest = trimmed.slice(0, -3);
    const sec = (rest.slice(-2) || "0").padStart(2, "0");
    const min = rest.slice(0, -2) || "0";
    return `${parseInt(min, 10)}:${sec}.${ms}`;
}

// Parse "h:mm" or "hh:mm" or just minutes into ms
function parseDuration(str) {
    if (!str) return null;
    str = str.trim();
    const m = str.match(/^(\d{1,3}):(\d{1,2})$/);
    if (m) {
        const h = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        if (mm > 59) return null;
        return (h * 60 + mm) * 60 * 1000;
    }
    const justMin = str.match(/^(\d{1,4})$/);
    if (justMin) return parseInt(justMin[1], 10) * 60 * 1000;
    return null;
}

function colorFor(driver) {
    return DRIVER_COLORS.find(c => c.id === driver.color)?.hex || "#888";
}

// Helper: build a driver-name span colored by the driver's chosen color.
function driverNameEl(driver, fallbackIndex, extraClass = "") {
    const c = driver ? colorFor(driver) : "#888";
    const name = driver?.name || `Driver ${fallbackIndex + 1}`;
    return el("span", {
        class: "driver-name" + (extraClass ? " " + extraClass : ""),
        style: { "--c": c }
    }, name);
}

// ---------------- toast ----------------
function toast(msg, kind = "") {
    const host = $("#toast-host");
    const t = el("div", { class: `toast ${kind}` }, msg);
    host.appendChild(t);
    setTimeout(() => {
        t.style.animation = "toastOut 220ms ease forwards";
        setTimeout(() => t.remove(), 240);
    }, 2400);
}

// ---------------- root render ----------------
function render() {
    const s = getState();
    if (s.race.started) {
        $("#setup-panel").style.display = "none";
        $("#race-panel").style.display = "block";
        renderRaceHeader();
        renderDriverPills();
        renderLapList();
        renderStatsTable();
        renderStintsList();
        renderCharts();
        updateOutlapBanner();
        updateRaceStatusPill();
    } else {
        $("#setup-panel").style.display = "block";
        $("#race-panel").style.display = "none";
        renderSetup();
        updateRaceStatusPill();
    }
}

// ============================================================
// SETUP PANEL
// ============================================================
function renderSetup() {
    const s = getState();

    // car category
    const catSel = $("#car-category");
    catSel.innerHTML = "";
    const categories = Object.keys(CARS);
    if (!categories.includes(s.setup.carCategory)) {
        s.setup.carCategory = categories[0];
    }
    for (const cat of categories) {
        catSel.appendChild(el("option", { value: cat }, cat));
    }
    catSel.value = s.setup.carCategory;

    // car model
    const carSel = $("#car-model");
    carSel.innerHTML = "";
    const models = CARS[s.setup.carCategory] || [];
    carSel.appendChild(el("option", { value: "" }, "Select a car…"));
    for (const m of models) carSel.appendChild(el("option", { value: m }, m));
    if (models.includes(s.setup.car)) carSel.value = s.setup.car;
    else carSel.value = "";

    // track
    const trackSel = $("#track");
    trackSel.innerHTML = "";
    trackSel.appendChild(el("option", { value: "" }, "Select a track…"));
    for (const t of TRACKS) trackSel.appendChild(el("option", { value: t }, t));
    if (TRACKS.includes(s.setup.track)) trackSel.value = s.setup.track;
    else trackSel.value = "";

    // race format
    $$("#race-format button").forEach(b => {
        b.classList.toggle("active", b.dataset.value === s.setup.raceFormat);
    });
    $("#duration-field").style.display = s.setup.raceFormat === "duration" ? "" : "none";
    $("#laps-field").style.display = s.setup.raceFormat === "laps" ? "" : "none";

    if (s.setup.raceDurationMs) {
        const totalMin = Math.round(s.setup.raceDurationMs / 60000);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        $("#race-duration").value = `${h}:${String(m).padStart(2, "0")}`;
    }
    $("#race-laps").value = s.setup.raceLaps;

    renderDriversList();
    updateStartBtn();
}

function renderDriversList() {
    const s = getState();
    const list = $("#drivers-list");
    list.innerHTML = "";

    s.setup.drivers.forEach((driver, idx) => {
        const colorPicker = el("div", { class: "color-picker" },
            DRIVER_COLORS.map(c => {
                const taken = s.setup.drivers.some((d, i) => i !== idx && d.color === c.id);
                const sw = el("button", {
                    type: "button",
                    class: "color-swatch" + (driver.color === c.id ? " selected" : "") + (taken ? " taken" : ""),
                    style: { background: c.hex },
                    title: c.label,
                    onClick: () => {
                        if (taken) return;
                        const drivers = [...s.setup.drivers];
                        drivers[idx] = { ...drivers[idx], color: c.id };
                        setDrivers(drivers);
                        renderDriversList();
                        updateStartBtn();
                    }
                });
                return sw;
            })
        );

        const nameInput = el("input", {
            type: "text",
            placeholder: `Driver ${idx + 1} name`,
            value: driver.name || "",
            onInput: (e) => {
                const drivers = [...s.setup.drivers];
                drivers[idx] = { ...drivers[idx], name: e.target.value };
                setDrivers(drivers);
                updateStartBtn();
            }
        });

        const removeBtn = el("button", {
            type: "button",
            class: "driver-remove",
            title: "Remove driver",
            onClick: () => {
                if (s.setup.drivers.length <= 1) {
                    toast("At least one driver is required.", "error");
                    return;
                }
                const drivers = s.setup.drivers.filter((_, i) => i !== idx);
                setDrivers(drivers);
                renderDriversList();
                updateStartBtn();
            }
        }, "✕");

        const row = el("div", { class: "driver-row" }, [nameInput, colorPicker, removeBtn]);
        list.appendChild(row);
    });

    $("#add-driver-btn").style.display = s.setup.drivers.length >= 4 ? "none" : "";
}

function updateStartBtn() {
    const s = getState();
    const btn = $("#start-race-btn");
    const reasons = [];
    if (!s.setup.car) reasons.push("car");
    if (!s.setup.track) reasons.push("track");
    if (s.setup.drivers.length === 0) reasons.push("at least one driver");
    if (s.setup.drivers.some(d => !d.name?.trim())) reasons.push("driver names");
    if (s.setup.raceFormat === "duration" && !s.setup.raceDurationMs) reasons.push("duration");
    if (s.setup.raceFormat === "laps" && !s.setup.raceLaps) reasons.push("lap count");

    btn.disabled = reasons.length > 0;
    btn.title = reasons.length ? `Fill in: ${reasons.join(", ")}` : "Start the race";
}

function wireSetupHandlers() {
    $("#car-category").addEventListener("change", (e) => {
        updateSetup({ carCategory: e.target.value, car: "" });
        renderSetup();
    });
    $("#car-model").addEventListener("change", (e) => {
        updateSetup({ car: e.target.value });
        updateStartBtn();
    });
    $("#track").addEventListener("change", (e) => {
        updateSetup({ track: e.target.value });
        updateStartBtn();
    });
    $$("#race-format button").forEach(b => {
        b.addEventListener("click", () => {
            updateSetup({ raceFormat: b.dataset.value });
            renderSetup();
        });
    });
    $("#race-duration").addEventListener("input", (e) => {
        const ms = parseDuration(e.target.value);
        updateSetup({ raceDurationMs: ms });
        updateStartBtn();
    });
    $("#race-laps").addEventListener("input", (e) => {
        const n = parseInt(e.target.value, 10);
        updateSetup({ raceLaps: isNaN(n) || n < 1 ? null : n });
        updateStartBtn();
    });
    $("#add-driver-btn").addEventListener("click", () => {
        const s = getState();
        if (s.setup.drivers.length >= 4) return;
        const taken = new Set(s.setup.drivers.map(d => d.color));
        const nextColor = DRIVER_COLORS.find(c => !taken.has(c.id))?.id || "red";
        setDrivers([...s.setup.drivers, { name: "", color: nextColor }]);
        renderDriversList();
        updateStartBtn();
    });
    $("#start-race-btn").addEventListener("click", () => {
        const s = getState();
        if ($("#start-race-btn").disabled) return;
        // sanity: no duplicate colors
        const colors = s.setup.drivers.map(d => d.color);
        if (new Set(colors).size !== colors.length) {
            toast("Each driver needs a unique color.", "error");
            return;
        }
        startRace();
        render();
        toast("Race started — good luck!", "success");
    });
}

// ============================================================
// RACE PANEL
// ============================================================
function renderRaceHeader() {
    const s = getState();
    $("#race-car").textContent = s.setup.car;
    $("#race-track").textContent = s.setup.track;
    updateTimers();
    $("#total-laps").textContent = s.laps.length;

    if (s.setup.raceFormat === "laps") {
        $("#laps-counter-label").textContent = "Laps left";
        const left = Math.max(0, s.setup.raceLaps - s.laps.length);
        $("#laps-counter").textContent = left;
    } else {
        $("#laps-counter-label").textContent = "Format";
        $("#laps-counter").textContent = "Time";
    }

    // Current-driver badge: latest lap's driver, with their color.
    const slot = $("#current-driver-slot");
    slot.innerHTML = "";
    if (s.laps.length > 0) {
        const latest = s.laps[s.laps.length - 1];
        const driver = s.setup.drivers[latest.driverIndex];
        if (driver) {
            const c = colorFor(driver);
            const labelText = s.race.ended ? "Last driver" : "Currently driving";
            slot.appendChild(el("span", {
                class: "current-driver-badge",
                style: { "--c": c }
            }, [
                el("span", { class: "label" }, labelText),
                driver.name || `Driver ${latest.driverIndex + 1}`
            ]));
        }
    }
}

function updateTimers() {
    const s = getState();
    if (!s.race.startedAt) return;
    const now = s.race.ended ? s.race.endedAt : Date.now();
    const elapsed = now - s.race.startedAt;
    $("#time-elapsed").textContent = formatHms(elapsed);

    if (s.setup.raceFormat === "duration") {
        const left = s.setup.raceDurationMs - elapsed;
        const elTimeLeft = $("#time-left");
        elTimeLeft.textContent = formatHms(Math.max(0, left));
        elTimeLeft.classList.toggle("warn", left > 0 && left < 5 * 60 * 1000);
        elTimeLeft.classList.toggle("danger", left <= 0);
    } else {
        // laps mode
        $("#time-left").textContent = "—";
    }
    if (s.setup.raceFormat === "laps") {
        $("#laps-counter").textContent = Math.max(0, s.setup.raceLaps - s.laps.length);
    }
    $("#total-laps").textContent = s.laps.length;
}

function updateRaceStatusPill() {
    const s = getState();
    const pill = $("#race-status");
    pill.classList.remove("live");
    if (s.race.started && !s.race.ended) {
        pill.classList.add("live");
        pill.innerHTML = `<span class="status-dot"></span><span class="status-label">Live</span>`;
    } else if (s.race.ended) {
        pill.innerHTML = `<span class="status-label">Finished</span>`;
    } else {
        pill.innerHTML = `<span class="status-label">Not started</span>`;
    }
}

// ---- driver pills (lap input) ----
let selectedDriverIndex = 0;
function renderDriverPills() {
    const s = getState();
    if (selectedDriverIndex >= s.setup.drivers.length) selectedDriverIndex = 0;
    const host = $("#driver-pills");
    host.innerHTML = "";
    s.setup.drivers.forEach((driver, idx) => {
        const c = colorFor(driver);
        const pill = el("button", {
            type: "button",
            class: "driver-pill" + (idx === selectedDriverIndex ? " selected" : ""),
            style: { "--c": c },
            onClick: () => {
                selectedDriverIndex = idx;
                renderDriverPills();
                updateOutlapBanner();
            }
        }, [
            el("span", { class: "swatch", style: { "--c": c } }),
            driver.name || `Driver ${idx + 1}`
        ]);
        host.appendChild(pill);
    });
}

function updateOutlapBanner() {
    const s = getState();
    if (!s.race.started) return;
    $("#next-outlap-banner").style.display = isNextLapOutlap() ? "" : "none";
}

// ---- lap list ----
function renderLapList() {
    const s = getState();
    const list = $("#lap-list");
    list.innerHTML = "";

    $("#lap-count-meta").textContent = s.laps.length ? `(${s.laps.length})` : "";

    if (s.laps.length === 0) {
        list.appendChild(el("div", { class: "lap-empty" }, "No laps yet. Add the first one above."));
        return;
    }

    const fastestOverall = getFastestOverall();
    const fastestPerDriver = getFastestPerDriver();

    // Newest first
    const lapsRev = [...s.laps].reverse();
    for (const lap of lapsRev) {
        const driver = s.setup.drivers[lap.driverIndex];
        const c = driver ? colorFor(driver) : "#888";
        const lapNumber = s.laps.indexOf(lap) + 1; // 1-based global index

        const tags = [];
        if (lap.isOutlap)        tags.push(el("span", { class: "lap-tag out" }, "OUT"));
        if (lap.isPit)           tags.push(el("span", { class: "lap-tag pit" }, "PIT"));
        if (lap.isDriveThrough)  tags.push(el("span", { class: "lap-tag dt" },  "DT"));
        if (lap.position != null) tags.push(el("span", { class: "lap-tag pos" }, `P${lap.position}`));

        const isOverallFastest = fastestOverall && fastestOverall.id === lap.id;
        const isDriverFastest  = !isOverallFastest
            && fastestPerDriver.get(lap.driverIndex)?.id === lap.id;

        const timeClass = "lap-time" +
            (isOverallFastest ? " fastest-overall" : "") +
            (isDriverFastest ? " fastest-driver" : "");

        const item = el("div", { class: "lap-item" }, [
            el("div", { class: "lap-num" }, `#${lapNumber}`),
            el("div", { class: "lap-stripe", style: { "--c": c } }),
            el("div", {}, [
                el("div", { class: "lap-driver", style: { "--c": c } },
                    driver?.name || `Driver ${lap.driverIndex + 1}`),
                tags.length > 0 ? el("div", { class: "lap-tags" }, tags) : null,
                lap.notes ? el("div", { class: "lap-notes" }, `“${lap.notes}”`) : null
            ]),
            el("div", { class: timeClass }, formatMs(lap.timeMs)),
            el("button", {
                class: "lap-delete",
                title: "Delete lap",
                onClick: () => {
                    if (confirm("Delete this lap?")) {
                        deleteLap(lap.id);
                        render();
                    }
                }
            }, "✕")
        ]);
        list.appendChild(item);
    }
}

// ---- stints list ----
function renderStintsList() {
    const s = getState();
    const host = $("#stints-list");
    host.innerHTML = "";

    const stints = getStints();
    $("#stints-count-meta").textContent = stints.length ? `(${stints.length})` : "";

    if (stints.length === 0) {
        host.appendChild(el("div", { class: "stint-empty" }, "Stints appear here once laps are added."));
        return;
    }

    for (const stint of stints) {
        const driver = s.setup.drivers[stint.driverIndex];
        const c = driver ? colorFor(driver) : "#888";
        const stats = getStintStats(stint);

        const meta = [];
        meta.push(el("span", {}, [
            "Laps ",
            el("strong", {}, `${stint.firstLapNumber}–${stint.lastLapNumber}`),
            ` (${stats.lapCount})`
        ]));
        meta.push(el("span", {}, [
            "Avg ",
            el("strong", {}, stats.avgMs == null ? "—" : formatMs(stats.avgMs))
        ]));
        meta.push(el("span", {}, [
            "Time ",
            el("strong", {}, formatHms(stats.totalMs))
        ]));
        if (stats.startPos != null && stats.endPos != null) {
            const display = -(stats.endPos - stats.startPos);
            const cls = display === 0 ? "" : (display > 0 ? "delta-pos" : "delta-neg");
            const txt = display === 0 ? "±0" : (display > 0 ? `+${display}` : `${display}`);
            meta.push(el("span", { class: cls }, [
                "Pos ",
                el("strong", {}, `P${stats.startPos} → P${stats.endPos}`),
                ` (${txt})`
            ]));
        }

        const row = el("div", { class: "stint-row" }, [
            el("div", { class: "stint-stripe", style: { "--c": c } }),
            el("div", { class: "stint-info" }, [
                el("div", { class: "stint-title" }, [
                    el("span", { class: "stint-num" }, `#${stint.stintNumber}`),
                    driverNameEl(driver, stint.driverIndex)
                ]),
                el("div", { class: "stint-meta" }, meta)
            ])
        ]);
        host.appendChild(row);
    }
}

// ---- stats table ----
function renderStatsTable() {
    const s = getState();
    const host = $("#stats-table");
    host.innerHTML = "";

    host.appendChild(el("div", { class: "stats-row head" }, [
        el("div", { class: "stripe" }),
        el("div", {}, "Driver"),
        el("div", {}, "Avg lap"),
        el("div", { class: "col-laps" }, "Laps"),
        el("div", {}, "Pace laps"),
        el("div", { class: "col-delta" }, "Pos Δ")
    ]));

    s.setup.drivers.forEach((driver, idx) => {
        const stats = getDriverStats(idx);
        const c = colorFor(driver);

        let deltaText = "—";
        let deltaClass = "num";
        if (stats.positionDelta === 0) {
            deltaText = "±0";
        } else if (stats.positionDelta != null) {
            // positionDelta > 0 means position number got bigger = lost positions.
            // In racing convention "+" means moved up the order, so flip the sign for display.
            const display = -stats.positionDelta;
            deltaText = (display > 0 ? "+" : "") + display;
            deltaClass = "num " + (display > 0 ? "delta-pos" : "delta-neg");
        }

        host.appendChild(el("div", { class: "stats-row" }, [
            el("div", { class: "stripe", style: { "--c": c } }),
            el("div", {}, driverNameEl(driver, idx)),
            el("div", { class: "num" }, stats.avgMs == null ? "—" : formatMs(stats.avgMs)),
            el("div", { class: "num col-laps" }, String(stats.lapCount)),
            el("div", { class: "num" }, String(stats.racePaceLapCount)),
            el("div", { class: deltaClass + " col-delta" }, deltaText)
        ]));
    });
}

// ---- lap form ----
function wireRaceHandlers() {
    const form = $("#lap-form");
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const s = getState();

        const timeStr = $("#lap-time").value;
        const ms = parseLapTime(timeStr);
        if (ms == null) {
            toast("Lap time must be M:SS.000 (e.g. 1:42.318).", "error");
            $("#lap-time").focus();
            return;
        }

        const isPit = $("#lap-pit").checked;
        const isDt  = $("#lap-dt").checked;
        const posStr = $("#lap-position").value;
        const position = posStr === "" ? null : parseInt(posStr, 10);
        const notes = $("#lap-notes").value;

        if (isPit && (position == null || isNaN(position) || position < 1)) {
            toast("Pit laps require a position.", "error");
            $("#pit-position-banner").style.display = "";
            $("#lap-position").focus();
            return;
        }
        $("#pit-position-banner").style.display = "none";

        addLap({
            driverIndex: selectedDriverIndex,
            timeMs: ms,
            isPit,
            isDriveThrough: isDt,
            position,
            notes
        });

        // reset form
        $("#lap-time").value = "";
        $("#lap-position").value = "";
        $("#lap-notes").value = "";
        $("#lap-pit").checked = false;
        $("#lap-dt").checked = false;

        render();
        $("#lap-time").focus();
    });

    // Auto-format pure-digit input on blur, e.g. 142318 → 1:42.318.
    $("#lap-time").addEventListener("blur", () => {
        const v = $("#lap-time").value;
        const formatted = autoFormatLapTime(v);
        if (formatted !== v) $("#lap-time").value = formatted;
    });

    $("#lap-pit").addEventListener("change", () => {
        // when pit is checked, position becomes mandatory — surface the hint preemptively
        const isPit = $("#lap-pit").checked;
        if (isPit) {
            $("#lap-position").focus();
        }
    });

    $("#end-race-btn").addEventListener("click", () => {
        if (!confirm("End the race? Stats and laps will be kept.")) return;
        endRace();
        render();
    });

    $("#reset-btn").addEventListener("click", () => {
        const msg = "Reset everything? All laps, drivers, and race state will be deleted.";
        if (!confirm(msg)) return;
        resetState();
        selectedDriverIndex = 0;
        render();
        toast("Reset.", "success");
    });
}

// ---------------- timer tick ----------------
function tick() {
    const s = getState();
    if (s.race.started && !s.race.ended) {
        updateTimers();
    }
}

// ---------------- boot ----------------
function boot() {
    wireSetupHandlers();
    wireRaceHandlers();
    render();
    setInterval(tick, 1000);
}

document.addEventListener("DOMContentLoaded", boot);

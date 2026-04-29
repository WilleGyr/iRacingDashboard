// State management + localStorage persistence
// Keeps a single state object; saves on every mutation. Reload-safe.

const STORAGE_KEY = "iracing-dashboard-v1";

const DEFAULT_STATE = {
    setup: {
        drivers: [
            { name: "", color: "red" },
            { name: "", color: "blue" }
        ],
        carCategory: "GT3",
        car: "",
        track: "",
        raceFormat: "duration",       // "duration" | "laps"
        raceDurationMs: 2 * 60 * 60 * 1000, // 2 hours
        raceLaps: 60
    },
    race: {
        started: false,
        ended: false,
        startedAt: null,              // epoch ms
        endedAt: null
    },
    laps: []                          // see addLap()
};

let state = loadState();

// ---------------- persistence ----------------
function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return structuredClone(DEFAULT_STATE);
        const parsed = JSON.parse(raw);
        // shallow merge defaults so new fields don't break old saves
        return {
            setup: { ...DEFAULT_STATE.setup, ...(parsed.setup || {}) },
            race:  { ...DEFAULT_STATE.race,  ...(parsed.race  || {}) },
            laps:  Array.isArray(parsed.laps) ? parsed.laps : []
        };
    } catch (e) {
        console.warn("Failed to load state, resetting:", e);
        return structuredClone(DEFAULT_STATE);
    }
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn("Failed to save state:", e);
    }
}

function resetState() {
    state = structuredClone(DEFAULT_STATE);
    saveState();
}

// ---------------- helpers ----------------
function getState() { return state; }

function updateSetup(patch) {
    state.setup = { ...state.setup, ...patch };
    saveState();
}

function setDrivers(drivers) {
    state.setup.drivers = drivers;
    saveState();
}

function startRace() {
    state.race.started = true;
    state.race.ended = false;
    state.race.startedAt = Date.now();
    state.race.endedAt = null;
    saveState();
}

function endRace() {
    state.race.ended = true;
    state.race.endedAt = Date.now();
    saveState();
}

// ---------------- laps ----------------
/*
  lap = {
    id: number,
    driverIndex: number,
    timeMs: number,            // milliseconds (e.g. 1:45.432 -> 105432)
    isPit: boolean,
    isDriveThrough: boolean,
    isOutlap: boolean,         // auto-set from previous lap
    position: number | null    // optional except required when isPit
  }
*/

function nextLapId() {
    return state.laps.length === 0 ? 1 : Math.max(...state.laps.map(l => l.id)) + 1;
}

// In team racing the outlap is the lap right after a pit / drive-through,
// even if a driver swap happens — so look at the immediately previous lap, period.
function isNextLapOutlap() {
    if (state.laps.length === 0) return false;
    const prev = state.laps[state.laps.length - 1];
    return prev.isPit || prev.isDriveThrough;
}

function addLap(lapInput) {
    const lap = {
        id: nextLapId(),
        driverIndex: lapInput.driverIndex,
        timeMs: lapInput.timeMs,
        isPit: !!lapInput.isPit,
        isDriveThrough: !!lapInput.isDriveThrough,
        isOutlap: isNextLapOutlap(),
        position: (lapInput.position == null || lapInput.position === "") ? null : Number(lapInput.position),
        notes: (lapInput.notes || "").trim()
    };
    state.laps.push(lap);
    saveState();
    return lap;
}

function deleteLap(id) {
    state.laps = state.laps.filter(l => l.id !== id);
    // Recompute isOutlap for all laps since deletion can shift the flag.
    state.laps.forEach((lap, i) => {
        if (i === 0) {
            lap.isOutlap = false;
        } else {
            const prev = state.laps[i - 1];
            lap.isOutlap = prev.isPit || prev.isDriveThrough;
        }
    });
    saveState();
}

// ---------------- derived ----------------

function getRacePaceLaps() {
    return state.laps.filter(l => !l.isPit && !l.isOutlap && !l.isDriveThrough);
}

function getFastestOverall() {
    const racePace = getRacePaceLaps();
    if (racePace.length === 0) return null;
    return racePace.reduce((best, l) => (l.timeMs < best.timeMs ? l : best), racePace[0]);
}

function getFastestPerDriver() {
    const map = new Map();
    for (const l of getRacePaceLaps()) {
        const cur = map.get(l.driverIndex);
        if (!cur || l.timeMs < cur.timeMs) map.set(l.driverIndex, l);
    }
    return map;
}

function getDriverStats(driverIndex) {
    const driverLaps = state.laps.filter(l => l.driverIndex === driverIndex);
    const racePaceLaps = driverLaps.filter(l => !l.isPit && !l.isOutlap && !l.isDriveThrough);
    const avg = racePaceLaps.length === 0
        ? null
        : racePaceLaps.reduce((s, l) => s + l.timeMs, 0) / racePaceLaps.length;

    // Position delta over this driver's stints.
    // A "stint" begins when the driver takes over (first lap, or first lap after another driver)
    // and ends when they hand over (last lap, or last lap before another driver).
    // We sum (positionAtEnd - positionAtStart) across stints, using only laps with known positions.
    // Negative = positions gained, positive = positions lost. We invert when displaying.
    let netDelta = 0;
    let havePos = false;

    let stintStartPos = null;
    let stintEndPos = null;
    let prevDriver = null;
    for (const lap of state.laps) {
        if (lap.driverIndex === driverIndex) {
            if (prevDriver !== driverIndex) {
                // new stint
                if (stintStartPos != null && stintEndPos != null) {
                    netDelta += (stintEndPos - stintStartPos);
                    havePos = true;
                }
                stintStartPos = lap.position;
                stintEndPos = lap.position;
            } else {
                if (stintStartPos == null && lap.position != null) stintStartPos = lap.position;
                if (lap.position != null) stintEndPos = lap.position;
            }
        }
        prevDriver = lap.driverIndex;
    }
    // close trailing stint
    if (stintStartPos != null && stintEndPos != null) {
        netDelta += (stintEndPos - stintStartPos);
        havePos = true;
    }

    return {
        lapCount: driverLaps.length,
        racePaceLapCount: racePaceLaps.length,
        avgMs: avg,
        positionDelta: havePos ? netDelta : null   // negative = gained, positive = lost
    };
}

function getTotalLapTimeMs() {
    return state.laps.reduce((s, l) => s + l.timeMs, 0);
}

// Group consecutive laps by the same driver into stints.
// Returns array of: { driverIndex, stintNumber, laps: [Lap], firstLapNumber, lastLapNumber }
function getStints() {
    if (state.laps.length === 0) return [];
    const stints = [];
    let cur = null;
    state.laps.forEach((lap, i) => {
        const lapNumber = i + 1;
        if (!cur || cur.driverIndex !== lap.driverIndex) {
            cur = {
                driverIndex: lap.driverIndex,
                stintNumber: stints.length + 1,
                laps: [],
                firstLapNumber: lapNumber,
                lastLapNumber: lapNumber
            };
            stints.push(cur);
        }
        cur.laps.push(lap);
        cur.lastLapNumber = lapNumber;
    });
    return stints;
}

function getStintStats(stint) {
    const racePaceLaps = stint.laps.filter(l => !l.isPit && !l.isOutlap && !l.isDriveThrough);
    const avgMs = racePaceLaps.length === 0
        ? null
        : racePaceLaps.reduce((s, l) => s + l.timeMs, 0) / racePaceLaps.length;
    const totalMs = stint.laps.reduce((s, l) => s + l.timeMs, 0);
    const positions = stint.laps.filter(l => l.position != null).map(l => l.position);
    const startPos = positions.length ? positions[0] : null;
    const endPos   = positions.length ? positions[positions.length - 1] : null;
    return {
        lapCount: stint.laps.length,
        racePaceLapCount: racePaceLaps.length,
        avgMs,
        totalMs,
        startPos,
        endPos,
        positionDelta: (startPos != null && endPos != null) ? (endPos - startPos) : null
    };
}

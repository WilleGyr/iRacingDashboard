// Chart.js wrapper for the Race Overview chart.
// X = lap number, Y = position (P1 on top).
// One dataset per (driver, stint) so the line is split at driver swaps.
// Pit, drive-through, and the overall fastest lap are vertical annotations.

let overviewChart = null;

const CHART_COLORS = {
    grid: "rgba(255,255,255,0.05)",
    gridStrong: "rgba(255,255,255,0.1)",
    text: "#8b92a3",
    textBright: "#e8eaef"
};

function commonChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350, easing: "easeOutCubic" },
        // Hover snaps to the nearest point on the x-axis even if the cursor isn't directly over it.
        interaction: {
            mode: "nearest",
            axis: "x",
            intersect: false
        },
        plugins: {
            legend: {
                labels: {
                    color: CHART_COLORS.textBright,
                    font: { family: "Inter", size: 13, weight: "500" },
                    boxWidth: 12,
                    boxHeight: 12,
                    usePointStyle: true,
                    padding: 16
                }
            },
            tooltip: {
                backgroundColor: "#14171f",
                borderColor: "#3a4150",
                borderWidth: 1,
                titleColor: "#e8eaef",
                bodyColor: "#e8eaef",
                titleFont: { family: "Inter", size: 13, weight: "600" },
                bodyFont: { family: "JetBrains Mono", size: 12.5 },
                padding: 12,
                boxPadding: 6,
                cornerRadius: 8,
                caretPadding: 8
            }
        },
        scales: {
            x: {
                type: "linear",
                grid: { color: CHART_COLORS.grid, drawBorder: false },
                ticks: {
                    color: CHART_COLORS.text,
                    font: { family: "JetBrains Mono", size: 11 },
                    precision: 0
                }
            },
            y: {
                grid: { color: CHART_COLORS.grid, drawBorder: false },
                ticks: {
                    color: CHART_COLORS.text,
                    font: { family: "JetBrains Mono", size: 11 }
                }
            }
        }
    };
}

function colorFor(driver) {
    return DRIVER_COLORS.find(c => c.id === driver.color)?.hex || "#888";
}

function renderOverviewChart() {
    const ctx = document.getElementById("overview-chart");
    if (!ctx) return;

    const s = getState();
    const drivers = s.setup.drivers;
    const stints = getStints();
    const fastestOverall = getFastestOverall();
    const fastestPerDriver = getFastestPerDriver();

    const datasets = [];
    const seenLabels = new Set();
    const allPositions = [];

    for (const stint of stints) {
        const driver = drivers[stint.driverIndex];
        if (!driver) continue;
        const c = colorFor(driver);
        const driverName = driver.name || `Driver ${stint.driverIndex + 1}`;

        // Position chart: only include laps with a known position. Skip pit/dt laps
        // from the LINE (their position is captured in the annotation labels) so
        // the line connects driver-position changes within the stint cleanly.
        const pts = [];
        const styles = [], radii = [], hoverRadii = [];
        const bgs = [], borders = [], borderWidths = [];
        const meta = [];

        for (let i = 0; i < stint.laps.length; i++) {
            const lap = stint.laps[i];
            const lapNumber = stint.firstLapNumber + i;
            if (lap.position == null) continue;
            if (lap.isPit || lap.isDriveThrough) continue;

            allPositions.push(lap.position);

            const isOverallFastest = fastestOverall && fastestOverall.id === lap.id;
            const isDriverFastest  = !isOverallFastest
                && fastestPerDriver.get(stint.driverIndex)?.id === lap.id;

            pts.push({ x: lapNumber, y: lap.position });
            meta.push({
                lapId: lap.id,
                isOutlap: lap.isOutlap,
                position: lap.position,
                timeMs: lap.timeMs,
                notes: lap.notes,
                isOverallFastest,
                isDriverFastest
            });

            if (isOverallFastest) {
                styles.push("circle");
                radii.push(10); hoverRadii.push(13);
                bgs.push(c); borders.push("#a855f7"); borderWidths.push(4);
            } else if (isDriverFastest) {
                styles.push("circle");
                radii.push(8); hoverRadii.push(11);
                bgs.push(c); borders.push("#22c55e"); borderWidths.push(3);
            } else if (lap.isOutlap) {
                styles.push("circle");
                radii.push(6); hoverRadii.push(9);
                bgs.push("rgba(0,0,0,0)"); borders.push(c); borderWidths.push(2.5);
            } else {
                styles.push("circle");
                radii.push(7); hoverRadii.push(10);
                bgs.push(c); borders.push("#0d0f14"); borderWidths.push(2);
            }
        }

        if (pts.length === 0) continue;

        const isFirstForDriver = !seenLabels.has(driverName);
        seenLabels.add(driverName);

        datasets.push({
            label: driverName,
            data: pts,
            borderColor: c,
            backgroundColor: c,
            pointStyle: styles,
            pointRadius: radii,
            pointHoverRadius: hoverRadii,
            pointBackgroundColor: bgs,
            pointBorderColor: borders,
            pointBorderWidth: borderWidths,
            borderWidth: 3.5,
            tension: 0,
            stepped: false,
            spanGaps: false,
            __hideFromLegend: !isFirstForDriver,
            __meta: meta
        });
    }

    // Vertical annotations: pit, drive-through, fastest overall.
    const annotations = {};
    s.laps.forEach((lap, i) => {
        const lapNumber = i + 1;
        if (lap.isPit) {
            annotations[`pit_${lap.id}`] = {
                type: "line",
                xMin: lapNumber, xMax: lapNumber,
                borderColor: "rgba(245, 158, 11, 0.6)",
                borderWidth: 2,
                borderDash: [6, 4],
                label: {
                    display: true,
                    content: lap.position != null ? `PIT P${lap.position}` : "PIT",
                    position: "start",
                    backgroundColor: "rgba(245, 158, 11, 0.2)",
                    color: "#f5d089",
                    font: { family: "Inter", size: 10.5, weight: "600" },
                    padding: { top: 3, bottom: 3, left: 7, right: 7 },
                    borderRadius: 4
                }
            };
        } else if (lap.isDriveThrough) {
            annotations[`dt_${lap.id}`] = {
                type: "line",
                xMin: lapNumber, xMax: lapNumber,
                borderColor: "rgba(239, 68, 68, 0.6)",
                borderWidth: 2,
                borderDash: [2, 4],
                label: {
                    display: true,
                    content: "DT",
                    position: "start",
                    backgroundColor: "rgba(239, 68, 68, 0.2)",
                    color: "#f7a3a3",
                    font: { family: "Inter", size: 10.5, weight: "600" },
                    padding: { top: 3, bottom: 3, left: 7, right: 7 },
                    borderRadius: 4
                }
            };
        }
    });
    if (fastestOverall) {
        const fastestLapNumber = s.laps.findIndex(l => l.id === fastestOverall.id) + 1;
        annotations.fastest = {
            type: "line",
            xMin: fastestLapNumber, xMax: fastestLapNumber,
            borderColor: "#a855f7",
            borderWidth: 2,
            label: {
                display: true,
                content: `★ ${formatMs(fastestOverall.timeMs)}`,
                position: "end",
                backgroundColor: "rgba(168, 85, 247, 0.22)",
                color: "#d3b1ff",
                font: { family: "Inter", size: 10.5, weight: "700" },
                padding: { top: 3, bottom: 3, left: 7, right: 7 },
                borderRadius: 4
            }
        };
    }

    // y-axis range: tight around real positions, 1 above and below
    const minY = allPositions.length ? Math.max(1, Math.min(...allPositions) - 1) : 1;
    const maxY = allPositions.length ? Math.max(...allPositions) + 1 : 10;

    const opts = commonChartOptions();
    opts.scales.x.title = { display: true, text: "Lap #", color: CHART_COLORS.text, font: { family: "Inter", size: 11 } };
    opts.scales.y.title = { display: true, text: "Position", color: CHART_COLORS.text, font: { family: "Inter", size: 11 } };
    opts.scales.y.reverse = true;
    opts.scales.y.min = minY;
    opts.scales.y.max = maxY;
    opts.scales.y.ticks.stepSize = 1;
    opts.scales.y.ticks.precision = 0;
    opts.scales.y.ticks.callback = (v) => Number.isInteger(v) ? `P${v}` : "";

    opts.plugins.legend.labels.filter = (item, chartData) => {
        const ds = chartData.datasets[item.datasetIndex];
        return !ds.__hideFromLegend;
    };
    opts.plugins.tooltip.callbacks = {
        title: (ctxs) => `Lap ${ctxs[0].parsed.x}`,
        label: (ctx) => {
            const ds = ctx.dataset;
            const m = ds.__meta?.[ctx.dataIndex];
            const lines = [`${ds.label} — P${ctx.parsed.y}`];
            if (m) {
                lines.push(`Lap time: ${formatMs(m.timeMs)}`);
                if (m.isOverallFastest) lines.push("★ Fastest of the race");
                else if (m.isDriverFastest) lines.push("• Driver's fastest");
                if (m.isOutlap) lines.push("Out lap");
                if (m.notes) lines.push(`📝 ${m.notes}`);
            }
            return lines;
        }
    };
    opts.plugins.annotation = { annotations };

    const data = { datasets };
    if (overviewChart) {
        overviewChart.data = data;
        overviewChart.options = opts;
        overviewChart.update();
    } else {
        overviewChart = new Chart(ctx, { type: "line", data, options: opts });
    }
}

function renderCharts() {
    renderOverviewChart();
}

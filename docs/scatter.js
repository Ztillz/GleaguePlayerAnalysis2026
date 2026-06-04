let datasets = {
    offense: [],
    defense: [],
    transition: []
};

let metricColumns = {
    offense: [],
    defense: [],
    transition: []
};

let mergedPlayers = [];
let plottedPoints = [];

const categories = {
    offense: "Offense",
    defense: "Defense",
    transition: "Transition"
};

const xCategory = document.getElementById("xCategory");
const yCategory = document.getElementById("yCategory");
const xMetric = document.getElementById("xMetric");
const yMetric = document.getElementById("yMetric");
const highlightPlayer = document.getElementById("highlightPlayer");
const canvas = document.getElementById("scatterCanvas");
const ctx = canvas.getContext("2d");

async function loadData() {
    const [offenseRes, defenseRes, transitionRes] = await Promise.all([
        fetch("./data/offense_norm.json"),
        fetch("./data/defense_norm.json"),
        fetch("./data/transition_norm.json")
    ]);

    datasets.offense = await offenseRes.json();
    datasets.defense = await defenseRes.json();
    datasets.transition = await transitionRes.json();

    metricColumns.offense = getMetricColumns(datasets.offense);
    metricColumns.defense = getMetricColumns(datasets.defense);
    metricColumns.transition = getMetricColumns(datasets.transition);

    mergedPlayers = mergePlayers();

    setupDropdowns();
    drawScatter();
}

function getMetricColumns(data) {
    if (!data.length) return [];

    return Object.keys(data[0]).filter(col =>
        ![
            "ssi_player_id",
            "player_name",
            "position",
            "minutes_played"
        ].includes(col)
        && !col.startsWith("_")
    );
}

function mergePlayers() {
    const playerMap = new Map();

    for (const category of Object.keys(datasets)) {
        datasets[category].forEach(row => {
            const id = String(row.ssi_player_id);

            if (!playerMap.has(id)) {
                playerMap.set(id, {
                    ssi_player_id: id,
                    player_name: row.player_name,
                    position: row.position,
                    offense: {},
                    defense: {},
                    transition: {}
                });
            }

            const player = playerMap.get(id);

            if (!player.player_name && row.player_name) {
                player.player_name = row.player_name;
            }

            if (!player.position && row.position) {
                player.position = row.position;
            }

            metricColumns[category].forEach(metric => {
                player[category][metric] = row[metric];
            });
        });
    }

    return Array.from(playerMap.values())
        .sort((a, b) => a.player_name.localeCompare(b.player_name));
}

function setupDropdowns() {
    for (const [key, label] of Object.entries(categories)) {
        xCategory.add(new Option(label, key));
        yCategory.add(new Option(label, key));
    }

    xCategory.value = "offense";
    yCategory.value = "offense";

    populateMetricDropdown(xMetric, "offense");
    populateMetricDropdown(yMetric, "offense");

    xMetric.value = metricColumns.offense.includes("PPG")
        ? "PPG"
        : metricColumns.offense[0];

    yMetric.value = metricColumns.offense.includes("Usage")
        ? "Usage"
        : metricColumns.offense[1];

    highlightPlayer.add(new Option("None", "None"));

    mergedPlayers.forEach(player => {
        highlightPlayer.add(new Option(player.player_name, player.ssi_player_id));
    });
}

function populateMetricDropdown(selectElement, category) {
    selectElement.innerHTML = "";

    metricColumns[category].forEach(metric => {
        selectElement.add(new Option(metric, metric));
    });
}

xCategory.addEventListener("change", () => {
    populateMetricDropdown(xMetric, xCategory.value);
    drawScatter();
});

yCategory.addEventListener("change", () => {
    populateMetricDropdown(yMetric, yCategory.value);
    drawScatter();
});

xMetric.addEventListener("change", drawScatter);
yMetric.addEventListener("change", drawScatter);
highlightPlayer.addEventListener("change", drawScatter);

function drawScatter() {
    const padding = 70;
    const width = canvas.width;
    const height = canvas.height;

    const xCat = xCategory.value;
    const yCat = yCategory.value;
    const xCol = xMetric.value;
    const yCol = yMetric.value;
    const highlightId = highlightPlayer.value;

    plottedPoints = [];

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, width, height);

    drawAxes(padding, width, height, xCol, yCol);

    const usableWidth = width - padding * 2;
    const usableHeight = height - padding * 2;

    mergedPlayers.forEach(player => {
        const xVal = Number(player[xCat][xCol]);
        const yVal = Number(player[yCat][yCol]);

        if (Number.isNaN(xVal) || Number.isNaN(yVal)) return;

        const x = padding + xVal * usableWidth;
        const y = height - padding - yVal * usableHeight;

        const isHighlighted = String(player.ssi_player_id) === String(highlightId);

        plottedPoints.push({
            x,
            y,
            radius: isHighlighted ? 8 : 5,
            player,
            xValue: Math.round(xVal * 100),
            yValue: Math.round(yVal * 100)
        });

        ctx.beginPath();
        ctx.arc(x, y, isHighlighted ? 8 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isHighlighted ? "#ffcc00" : "#4ea1ff";
        ctx.fill();

        if (isHighlighted) {
            ctx.fillStyle = "white";
            ctx.font = "14px Arial";
            ctx.fillText(player.player_name, x + 10, y - 10);
        }
    });
}

function drawAxes(padding, width, height, xLabel, yLabel) {
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    ctx.strokeStyle = "#333";

    for (let i = 0; i <= 100; i += 25) {
        const x = padding + (i / 100) * (width - padding * 2);
        const y = height - padding - (i / 100) * (height - padding * 2);

        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();

        ctx.fillStyle = "#aaa";
        ctx.font = "12px Arial";
        ctx.fillText(`${i}%`, x - 10, height - padding + 22);
        ctx.fillText(`${i}%`, padding - 42, y + 4);
    }

    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText(xLabel, width / 2 - 80, height - 20);

    ctx.save();
    ctx.translate(20, height / 2 + 100);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
}

canvas.addEventListener("mousemove", event => {
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;

    const hoveredPoint = plottedPoints.find(point => {
        const dx = mouseX - point.x;
        const dy = mouseY - point.y;
        return Math.sqrt(dx * dx + dy * dy) <= point.radius + 4;
    });

    drawScatter();

    if (hoveredPoint) {
        canvas.style.cursor = "pointer";
        drawTooltip(mouseX, mouseY, hoveredPoint);
    } else {
        canvas.style.cursor = "default";
    }
});

canvas.addEventListener("mouseleave", () => {
    canvas.style.cursor = "default";
    drawScatter();
});

canvas.addEventListener("click", event => {
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;

    const clickedPoint = plottedPoints.find(point => {
        const dx = mouseX - point.x;
        const dy = mouseY - point.y;
        return Math.sqrt(dx * dx + dy * dy) <= point.radius + 4;
    });

    if (clickedPoint) {
        window.location.href =
            `player.html?id=${encodeURIComponent(clickedPoint.player.ssi_player_id)}`;
    }
});

function drawTooltip(mouseX, mouseY, point) {
    const xCat = xCategory.value;
    const yCat = yCategory.value;
    const xCol = xMetric.value;
    const yCol = yMetric.value;

    const lines = [
        point.player.player_name,
        `${categories[xCat]} ${xCol}: ${point.xValue}%`,
        `${categories[yCat]} ${yCol}: ${point.yValue}%`
    ];

    ctx.font = "13px Arial";

    const tooltipWidth =
        Math.max(...lines.map(line => ctx.measureText(line).width)) + 20;

    const tooltipHeight = lines.length * 20 + 14;

    let tooltipX = mouseX + 14;
    let tooltipY = mouseY - tooltipHeight - 14;

    if (tooltipX + tooltipWidth > canvas.width) {
        tooltipX = mouseX - tooltipWidth - 14;
    }

    if (tooltipY < 0) {
        tooltipY = mouseY + 14;
    }

    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;

    ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
    ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

    lines.forEach((line, index) => {
        ctx.fillStyle = index === 0 ? "#fff" : "#ccc";
        ctx.fillText(line, tooltipX + 10, tooltipY + 22 + index * 20);
    });
}

loadData();
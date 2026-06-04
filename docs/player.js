const params = new URLSearchParams(window.location.search);
const playerId = params.get("id");

const hiddenColumns = [
    "ssi_player_id",
    "player_name",
    "position",
    "minutes_played"
];

const excludedMetrics = [
    "HC PPP",
    "⁠Performane Guarding NBA Call-ups"
];

async function loadPlayerPage() {
    const [
        offenseNormRes,
        offenseCleanRes,
        defenseNormRes,
        defenseCleanRes,
        transitionNormRes,
        transitionCleanRes
    ] = await Promise.all([
        fetch("./data/offense_norm.json"),
        fetch("./data/offense_clean.json"),
        fetch("./data/defense_norm.json"),
        fetch("./data/defense_clean.json"),
        fetch("./data/transition_norm.json"),
        fetch("./data/transition_clean.json")
    ]);

    const offenseNorm = await offenseNormRes.json();
    const offenseClean = await offenseCleanRes.json();

    const defenseNorm = await defenseNormRes.json();
    const defenseClean = await defenseCleanRes.json();

    const transitionNorm = await transitionNormRes.json();
    const transitionClean = await transitionCleanRes.json();

    const offenseNormPlayer = findPlayer(offenseNorm);
    const offenseCleanPlayer = findPlayer(offenseClean);

    const defenseNormPlayer = findPlayer(defenseNorm);
    const defenseCleanPlayer = findPlayer(defenseClean);

    const transitionNormPlayer = findPlayer(transitionNorm);
    const transitionCleanPlayer = findPlayer(transitionClean);

    const mainPlayer =
        offenseNormPlayer ||
        defenseNormPlayer ||
        transitionNormPlayer ||
        offenseCleanPlayer ||
        defenseCleanPlayer ||
        transitionCleanPlayer;

    if (!mainPlayer) {
        document.getElementById("playerName").textContent = "Player not found";
        return;
    }

    document.getElementById("playerName").textContent = mainPlayer.player_name;
    document.getElementById("playerInfo").textContent =
        `${mainPlayer.position || "Unknown position"} | ${Math.round(mainPlayer.minutes_played || 0)} minutes`;

    renderBarChart("offenseChart", offenseNormPlayer, offenseCleanPlayer, "Offense");
    renderBarChart("defenseChart", defenseNormPlayer, defenseCleanPlayer, "Defense");
    renderBarChart("transitionChart", transitionNormPlayer, transitionCleanPlayer, "Transition");
}

function findPlayer(data) {
    return data.find(row => String(row.ssi_player_id) === String(playerId));
}

function getMetricColumns(player) {
    if (!player) return [];

    return Object.keys(player).filter(col =>
        !hiddenColumns.includes(col) &&
        !col.startsWith("_") &&
        !excludedMetrics.includes(col)
    );
}

function formatRawValue(value) {
    const num = Number(value);

    if (value === null || value === undefined || Number.isNaN(num)) {
        return "";
    }

    if (Math.abs(num) >= 100) {
        return num.toFixed(0);
    }

    if (Math.abs(num) >= 10) {
        return num.toFixed(1);
    }

    return num.toFixed(2);
}

function renderBarChart(containerId, normPlayer, cleanPlayer, title) {
    const container = document.getElementById(containerId);

    if (!normPlayer) {
        container.innerHTML = `<p>No ${title.toLowerCase()} data found.</p>`;
        return;
    }

    const metrics = getMetricColumns(normPlayer);

    container.innerHTML = "";

    metrics.forEach(metric => {
        const percentileValue = Number(normPlayer[metric]);
        const rawValue = cleanPlayer ? cleanPlayer[metric] : null;
        const formattedRaw = formatRawValue(rawValue);

        const row = document.createElement("div");
        row.className = "bar-row";

        if (Number.isNaN(percentileValue)) {
            row.innerHTML = `
                <div class="bar-label">${metric}</div>
                <div class="bar-wrap">
                    <div class="bar-empty">low sample</div>
                </div>
                <div class="bar-raw">${formattedRaw}</div>
            `;
        } else {
            const pct = Math.round(percentileValue * 100);

            row.innerHTML = `
                <div class="bar-label">${metric}</div>
                <div class="bar-wrap">
                    <div class="bar-fill" style="width: ${pct}%;">
                        ${pct}%
                    </div>
                </div>
                <div class="bar-raw">${formattedRaw}</div>
            `;
        }

        container.appendChild(row);
    });
}

loadPlayerPage();
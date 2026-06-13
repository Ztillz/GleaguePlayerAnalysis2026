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
    "⁠Performane Guarding NBA Call-ups",
    "⁠⁠Performane Guarding NBA Call-ups",
    "Performane Guarding NBA Call-ups",
];

let allData = {};
let currentPlayers = {};

const percentileViewSelect = document.getElementById("percentileViewSelect");

async function loadPlayerPage() {
    const responses = await Promise.all([
        fetch("./data/offense_norm.json"),
        fetch("./data/defense_norm.json"),
        fetch("./data/transition_norm.json"),

        fetch("./data/guards_offense_norm.json"),
        fetch("./data/guards_defense_norm.json"),
        fetch("./data/guards_transition_norm.json"),

        fetch("./data/non_guards_offense_norm.json"),
        fetch("./data/non_guards_defense_norm.json"),
        fetch("./data/non_guards_transition_norm.json"),

        fetch("./data/offense_clean.json"),
        fetch("./data/defense_clean.json"),
        fetch("./data/transition_clean.json")
    ]);

    const [
        offenseNorm,
        defenseNorm,
        transitionNorm,

        guardsOffenseNorm,
        guardsDefenseNorm,
        guardsTransitionNorm,

        nonGuardsOffenseNorm,
        nonGuardsDefenseNorm,
        nonGuardsTransitionNorm,

        offenseClean,
        defenseClean,
        transitionClean
    ] = await Promise.all(responses.map(res => res.json()));

    allData = {
        positionless: {
            offense: offenseNorm,
            defense: defenseNorm,
            transition: transitionNorm
        },
        guards: {
            offense: guardsOffenseNorm,
            defense: guardsDefenseNorm,
            transition: guardsTransitionNorm
        },
        non_guards: {
            offense: nonGuardsOffenseNorm,
            defense: nonGuardsDefenseNorm,
            transition: nonGuardsTransitionNorm
        },
        clean: {
            offense: offenseClean,
            defense: defenseClean,
            transition: transitionClean
        }
    };

    setupPlayerHeader();
    renderSelectedView();
}

function setupPlayerHeader() {
    const mainPlayer =
        findPlayer(allData.positionless.offense) ||
        findPlayer(allData.positionless.defense) ||
        findPlayer(allData.positionless.transition) ||
        findPlayer(allData.clean.offense) ||
        findPlayer(allData.clean.defense) ||
        findPlayer(allData.clean.transition);

    if (!mainPlayer) {
        document.getElementById("playerName").textContent = "Player not found";
        document.getElementById("playerInfo").textContent = "";
        return;
    }

    document.getElementById("playerName").textContent = mainPlayer.player_name;
    document.getElementById("playerInfo").textContent =
        `${mainPlayer.position || "Unknown position"} | ${Math.round(mainPlayer.minutes_played || 0)} minutes`;

    percentileViewSelect.value = "positionless";
}

function renderSelectedView() {
    let selectedView = percentileViewSelect.value;

    const headerPlayer =
        findPlayer(allData.positionless.offense) ||
        findPlayer(allData.positionless.defense) ||
        findPlayer(allData.positionless.transition) ||
        findPlayer(allData.clean.offense) ||
        findPlayer(allData.clean.defense) ||
        findPlayer(allData.clean.transition);

    if (!headerPlayer) {
        return;
    }

    if (selectedView === "position") {
        selectedView =
            headerPlayer.position === "Guard"
                ? "guards"
                : "non_guards";
    } else {
        selectedView = "positionless";
    }

    currentPlayers = {
        offenseNorm: findPlayer(allData[selectedView].offense),
        defenseNorm: findPlayer(allData[selectedView].defense),
        transitionNorm: findPlayer(allData[selectedView].transition),

        offenseClean: findPlayer(allData.clean.offense),
        defenseClean: findPlayer(allData.clean.defense),
        transitionClean: findPlayer(allData.clean.transition)
    };

    renderBarChart(
        "offenseChart",
        currentPlayers.offenseNorm,
        currentPlayers.offenseClean,
        "Offense"
    );

    renderBarChart(
        "defenseChart",
        currentPlayers.defenseNorm,
        currentPlayers.defenseClean,
        "Defense"
    );

    renderBarChart(
        "transitionChart",
        currentPlayers.transitionNorm,
        currentPlayers.transitionClean,
        "Transition"
    );
}

function findPlayer(data) {
    if (!data) return null;

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
        container.innerHTML =
            `<p>No ${title.toLowerCase()} data found for this percentile view.</p>`;
        return;
    }

    const metrics = getMetricColumns(normPlayer);

    container.innerHTML = "";

    metrics.forEach(metric => {
        const rawPercentile = normPlayer[metric];

        const hasPercentile =
            rawPercentile !== null &&
            rawPercentile !== undefined &&
            rawPercentile !== "" &&
            !Number.isNaN(Number(rawPercentile));

        const percentileValue = hasPercentile ? Number(rawPercentile) : null;

        const rawValue = cleanPlayer ? cleanPlayer[metric] : null;
        const formattedRaw = formatRawValue(rawValue);

        const row = document.createElement("div");
        row.className = "bar-row";

        if (!hasPercentile) {
            row.innerHTML = `
                <div class="bar-label">${metric}</div>
                <div class="bar-wrap">
                    <div class="bar-empty">DNQ</div>
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

percentileViewSelect.addEventListener("change", renderSelectedView);

loadPlayerPage();
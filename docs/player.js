const params = new URLSearchParams(window.location.search);
const playerId = params.get("id");

const hiddenColumns = [
    "ssi_player_id",
    "player_name",
    "position",
    "minutes_played"
];

async function loadPlayerPage() {
    const [offenseRes, defenseRes, transitionRes] = await Promise.all([
        fetch("./data/offense_norm.json"),
        fetch("./data/defense_norm.json"),
        fetch("./data/transition_norm.json")
    ]);

    const offenseData = await offenseRes.json();
    const defenseData = await defenseRes.json();
    const transitionData = await transitionRes.json();

    const offensePlayer = findPlayer(offenseData);
    const defensePlayer = findPlayer(defenseData);
    const transitionPlayer = findPlayer(transitionData);

    const mainPlayer = offensePlayer || defensePlayer || transitionPlayer;

    if (!mainPlayer) {
        document.getElementById("playerName").textContent = "Player not found";
        return;
    }

    document.getElementById("playerName").textContent = mainPlayer.player_name;
    document.getElementById("playerInfo").textContent =
        `${mainPlayer.position || "Unknown position"} | ${Math.round(mainPlayer.minutes_played || 0)} minutes`;

    renderBarChart("offenseChart", offensePlayer, "Offense");
    renderBarChart("defenseChart", defensePlayer, "Defense");
    renderBarChart("transitionChart", transitionPlayer, "Transition");
}

function findPlayer(data) {
    return data.find(row => String(row.ssi_player_id) === String(playerId));
}

function getMetricColumns(player) {
    if (!player) return [];

    return Object.keys(player).filter(col =>
        !hiddenColumns.includes(col) &&
        !col.startsWith("_")
    );
}

function renderBarChart(containerId, player, title) {
    const container = document.getElementById(containerId);

    if (!player) {
        container.innerHTML = `<p>No ${title.toLowerCase()} data found.</p>`;
        return;
    }

    const metrics = getMetricColumns(player);

    container.innerHTML = "";

    metrics.forEach(metric => {
        const value = Number(player[metric]);

        const row = document.createElement("div");
        row.className = "bar-row";

        if (Number.isNaN(value)) {
            row.innerHTML = `
                <div class="bar-label">${metric}</div>
                <div class="bar-wrap">
                    <div class="bar-empty">low sample</div>
                </div>
            `;
        } else {
            const pct = Math.round(value * 100);

            row.innerHTML = `
                <div class="bar-label">${metric}</div>
                <div class="bar-wrap">
                    <div class="bar-fill" style="width: ${pct}%;">
                        ${pct}%
                    </div>
                </div>
            `;
        }

        container.appendChild(row);
    });
}

loadPlayerPage();
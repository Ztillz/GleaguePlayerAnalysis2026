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
let filters = [];

const categoryLabels = {
    offense: "Offense",
    defense: "Defense",
    transition: "Transition"
};

const searchInput = document.getElementById("searchInput");
const filtersDiv = document.getElementById("filters");
const addFilterBtn = document.getElementById("addFilterBtn");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");

async function loadAllData() {
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

    renderFilters();
    renderTable();
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

    for (const category of ["offense", "defense", "transition"]) {
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

function addFilter() {
    const category = "offense";

    filters.push({
        category,
        metric: metricColumns[category][0],
        operator: ">=",
        value: 75
    });

    renderFilters();
    renderTable();
}

function renderFilters() {
    filtersDiv.innerHTML = "";

    filters.forEach((filter, index) => {
        const row = document.createElement("div");
        row.className = "filter-row";

        row.innerHTML = `
            <select class="category-select">
                <option value="offense" ${filter.category === "offense" ? "selected" : ""}>Offense</option>
                <option value="defense" ${filter.category === "defense" ? "selected" : ""}>Defense</option>
                <option value="transition" ${filter.category === "transition" ? "selected" : ""}>Transition</option>
            </select>

            <select class="metric-select">
                ${metricColumns[filter.category].map(metric => `
                    <option value="${metric}" ${metric === filter.metric ? "selected" : ""}>
                        ${metric}
                    </option>
                `).join("")}
            </select>

            <select class="operator-select">
                <option value=">=" ${filter.operator === ">=" ? "selected" : ""}>>=</option>
                <option value="<=" ${filter.operator === "<=" ? "selected" : ""}><=</option>
                <option value=">" ${filter.operator === ">" ? "selected" : ""}>></option>
                <option value="<" ${filter.operator === "<" ? "selected" : ""}><</option>
            </select>

            <input class="value-input" type="number" min="0" max="100" value="${filter.value}">

            <span>% percentile</span>

            <button class="remove-filter">Remove</button>
        `;

        row.querySelector(".category-select").addEventListener("change", e => {
            const newCategory = e.target.value;

            filters[index].category = newCategory;
            filters[index].metric = metricColumns[newCategory][0];

            renderFilters();
            renderTable();
        });

        row.querySelector(".metric-select").addEventListener("change", e => {
            filters[index].metric = e.target.value;
            renderTable();
        });

        row.querySelector(".operator-select").addEventListener("change", e => {
            filters[index].operator = e.target.value;
            renderTable();
        });

        row.querySelector(".value-input").addEventListener("input", e => {
            filters[index].value = Number(e.target.value);
            renderTable();
        });

        row.querySelector(".remove-filter").addEventListener("click", () => {
            filters.splice(index, 1);
            renderFilters();
            renderTable();
        });

        filtersDiv.appendChild(row);
    });
}

function passesFilters(player) {
    const search = searchInput.value.toLowerCase();

    if (
        search &&
        !(player.player_name || "").toLowerCase().includes(search)
    ) {
        return false;
    }

    for (const filter of filters) {
        const rawValue = Number(player[filter.category][filter.metric]);
        const percentile = rawValue * 100;
        const target = Number(filter.value);

        if (Number.isNaN(rawValue)) return false;

        if (filter.operator === ">=" && !(percentile >= target)) return false;
        if (filter.operator === "<=" && !(percentile <= target)) return false;
        if (filter.operator === ">" && !(percentile > target)) return false;
        if (filter.operator === "<" && !(percentile < target)) return false;
    }

    return true;
}

function renderTable() {
    const tableHead = document.querySelector("#playerTable thead");
    const tableBody = document.querySelector("#playerTable tbody");

    const selectedMetricColumns = filters.map(filter => ({
        category: filter.category,
        metric: filter.metric
    }));

    tableHead.innerHTML = `
        <tr>
            <th>Player</th>
            <th>Position</th>
            ${selectedMetricColumns.map(col => `
                <th>${categoryLabels[col.category]}: ${col.metric}</th>
            `).join("")}
        </tr>
    `;

    const filteredPlayers = mergedPlayers.filter(passesFilters);

    tableBody.innerHTML = "";

    filteredPlayers.forEach(player => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${player.player_name || ""}</td>
            <td>${player.position || ""}</td>
            ${selectedMetricColumns.map(col => {
                const value = Number(player[col.category][col.metric]);
                return `<td>${Number.isNaN(value) ? "" : Math.round(value * 100) + "%"}</td>`;
            }).join("")}
        `;

        row.addEventListener("click", () => {
            const playerId = encodeURIComponent(player.ssi_player_id);
            window.location.href = `player.html?id=${playerId}`;
        });

        tableBody.appendChild(row);
    });
}

searchInput.addEventListener("input", renderTable);
addFilterBtn.addEventListener("click", addFilter);

resetFiltersBtn.addEventListener("click", () => {
    filters = [];
    renderFilters();
    renderTable();
});

loadAllData();
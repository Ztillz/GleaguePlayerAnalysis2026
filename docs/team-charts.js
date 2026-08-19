const TEAM_CHART_DATA_URL =
    "./data/team_charting_metrics_2025_26.csv";


// ============================================================
// METRICS
// ============================================================

const TEAM_CHART_STATS = {

    "Points From Turnovers":
        "points_from_turnovers",

    "Points In The Paint":
        "points_in_the_paint",

    "Second Chance Points":
        "second_chance_points",

    "Fast Break Points":
        "fast_break_points",

    "Bench Points":
        "bench_points",

    "2P%":
        "two_point_percentage",

    "3P%":
        "three_point_percentage",

    "3PA":
        "three_point_field_goals_attempted",

    "FTA":
        "free_throws_attempted",

    "TO":
        "turnovers",

    "OReb":
        "offensive_rebounds",

    "Total Rebounds":
        "rebounds",

    "Stocks":
        "stocks",
};


// ============================================================
// CONFERENCES
// ============================================================

const TEAM_CONFERENCES = {

    // EAST
    "Birmingham Squadron": "EAST",
    "Capital City Go-Go": "EAST",
    "Cleveland Charge": "EAST",
    "College Park Skyhawks": "EAST",
    "Delaware Blue Coats": "EAST",
    "Grand Rapids Gold": "EAST",
    "Greensboro Swarm": "EAST",
    "Long Island Nets": "EAST",
    "Maine Celtics": "EAST",
    "Motor City Cruise": "EAST",
    "Noblesville Boom": "EAST",
    "Osceola Magic": "EAST",
    "Raptors 905": "EAST",
    "Westchester Knicks": "EAST",
    "Windy City Bulls": "EAST",
    "Wisconsin Herd": "EAST",

    // WEST
    "Austin Spurs": "WEST",
    "Iowa Wolves": "WEST",
    "Memphis Hustle": "WEST",
    "Mexico City Capitanes": "WEST",
    "Oklahoma City Blue": "WEST",
    "Rio Grande Valley Vipers": "WEST",
    "Rip City Remix": "WEST",
    "Salt Lake City Stars": "WEST",
    "San Diego Clippers": "WEST",
    "Santa Cruz Warriors": "WEST",
    "Sioux Falls Skyforce": "WEST",
    "South Bay Lakers": "WEST",
    "Stockton Kings": "WEST",
    "Texas Legends": "WEST",
    "Valley Suns": "WEST",
};

// ============================================================
// TEAM CHART COLORS
//
// Team-inspired 2025-26 palette.
// These are optimized for:
// 1. Team identity
// 2. Dark-background visibility
// 3. Separation between all 31 teams
//
// They are intentionally not always the literal primary
// brand hex because many G League teams share the same
// red / blue / black / gold colors.
// ============================================================

const TEAM_COLORS = {

    // EAST
    "Birmingham Squadron":
        "#C79A5B",

    "Capital City Go-Go":
        "#E63946",

    "Cleveland Charge":
        "#9C3D5A",

    "College Park Skyhawks":
        "#F5C242",

    "Delaware Blue Coats":
        "#2867D7",

    "Grand Rapids Gold":
        "#FFD23F",

    "Greensboro Swarm":
        "#00A7A7",

    "Long Island Nets":
        "#275DAD",

    "Maine Celtics":
        "#00B25A",

    "Motor City Cruise":
        "#667EEA",

    "Noblesville Boom":
        "#00B8E6",

    "Osceola Magic":
        "#0077C8",

    "Raptors 905":
        "#C9184A",

    "Westchester Knicks":
        "#FF7A21",

    "Windy City Bulls":
        "#FF1744",

    "Wisconsin Herd":
        "#5D7F3A",


    // WEST
    "Austin Spurs":
        "#C2C7CE",

    "Iowa Wolves":
        "#86C440",

    "Memphis Hustle":
        "#F45136",

    "Mexico City Capitanes":
        "#EF4B81",

    "Oklahoma City Blue":
        "#FF6B57",

    "Rio Grande Valley Vipers":
        "#8A9099",

    "Rip City Remix":
        "#E8CDAA",

    "Salt Lake City Stars":
        "#7D55C7",

    "San Diego Clippers":
        "#55A7E8",

    "Santa Cruz Warriors":
        "#EAAF00",

    "Sioux Falls Skyforce":
        "#F59E0B",

    "South Bay Lakers":
        "#A78BFA",

    "Stockton Kings":
        "#8B45C6",

    "Texas Legends":
        "#6F8EAD",

    "Valley Suns":
        "#FC4C02",
};

// ============================================================
// DATA
// ============================================================

let teamGameRows = [];

let teamComparisonRows = [];

let teamOrder = [];

let teamSummaryMap =
    new Map();

let teamColorMap =
    new Map();


// ============================================================
// STATE
// ============================================================

const chartState = {

    statLabel:
        "Points From Turnovers",

    mode:
        "Differential",

    displayMode:
        "RAW",

    conference:
        "ALL",

    minimumWins:
        0,

    rankFilter:
        "ALL",

    gameStart:
        1,

    gameEnd:
        50,

    // null means:
    // show every team that passes
    // the other filters.
    selectedTeams:
        null,
};


// ============================================================
// CSV
// ============================================================

function loadCSV(url) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            Papa.parse(
                url,
                {
                    download: true,

                    header: true,

                    dynamicTyping: true,

                    skipEmptyLines: true,


                    complete: results => {

                        const seriousErrors =
                            (
                                results.errors
                                ||
                                []
                            ).filter(
                                error =>
                                    error.code !==
                                    "TooFewFields"
                            );


                        if (
                            seriousErrors.length > 0
                        ) {

                            reject(
                                new Error(
                                    seriousErrors[0].message
                                )
                            );

                            return;
                        }


                        resolve(
                            results.data
                        );
                    },


                    error:
                        reject,
                }
            );
        }
    );
}


// ============================================================
// HELPERS
// ============================================================

function numberOrNull(value) {

    if (
        value === null
        ||
        value === undefined
        ||
        value === ""
    ) {

        return null;
    }


    const number =
        Number(value);


    return Number.isFinite(number)
        ? number
        : null;
}



function average(values) {

    const valid =
        values.filter(
            value =>
                value !== null
                &&
                Number.isFinite(
                    Number(value)
                )
        );


    if (
        valid.length === 0
    ) {

        return null;
    }


    return (
        valid.reduce(
            (
                total,
                value
            ) =>
                total
                +
                Number(value),
            0
        )
        /
        valid.length
    );
}



function rollingAverage(
    values,
    windowSize = 5
) {

    return values.map(
        (
            value,
            index
        ) => {

            if (
                index
                <
                windowSize - 1
            ) {

                return null;
            }


            const window =
                values.slice(
                    index
                    -
                    windowSize
                    +
                    1,
                    index + 1
                );


            if (
                window.some(
                    item =>
                        item === null
                        ||
                        !Number.isFinite(
                            Number(item)
                        )
                )
            ) {

                return null;
            }


            return average(
                window
            );
        }
    );
}

function buildFiveGameGroups(
    rows,
    valueColumn
) {

    const visibleRows =
        sortTeamRows(
            rows.filter(
                row =>
                    row.game_number
                    >=
                    chartState.gameStart
                    &&
                    row.game_number
                    <=
                    chartState.gameEnd
            )
        );


    const groups = [];


    for (
        let i = 0;
        i < visibleRows.length;
        i += 5
    ) {

        const groupRows =
            visibleRows.slice(
                i,
                i + 5
            );


        if (
            groupRows.length === 0
        ) {

            continue;
        }


        const values =
            groupRows.map(
                row =>
                    numberOrNull(
                        row[
                            valueColumn
                        ]
                    )
            );


        const startGame =
            groupRows[0]
                .game_number;


        const endGame =
            groupRows[
                groupRows.length - 1
            ].game_number;


        const wins =
            groupRows.filter(
                row =>
                    row.result
                    ===
                    "W"
            ).length;


        const losses =
            groupRows.filter(
                row =>
                    row.result
                    ===
                    "L"
            ).length;


        groups.push(
            {
                label:
                    `${startGame}-${endGame}`,

                startGame,

                endGame,

                value:
                    average(
                        values
                    ),

                wins,

                losses,

                rows:
                    groupRows,
            }
        );
    }


    return groups;
}


function sortTeamRows(rows) {

    return [
        ...rows
    ].sort(
        (
            a,
            b
        ) => {

            return (
                Number(
                    a.game_number
                )
                -
                Number(
                    b.game_number
                )
            );
        }
    );
}



function isPercentageStat(
    statLabel
) {

    return (
        statLabel === "2P%"
        ||
        statLabel === "3P%"
    );
}



function formatMetricValue(
    value,
    statLabel,
    mode
) {

    if (
        value === null
        ||
        value === undefined
        ||
        !Number.isFinite(
            Number(value)
        )
    ) {

        return "—";
    }


    const number =
        Number(value);


    if (
        isPercentageStat(
            statLabel
        )
    ) {

        if (
            mode ===
            "Differential"
        ) {

            return `${
                number >= 0
                    ? "+"
                    : ""
            }${
                number.toFixed(1)
            } pp`;
        }


        return `${
            number.toFixed(1)
        }%`;
    }


    if (
        mode ===
        "Differential"
    ) {

        return `${
            number >= 0
                ? "+"
                : ""
        }${
            number.toFixed(1)
        }`;
    }


    return (
        number.toFixed(1)
    );
}



function escapeHTML(value) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


// ============================================================
// STABLE TEAM COLORS
// ============================================================

function initializeTeamColors() {

    teamColorMap =
        new Map();


    teamOrder.forEach(
        team => {

            const color =
                TEAM_COLORS[
                    team
                ];


            if (!color) {

                console.warn(
                    `No preset chart color found for ${team}`
                );
            }


            teamColorMap.set(
                team,
                color
                ||
                "#60A5FA"
            );
        }
    );
}



function getTeamColor(team) {

    return (
        teamColorMap.get(
            team
        )
        ||
        TEAM_COLORS[
            team
        ]
        ||
        "#60A5FA"
    );
}


// ============================================================
// BUILD TEAM VS OPPONENT ROWS
// ============================================================

function buildComparisonRows(rows) {

    const gameLookup =
        new Map();


    rows.forEach(
        row => {

            const gameId =
                String(
                    row.game_id
                );


            if (
                !gameLookup.has(
                    gameId
                )
            ) {

                gameLookup.set(
                    gameId,
                    []
                );
            }


            gameLookup
                .get(
                    gameId
                )
                .push(
                    row
                );
        }
    );


    const comparisonRows = [];


    rows.forEach(
        row => {

            const gameRows =
                gameLookup.get(
                    String(
                        row.game_id
                    )
                )
                ||
                [];


            const opponentRow =
                gameRows.find(
                    other =>
                        other.team_name
                        !==
                        row.team_name
                );


            if (!opponentRow) {
                return;
            }


            const comparison = {

                game_id:
                    row.game_id,

                game_date:
                    row.game_date,

                game_number:
                    Number(
                        row.game_number
                    ),

                team_name:
                    row.team_name,

                short_name:
                    row.short_name,

                opponent_name:
                    row.opponent_name,

                location:
                    row.location,

                result:
                    row.result,

                team_score:
                    Number(
                        row.team_score
                    ),

                opponent_score:
                    Number(
                        row.opponent_score
                    ),
            };


            Object.values(
                TEAM_CHART_STATS
            ).forEach(
                column => {

                    const teamValue =
                        numberOrNull(
                            row[
                                column
                            ]
                        );


                    const opponentValue =
                        numberOrNull(
                            opponentRow[
                                column
                            ]
                        );


                    comparison[
                        column
                    ] =
                        teamValue;


                    comparison[
                        `opp_${column}`
                    ] =
                        opponentValue;


                    comparison[
                        `${column}_diff`
                    ] =
                        (
                            teamValue === null
                            ||
                            opponentValue === null
                        )
                            ? null
                            : (
                                teamValue
                                -
                                opponentValue
                            );
                }
            );


            comparisonRows.push(
                comparison
            );
        }
    );


    return comparisonRows;
}


// ============================================================
// TEAM RECORDS
// ============================================================

function buildTeamSummaries(rows) {

    const summaries =
        teamOrder.map(
            team => {

                const teamRows =
                    rows.filter(
                        row =>
                            row.team_name
                            ===
                            team
                    );


                const wins =
                    teamRows.filter(
                        row =>
                            row.result
                            ===
                            "W"
                    ).length;


                const losses =
                    teamRows.filter(
                        row =>
                            row.result
                            ===
                            "L"
                    ).length;


                return {

                    team,

                    conference:
                        TEAM_CONFERENCES[
                            team
                        ]
                        ||
                        "UNKNOWN",

                    wins,

                    losses,

                    winPct:
                        wins
                        /
                        Math.max(
                            teamRows.length,
                            1
                        ),

                    rank:
                        null,
                };
            }
        );


    const ranked =
        [
            ...summaries
        ].sort(
            (
                a,
                b
            ) => {

                if (
                    b.wins
                    !==
                    a.wins
                ) {

                    return (
                        b.wins
                        -
                        a.wins
                    );
                }


                return (
                    a.team.localeCompare(
                        b.team
                    )
                );
            }
        );


    ranked.forEach(
        (
            row,
            index
        ) => {

            row.rank =
                index + 1;
        }
    );


    return new Map(
        summaries.map(
            row => [
                row.team,
                row,
            ]
        )
    );
}


// ============================================================
// RECORD / CONFERENCE FILTERING
// ============================================================

function getEligibleTeamSummaries() {

    let summaries =
        teamOrder.map(
            team =>
                teamSummaryMap.get(
                    team
                )
        );


    if (
        chartState.conference
        !==
        "ALL"
    ) {

        summaries =
            summaries.filter(
                summary =>
                    summary.conference
                    ===
                    chartState.conference
            );
    }


    summaries =
        summaries.filter(
            summary =>
                summary.wins
                >=
                chartState.minimumWins
        );


    summaries.sort(
        (
            a,
            b
        ) => {

            if (
                b.wins
                !==
                a.wins
            ) {

                return (
                    b.wins
                    -
                    a.wins
                );
            }


            return (
                a.team.localeCompare(
                    b.team
                )
            );
        }
    );


    switch (
        chartState.rankFilter
    ) {

        case "TOP_5":

            summaries =
                summaries.slice(
                    0,
                    5
                );

            break;


        case "TOP_10":

            summaries =
                summaries.slice(
                    0,
                    10
                );

            break;


        case "BOTTOM_5":

            summaries =
                summaries.slice(
                    -5
                );

            break;


        case "BOTTOM_10":

            summaries =
                summaries.slice(
                    -10
                );

            break;
    }


    return summaries;
}



function getEligibleTeams() {

    return (
        getEligibleTeamSummaries()
        .map(
            summary =>
                summary.team
        )
    );
}



function getVisibleTeams() {

    const eligible =
        getEligibleTeams();


    if (
        chartState.selectedTeams
        ===
        null
    ) {

        return eligible;
    }


    return eligible.filter(
        team =>
            chartState
                .selectedTeams
                .has(
                    team
                )
    );
}


// ============================================================
// TEAM MULTI SELECT
// ============================================================

function updateTeamMultiSelectLabel() {

    const eligible =
        getEligibleTeams();


    const label =
        document.getElementById(
            "teamMultiSelectLabel"
        );


    if (
        chartState.selectedTeams
        ===
        null
    ) {

        label.textContent =
            `All eligible (${eligible.length})`;

        return;
    }


    const selectedCount =
        eligible.filter(
            team =>
                chartState
                    .selectedTeams
                    .has(
                        team
                    )
        ).length;


    label.textContent =
        `${selectedCount} of ${eligible.length} selected`;
}



function refreshTeamCheckboxList() {

    const list =
        document.getElementById(
            "teamCheckboxList"
        );


    const searchValue =
        document
            .getElementById(
                "teamSearchInput"
            )
            .value
            .trim()
            .toLowerCase();


    list.innerHTML =
        "";


    const eligible =
        getEligibleTeams();


    const displayed =
        eligible.filter(
            team =>
                team
                    .toLowerCase()
                    .includes(
                        searchValue
                    )
        );


    if (
        displayed.length === 0
    ) {

        list.innerHTML =
            `
            <div class="team-select-empty">
                No teams found.
            </div>
            `;

        updateTeamMultiSelectLabel();

        return;
    }


    displayed.forEach(
        team => {

            const summary =
                teamSummaryMap.get(
                    team
                );


            const option =
                document.createElement(
                    "label"
                );


            option.className =
                "team-checkbox-option";


            const checkbox =
                document.createElement(
                    "input"
                );


            checkbox.type =
                "checkbox";


            checkbox.checked =
                (
                    chartState.selectedTeams
                    ===
                    null
                )
                ||
                chartState
                    .selectedTeams
                    .has(
                        team
                    );


            checkbox.addEventListener(
                "change",
                () => {

                    if (
                        chartState.selectedTeams
                        ===
                        null
                    ) {

                        chartState.selectedTeams =
                            new Set(
                                eligible
                            );
                    }


                    if (
                        checkbox.checked
                    ) {

                        chartState
                            .selectedTeams
                            .add(
                                team
                            );

                    } else {

                        chartState
                            .selectedTeams
                            .delete(
                                team
                            );
                    }


                    updateTeamMultiSelectLabel();

                    renderTeamChart();
                }
            );


            const text =
                document.createElement(
                    "span"
                );


            text.innerHTML =
                `
                <strong>
                    ${escapeHTML(team)}
                </strong>

                <small>
                    #${summary.rank}
                    ·
                    ${summary.wins}-${summary.losses}
                </small>
                `;


            option.appendChild(
                checkbox
            );


            option.appendChild(
                text
            );


            list.appendChild(
                option
            );
        }
    );


    updateTeamMultiSelectLabel();
}



function initializeTeamMultiSelect() {

    const container =
        document.getElementById(
            "teamMultiSelect"
        );


    const button =
        document.getElementById(
            "teamMultiSelectButton"
        );


    const panel =
        document.getElementById(
            "teamMultiSelectPanel"
        );


    const search =
        document.getElementById(
            "teamSearchInput"
        );


    const selectAll =
        document.getElementById(
            "selectEligibleTeams"
        );


    const clear =
        document.getElementById(
            "clearSelectedTeams"
        );


    button.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            panel.hidden =
                !panel.hidden;


            if (
                !panel.hidden
            ) {

                refreshTeamCheckboxList();

                search.focus();
            }
        }
    );


    panel.addEventListener(
        "click",
        event => {

            event.stopPropagation();
        }
    );


    document.addEventListener(
        "click",
        event => {

            if (
                !container.contains(
                    event.target
                )
            ) {

                panel.hidden =
                    true;
            }
        }
    );


    search.addEventListener(
        "input",
        refreshTeamCheckboxList
    );


    selectAll.addEventListener(
        "click",
        () => {

            chartState.selectedTeams =
                null;


            refreshTeamCheckboxList();

            renderTeamChart();
        }
    );


    clear.addEventListener(
        "click",
        () => {

            chartState.selectedTeams =
                new Set();


            refreshTeamCheckboxList();

            renderTeamChart();
        }
    );


    refreshTeamCheckboxList();
}


// ============================================================
// STAT SELECT
// ============================================================

function populateStatDropdown() {

    const select =
        document.getElementById(
            "teamStatSelect"
        );


    select.innerHTML =
        "";


    Object.keys(
        TEAM_CHART_STATS
    ).forEach(
        label => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                label;


            option.textContent =
                label;


            select.appendChild(
                option
            );
        }
    );


    select.value =
        chartState.statLabel;


    select.addEventListener(
        "change",
        () => {

            chartState.statLabel =
                select.value;


            renderTeamChart();
        }
    );
}


// ============================================================
// VIEW
// ============================================================

function initializeViewToggle() {

    const differential =
        document.getElementById(
            "differentialBtn"
        );


    const total =
        document.getElementById(
            "totalBtn"
        );


    differential.addEventListener(
        "click",
        () => {

            chartState.mode =
                "Differential";


            differential.classList.add(
                "active"
            );


            total.classList.remove(
                "active"
            );


            renderTeamChart();
        }
    );


    total.addEventListener(
        "click",
        () => {

            chartState.mode =
                "Total";


            total.classList.add(
                "active"
            );


            differential.classList.remove(
                "active"
            );


            renderTeamChart();
        }
    );
}


// ============================================================
// RAW / ROLLING
// ============================================================

function initializeDisplayToggle() {

    const raw =
        document.getElementById(
            "rawDisplayBtn"
        );


    const rolling =
        document.getElementById(
            "rollingDisplayBtn"
        );


    const grouped =
        document.getElementById(
            "groupDisplayBtn"
        );


    function setDisplayMode(
        mode,
        activeButton
    ) {

        chartState.displayMode =
            mode;


        [
            raw,
            rolling,
            grouped
        ].forEach(
            button =>
                button
                    .classList
                    .remove(
                        "active"
                    )
        );


        activeButton
            .classList
            .add(
                "active"
            );


        renderTeamChart();
    }


    raw.addEventListener(
        "click",
        () => {

            setDisplayMode(
                "RAW",
                raw
            );
        }
    );


    rolling.addEventListener(
        "click",
        () => {

            setDisplayMode(
                "ROLLING_5",
                rolling
            );
        }
    );


    grouped.addEventListener(
        "click",
        () => {

            setDisplayMode(
                "FIVE_GAME_GROUPS",
                grouped
            );
        }
    );
}


// ============================================================
// FILTER EVENTS
// ============================================================

function refreshFiltersAndChart() {

    refreshTeamCheckboxList();

    renderTeamChart();
}



function initializeTeamFilters() {

    const conference =
        document.getElementById(
            "conferenceFilter"
        );


    const minimumWins =
        document.getElementById(
            "minimumWinsFilter"
        );


    const rank =
        document.getElementById(
            "rankFilter"
        );


    const gameStart =
        document.getElementById(
            "gameStartFilter"
        );


    const gameEnd =
        document.getElementById(
            "gameEndFilter"
        );


    const reset =
        document.getElementById(
            "resetTeamFilters"
        );


    conference.addEventListener(
        "change",
        () => {

            chartState.conference =
                conference.value;


            refreshFiltersAndChart();
        }
    );


    minimumWins.addEventListener(
        "input",
        () => {

            let value =
                Number(
                    minimumWins.value
                );


            if (
                !Number.isFinite(
                    value
                )
            ) {

                value = 0;
            }


            value =
                Math.max(
                    0,
                    Math.min(
                        50,
                        Math.floor(
                            value
                        )
                    )
                );


            chartState.minimumWins =
                value;


            refreshFiltersAndChart();
        }
    );


    rank.addEventListener(
        "change",
        () => {

            chartState.rankFilter =
                rank.value;


            refreshFiltersAndChart();
        }
    );


    gameStart.addEventListener(
        "change",
        () => {

            let value =
                Number(
                    gameStart.value
                );


            value =
                Math.max(
                    1,
                    Math.min(
                        50,
                        Math.floor(
                            value || 1
                        )
                    )
                );


            if (
                value >
                chartState.gameEnd
            ) {

                chartState.gameEnd =
                    value;


                gameEnd.value =
                    value;
            }


            chartState.gameStart =
                value;


            gameStart.value =
                value;


            renderTeamChart();
        }
    );


    gameEnd.addEventListener(
        "change",
        () => {

            let value =
                Number(
                    gameEnd.value
                );


            value =
                Math.max(
                    1,
                    Math.min(
                        50,
                        Math.floor(
                            value || 50
                        )
                    )
                );


            if (
                value <
                chartState.gameStart
            ) {

                chartState.gameStart =
                    value;


                gameStart.value =
                    value;
            }


            chartState.gameEnd =
                value;


            gameEnd.value =
                value;


            renderTeamChart();
        }
    );


    reset.addEventListener(
        "click",
        () => {

            chartState.conference =
                "ALL";


            chartState.minimumWins =
                0;


            chartState.rankFilter =
                "ALL";

            chartState.gameStart =
                1;

            chartState.gameEnd =
                50;

            chartState.selectedTeams =
                null;


            conference.value =
                "ALL";

            minimumWins.value =
                0;

            rank.value =
                "ALL";

            gameStart.value =
                1;

            gameEnd.value =
                50;


            document.getElementById(
                "teamSearchInput"
            ).value =
                "";


            refreshFiltersAndChart();
        }
    );
}


// ============================================================
// SHOW / HIDE ALL
// ============================================================

function initializeChartVisibilityButtons() {

    document
        .getElementById(
            "showAllChartTeams"
        )
        .addEventListener(
            "click",
            () => {

                Plotly.restyle(
                    "teamTrendChart",
                    {
                        visible:
                            true,
                    }
                );
            }
        );


    document
        .getElementById(
            "hideAllChartTeams"
        )
        .addEventListener(
            "click",
            () => {

                Plotly.restyle(
                    "teamTrendChart",
                    {
                        visible:
                            "legendonly",
                    }
                );
            }
        );
}


// ============================================================
// AXIS
// ============================================================

function getYAxisTitle(
    statLabel,
    mode
) {

    if (
        isPercentageStat(
            statLabel
        )
    ) {

        if (
            mode ===
            "Differential"
        ) {

            return (
                `${statLabel} Differential `
                +
                "(Percentage Points)"
            );
        }


        return `${statLabel} (%)`;
    }


    return (
        `${statLabel} ${mode}`
    );
}



function getXAxisTickInterval() {

    const gamesShown =
        chartState.gameEnd
        -
        chartState.gameStart
        +
        1;


    if (
        gamesShown <= 20
    ) {

        return 1;
    }


    if (
        gamesShown <= 35
    ) {

        return 2;
    }


    return 5;
}



function getZeroLineShape() {

    if (
        chartState.mode
        !==
        "Differential"
    ) {

        return [];
    }


    return [
        {

            type:
                "line",

            xref:
                "paper",

            x0:
                0,

            x1:
                1,

            y0:
                0,

            y1:
                0,

            line: {

                color:
                    "#94a3b8",

                width:
                    1,

                dash:
                    "dash",
            },

            opacity:
                0.8,
        },
    ];
}


// ============================================================
// FILTER SUMMARY
// ============================================================

function updateFilterSummary(
    eligibleTeams,
    visibleTeams
) {

    document.getElementById(
        "teamsShowing"
    ).textContent =
        `${
            visibleTeams.length
        } / ${
            teamOrder.length
        }`;


    const pieces = [];


    // ========================================================
    // CONFERENCE
    // ========================================================

    if (
        chartState.conference
        !==
        "ALL"
    ) {

        pieces.push(
            chartState.conference
                ===
                "EAST"
                ? "East Conference"
                : "West Conference"
        );
    }


    // ========================================================
    // MINIMUM WINS
    // ========================================================

    if (
        chartState.minimumWins > 0
    ) {

        pieces.push(
            `${
                chartState.minimumWins
            }+ wins`
        );
    }


    // ========================================================
    // RANK GROUP
    // ========================================================

    const rankLabels = {

        TOP_5:
            "Top 5",

        TOP_10:
            "Top 10",

        BOTTOM_5:
            "Bottom 5",

        BOTTOM_10:
            "Bottom 10",
    };


    if (
        chartState.rankFilter
        !==
        "ALL"
    ) {

        pieces.push(
            rankLabels[
                chartState.rankFilter
            ]
        );
    }


    // ========================================================
    // MANUAL TEAM SELECTION
    // ========================================================

    if (
        chartState.selectedTeams
        !==
        null
    ) {

        pieces.push(
            `${
                visibleTeams.length
            } manually selected`
        );
    }


    // ========================================================
    // GAME RANGE
    // ========================================================

    pieces.push(
        `Games ${
            chartState.gameStart
        }-${
            chartState.gameEnd
        }`
    );


    // ========================================================
    // DISPLAY MODE
    // ========================================================

    if (
        chartState.displayMode
        ===
        "ROLLING_5"
    ) {

        pieces.push(
            "5-game rolling average"
        );

    } else if (
        chartState.displayMode
        ===
        "FIVE_GAME_GROUPS"
    ) {

        pieces.push(
            "5-game groups"
        );

    } else {

        pieces.push(
            "raw game values"
        );
    }


    // ========================================================
    // FINAL DESCRIPTION
    // ========================================================

    const description =
        document.getElementById(
            "activeFilterDescription"
        );


    description.textContent =
        `Showing ${
            visibleTeams.length
        } of ${
            eligibleTeams.length
        } eligible teams · ${
            pieces.join(" · ")
        }.`;
}


// ============================================================
// TRACE
// ============================================================

function buildTeamTrace(team) {

    const statLabel =
        chartState.statLabel;


    const statColumn =
        TEAM_CHART_STATS[
            statLabel
        ];


    const valueColumn =
        chartState.mode
        ===
        "Differential"
            ? `${statColumn}_diff`
            : statColumn;


    const allRows =
        sortTeamRows(
            teamComparisonRows.filter(
                row =>
                    row.team_name
                    ===
                    team
            )
        );


    const summary =
        teamSummaryMap.get(
            team
        );


    const color =
        getTeamColor(
            team
        );


    // ========================================================
    // HELPER: FORMAT ONE GAME FOR HOVER
    // ========================================================

    function formatGameStatLine(row) {

        const value =
            numberOrNull(
                row[
                    valueColumn
                ]
            );


        const matchup =
            String(
                row.location
            ).toUpperCase()
            ===
            "AWAY"

                ? `@ ${
                    escapeHTML(
                        row.opponent_name
                    )
                }`

                : `vs ${
                    escapeHTML(
                        row.opponent_name
                    )
                }`;


        return (
            `Game ${
                row.game_number
            } ${
                matchup
            }: <b>${
                formatMetricValue(
                    value,
                    statLabel,
                    chartState.mode
                )
            }</b>`
        );
    }


    // ========================================================
    // 5-GAME NON-OVERLAPPING GROUPS
    // ========================================================

    if (
        chartState.displayMode
        ===
        "FIVE_GAME_GROUPS"
    ) {

        const groups =
            buildFiveGameGroups(
                allRows,
                valueColumn
            );


        const rangeRows =
            allRows.filter(
                row =>
                    row.game_number
                    >=
                    chartState.gameStart
                    &&
                    row.game_number
                    <=
                    chartState.gameEnd
            );


        const rangeAverage =
            average(
                rangeRows.map(
                    row =>
                        numberOrNull(
                            row[
                                valueColumn
                            ]
                        )
                )
            );


        const averageText =
            formatMetricValue(
                rangeAverage,
                statLabel,
                chartState.mode
            );


        const hoverText =
            groups.map(
                group => {

                    const gameLines =
                        group.rows.map(
                            row =>
                                formatGameStatLine(
                                    row
                                )
                        );


                    return (
                        `<b>${
                            escapeHTML(
                                team
                            )
                        }</b><br>`
                        +
                        `<b>${
                            escapeHTML(
                                statLabel
                            )
                        } ${
                            chartState.mode
                        }</b><br>`
                        +
                        `Games ${
                            group.startGame
                        }-${
                            group.endGame
                        }<br><br>`
                        +
                        `<b>Group Average:</b> ${
                            formatMetricValue(
                                group.value,
                                statLabel,
                                chartState.mode
                            )
                        }<br><br>`
                        +
                        `<b>Games Included:</b><br>`
                        +
                        gameLines.join(
                            "<br>"
                        )
                    );
                }
            );


        return {

            x:
                groups.map(
                    group =>
                        group.label
                ),

            y:
                groups.map(
                    group =>
                        group.value
                ),

            text:
                hoverText,

            type:
                "scatter",

            mode:
                "lines+markers",

            name:
                `#${
                    summary.rank
                } ${
                    team
                } (${
                    summary.wins
                }-${
                    summary.losses
                }) — ${
                    averageText
                }`,

            line: {

                color,

                width:
                    3,
            },

            marker: {

                color,

                size:
                    9,
            },

            hovertemplate:
                "%{text}<extra></extra>",

            connectgaps:
                false,
        };
    }


    // ========================================================
    // RAW VALUES
    // ========================================================

    const rawValues =
        allRows.map(
            row =>
                numberOrNull(
                    row[
                        valueColumn
                    ]
                )
        );


    // ========================================================
    // 5-GAME ROLLING VALUES
    // ========================================================

    const rollingValues =
        rollingAverage(
            rawValues,
            5
        );


    const displayValues =
        chartState.displayMode
        ===
        "ROLLING_5"
            ? rollingValues
            : rawValues;


    // ========================================================
    // VISIBLE RANGE
    // ========================================================

    const visibleIndexes =
        allRows
            .map(
                (
                    row,
                    index
                ) => ({
                    row,
                    index,
                })
            )
            .filter(
                item =>
                    item.row.game_number
                    >=
                    chartState.gameStart
                    &&
                    item.row.game_number
                    <=
                    chartState.gameEnd
            );


    const rows =
        visibleIndexes.map(
            item =>
                item.row
        );


    const values =
        visibleIndexes.map(
            item =>
                displayValues[
                    item.index
                ]
        );


    const visibleRawValues =
        visibleIndexes.map(
            item =>
                rawValues[
                    item.index
                ]
        );


    const rangeAverage =
        average(
            visibleRawValues
        );


    const averageText =
        formatMetricValue(
            rangeAverage,
            statLabel,
            chartState.mode
        );


    // ========================================================
    // HOVER TEXT
    // ========================================================

    const hoverText =
        visibleIndexes.map(
            item => {

                const row =
                    item.row;


                const index =
                    item.index;


                const rawValue =
                    rawValues[
                        index
                    ];


                const displayValue =
                    displayValues[
                        index
                    ];


                const matchup =
                    String(
                        row.location
                    ).toUpperCase()
                    ===
                    "AWAY"

                        ? `@ ${
                            escapeHTML(
                                row.opponent_name
                            )
                        }`

                        : `vs ${
                            escapeHTML(
                                row.opponent_name
                            )
                        }`;


                // ====================================================
                // ROLLING AVERAGE HOVER
                // ====================================================

                if (
                    chartState.displayMode
                    ===
                    "ROLLING_5"
                ) {

                    // The point at Game N contains:
                    // N-4, N-3, N-2, N-1, N
                    const rollingStart =
                        Math.max(
                            0,
                            index - 4
                        );


                    const rollingRows =
                        allRows.slice(
                            rollingStart,
                            index + 1
                        );


                    const gameLines =
                        rollingRows.map(
                            rollingRow =>
                                formatGameStatLine(
                                    rollingRow
                                )
                        );


                    return (
                        `<b>${
                            escapeHTML(
                                team
                            )
                        }</b><br>`
                        +
                        `<b>${
                            escapeHTML(
                                statLabel
                            )
                        } ${
                            chartState.mode
                        }</b><br>`
                        +
                        `Rolling point at Game ${
                            row.game_number
                        }<br><br>`
                        +
                        `<b>5-Game Rolling Avg:</b> ${
                            formatMetricValue(
                                displayValue,
                                statLabel,
                                chartState.mode
                            )
                        }<br><br>`
                        +
                        `<b>Games Included:</b><br>`
                        +
                        gameLines.join(
                            "<br>"
                        )
                    );
                }


                // ====================================================
                // RAW GAME HOVER
                // ====================================================

                const teamValue =
                    row[
                        statColumn
                    ];


                const opponentValue =
                    row[
                        `opp_${statColumn}`
                    ];


                let metricBlock =
                    (
                        `<b>${
                            escapeHTML(
                                statLabel
                            )
                        } ${
                            chartState.mode
                        }:</b> ${
                            formatMetricValue(
                                rawValue,
                                statLabel,
                                chartState.mode
                            )
                        }<br>`
                    );


                if (
                    chartState.mode
                    ===
                    "Differential"
                ) {

                    metricBlock +=
                        `Team: ${
                            formatMetricValue(
                                teamValue,
                                statLabel,
                                "Total"
                            )
                        }<br>`;


                    metricBlock +=
                        `Opponent: ${
                            formatMetricValue(
                                opponentValue,
                                statLabel,
                                "Total"
                            )
                        }`;
                }


                return (
                    `<b>${
                        escapeHTML(
                            team
                        )
                    }</b><br>`
                    +
                    `Game ${
                        row.game_number
                    } ${
                        matchup
                    }<br>`
                    +
                    `${
                        escapeHTML(
                            row.game_date
                        )
                    }<br><br>`
                    +
                    metricBlock
                );
            }
        );


    // ========================================================
    // RAW / ROLLING TRACE
    // ========================================================

    return {

        x:
            rows.map(
                row =>
                    row.game_number
            ),

        y:
            values,

        text:
            hoverText,

        type:
            "scatter",

        mode:
            "lines+markers",

        name:
            `#${
                summary.rank
            } ${
                team
            } (${
                summary.wins
            }-${
                summary.losses
            }) — ${
                averageText
            }`,

        line: {

            color,

            width:
                chartState.displayMode
                ===
                "ROLLING_5"
                    ? 3
                    : 2.3,
        },

        marker: {

            color,

            size:
                chartState.displayMode
                ===
                "ROLLING_5"
                    ? 5
                    : 6,
        },

        hovertemplate:
            "%{text}<extra></extra>",

        connectgaps:
            false,
    };
}


// ============================================================
// RENDER
// ============================================================

function renderTeamChart() {

    // ========================================================
    // FILTER TEAMS
    // ========================================================

    const eligibleTeams =
        getEligibleTeams();


    const visibleTeams =
        getVisibleTeams();


    updateFilterSummary(
        eligibleTeams,
        visibleTeams
    );


    updateTeamMultiSelectLabel();


    // ========================================================
    // CURRENT METRIC / MODE
    // ========================================================

    const statLabel =
        chartState.statLabel;


    const mode =
        chartState.mode;


    // ========================================================
    // DISPLAY MODE LABELS
    // ========================================================

    let displayText;

    let title;


    if (
        chartState.displayMode
        ===
        "ROLLING_5"
    ) {

        displayText =
            "5-Game Rolling Average";


        title =
            `${statLabel} ${mode} — 5-Game Rolling Average`;

    } else if (
        chartState.displayMode
        ===
        "FIVE_GAME_GROUPS"
    ) {

        displayText =
            "5-Game Groups";


        title =
            `${statLabel} ${mode} — 5-Game Group Averages`;

    } else {

        displayText =
            "Raw";


        title =
            `${statLabel} ${mode} by Game`;
    }


    // ========================================================
    // PAGE LABELS
    // ========================================================

    document.getElementById(
        "teamChartTitle"
    ).textContent =
        title;


    document.getElementById(
        "currentChartView"
    ).textContent =
        `${
            statLabel
        } ${
            mode
        } · ${
            displayText
        }`;


    // ========================================================
    // BUILD TEAM TRACES
    // ========================================================

    const traces =
        visibleTeams.map(
            team =>
                buildTeamTrace(
                    team
                )
        );


    // ========================================================
    // NO MATCHING TEAMS
    // ========================================================

    if (
        traces.length === 0
    ) {

        Plotly.purge(
            "teamTrendChart"
        );


        document.getElementById(
            "teamTrendChart"
        ).innerHTML =
            `
            <div class="no-teams-message">
                No teams match the current filters.
            </div>
            `;


        return;
    }


    // ========================================================
    // X AXIS
    // ========================================================

    let xAxisSettings;


    if (
        chartState.displayMode
        ===
        "FIVE_GAME_GROUPS"
    ) {

        xAxisSettings = {

            title: {
                text:
                    "Game Group",
            },

            type:
                "category",

            gridcolor:
                "#263449",

            zerolinecolor:
                "#475569",

            tickfont: {
                size:
                    11,
            },
        };

    } else {

        xAxisSettings = {

            title: {
                text:
                    "Team Game Number",
            },

            range: [
                chartState.gameStart
                -
                0.5,

                chartState.gameEnd
                +
                0.5
            ],

            tickmode:
                "linear",

            tick0:
                chartState.gameStart,

            dtick:
                getXAxisTickInterval(),

            gridcolor:
                "#263449",

            zerolinecolor:
                "#475569",

            tickfont: {
                size:
                    10,
            },
        };
    }


    // ========================================================
    // CHART LAYOUT
    // ========================================================

    const layout = {

        title: {

            text:
                title,

            x:
                0.5,

            font: {

                size:
                    22,

                color:
                    "#f8fafc",
            },
        },


        height:
            760,


        paper_bgcolor:
            "#0f172a",


        plot_bgcolor:
            "#0f172a",


        font: {

            family:
                "Inter, Arial, sans-serif",

            color:
                "#cbd5e1",
        },


        hovermode:
            "closest",


        xaxis:
            xAxisSettings,


        yaxis: {

            title: {

                text:
                    getYAxisTitle(
                        statLabel,
                        mode
                    ),
            },

            gridcolor:
                "#263449",

            zerolinecolor:
                "#64748b",
        },


        legend: {

            title: {

                text:
                    "Rank · Team (W-L) — Range Avg",
            },

            orientation:
                "v",

            yanchor:
                "top",

            y:
                1,

            xanchor:
                "left",

            x:
                1.02,

            font: {

                size:
                    11,
            },

            bgcolor:
                "rgba(15,23,42,0.75)",

            bordercolor:
                "#334155",

            borderwidth:
                1,
        },


        margin: {

            l:
                75,

            r:
                365,

            t:
                90,

            b:
                70,
        },


        shapes:
            getZeroLineShape(),
    };


    // ========================================================
    // PLOTLY CONFIG
    // ========================================================

    const config = {

        responsive:
            true,

        displayModeBar:
            true,

        displaylogo:
            false,

        modeBarButtonsToRemove: [
            "lasso2d",
            "select2d",
        ],
    };


    // ========================================================
    // RENDER
    // ========================================================

    Plotly.react(
        "teamTrendChart",
        traces,
        layout,
        config
    );
}


// ============================================================
// VALIDATION
// ============================================================

function validateLoadedData(rows) {

    const teams =
        new Set(
            rows.map(
                row =>
                    row.team_name
            )
        );


    const games =
        new Set(
            rows.map(
                row =>
                    String(
                        row.game_id
                    )
            )
        );


    if (
        rows.length !==
        1550
    ) {

        throw new Error(
            `Expected 1550 team-game rows, found ${rows.length}.`
        );
    }


    if (
        teams.size !==
        31
    ) {

        throw new Error(
            `Expected 31 teams, found ${teams.size}.`
        );
    }


    if (
        games.size !==
        775
    ) {

        throw new Error(
            `Expected 775 games, found ${games.size}.`
        );
    }


    const unmappedTeams =
        [
            ...teams
        ].filter(
            team =>
                !TEAM_CONFERENCES[
                    team
                ]
        );


    if (
        unmappedTeams.length > 0
    ) {

        throw new Error(
            "Missing conference mapping for: "
            +
            unmappedTeams.join(
                ", "
            )
        );
    }
}


// ============================================================
// STARTUP
// ============================================================

async function initializeTeamCharts() {

    const errorElement =
        document.getElementById(
            "teamChartError"
        );


    try {

        teamGameRows =
            await loadCSV(
                TEAM_CHART_DATA_URL
            );


        teamGameRows =
            teamGameRows.filter(
                row =>
                    row.team_name
                    &&
                    row.game_id
            );


        validateLoadedData(
            teamGameRows
        );


        teamOrder =
            [
                ...new Set(
                    teamGameRows.map(
                        row =>
                            row.team_name
                    )
                ),
            ].sort(
                (
                    a,
                    b
                ) =>
                    a.localeCompare(
                        b
                    )
            );


        initializeTeamColors();


        teamComparisonRows =
            buildComparisonRows(
                teamGameRows
            );


        teamSummaryMap =
            buildTeamSummaries(
                teamComparisonRows
            );


        populateStatDropdown();

        initializeViewToggle();

        initializeDisplayToggle();

        initializeTeamFilters();

        initializeTeamMultiSelect();

        initializeChartVisibilityButtons();

        renderTeamChart();


    } catch (error) {

        console.error(
            error
        );


        errorElement.hidden =
            false;


        errorElement.textContent =
            (
                "Could not load Team Charts data. "
                +
                error.message
            );
    }
}


document.addEventListener(
    "DOMContentLoaded",
    initializeTeamCharts
);
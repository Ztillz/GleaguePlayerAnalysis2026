const TEAM_CHART_DATA_URL =
    "./data/team_charting_metrics_2025_26.csv";


// ============================================================
// AVAILABLE METRICS
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
// 2025-26 G LEAGUE CONFERENCES
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
// STATE
// ============================================================

let teamGameRows = [];

let teamComparisonRows = [];

let teamOrder = [];

let teamSummaryMap =
    new Map();

let teamColorMap =
    new Map();


const chartState = {

    statLabel:
        "Points From Turnovers",

    mode:
        "Differential",

    conference:
        "ALL",

    minimumWins:
        0,

    rankFilter:
        "ALL",
};


// ============================================================
// LOAD CSV
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
                                    seriousErrors[
                                        0
                                    ].message
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
// BASIC HELPERS
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


    return Number.isFinite(
        number
    )
        ? number
        : null;
}



function average(values) {

    const validValues =
        values.filter(
            value =>
                value !== null
                &&
                Number.isFinite(
                    value
                )
        );


    if (
        validValues.length === 0
    ) {

        return null;
    }


    return (
        validValues.reduce(
            (
                total,
                value
            ) =>
                total + value,
            0
        )
        /
        validValues.length
    );
}



function sortTeamRows(rows) {

    return [
        ...rows
    ].sort(
        (
            a,
            b
        ) => {

            const gameDifference =
                Number(
                    a.game_number
                )
                -
                Number(
                    b.game_number
                );


            if (
                gameDifference !== 0
            ) {

                return gameDifference;
            }


            return (
                new Date(
                    a.game_date
                )
                -
                new Date(
                    b.game_date
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


// ============================================================
// STABLE TEAM COLORS
// ============================================================

function initializeTeamColors() {

    teamColorMap =
        new Map();


    teamOrder.forEach(
        (
            team,
            index
        ) => {

            const hue =
                Math.round(
                    (
                        index
                        *
                        360
                        /
                        teamOrder.length
                    )
                    %
                    360
                );


            teamColorMap.set(
                team,
                `hsl(${hue}, 72%, 52%)`
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
        "#60a5fa"
    );
}


// ============================================================
// BUILD TEAM VS OPPONENT ROWS
// ============================================================

function buildComparisonRows(
    rows
) {

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


            Object.entries(
                TEAM_CHART_STATS
            ).forEach(
                (
                    [
                        ,
                        column
                    ]
                ) => {

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
// TEAM RECORDS / 50-GAME RANKING
// ============================================================

function buildTeamSummaries(
    rows
) {

    const summaries = [];


    teamOrder.forEach(
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


            summaries.push(
                {
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
                        teamRows.length > 0
                            ? (
                                wins
                                /
                                teamRows.length
                            )
                            : 0,

                    rank:
                        null,
                }
            );
        }
    );


    // League-wide 50-game rank.
    // Ties use win percentage, then team name.
    const ranked =
        [
            ...summaries
        ].sort(
            (
                a,
                b
            ) => {

                if (
                    b.wins !==
                    a.wins
                ) {

                    return (
                        b.wins
                        -
                        a.wins
                    );
                }


                if (
                    b.winPct !==
                    a.winPct
                ) {

                    return (
                        b.winPct
                        -
                        a.winPct
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
            summary,
            index
        ) => {

            summary.rank =
                index + 1;
        }
    );


    return new Map(
        summaries.map(
            summary => [
                summary.team,
                summary,
            ]
        )
    );
}


// ============================================================
// FILTERING
// ============================================================

function getEligibleTeams() {

    let summaries =
        teamOrder.map(
            team =>
                teamSummaryMap.get(
                    team
                )
        );


    // Conference
    if (
        chartState.conference !==
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


    // Minimum wins
    summaries =
        summaries.filter(
            summary =>
                summary.wins
                >=
                chartState.minimumWins
        );


    // Sort best -> worst before applying rank group.
    summaries.sort(
        (
            a,
            b
        ) => {

            if (
                b.wins !==
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


        default:

            break;
    }


    return summaries.map(
        summary =>
            summary.team
    );
}



function updateFilterSummary(
    filteredTeams
) {

    const teamsShowing =
        document.getElementById(
            "teamsShowing"
        );


    teamsShowing.textContent =
        `${
            filteredTeams.length
        } / ${
            teamOrder.length
        }`;


    const description =
        document.getElementById(
            "activeFilterDescription"
        );


    const pieces = [];


    if (
        chartState.conference !==
        "ALL"
    ) {

        pieces.push(
            `${
                chartState.conference ===
                "EAST"
                    ? "East"
                    : "West"
            } Conference`
        );
    }


    if (
        chartState.minimumWins > 0
    ) {

        pieces.push(
            `${
                chartState.minimumWins
            }+ wins`
        );
    }


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
        chartState.rankFilter !==
        "ALL"
    ) {

        pieces.push(
            rankLabels[
                chartState.rankFilter
            ]
        );
    }


    if (
        pieces.length === 0
    ) {

        description.textContent =
            `Showing all ${
                teamOrder.length
            } teams.`;

        return;
    }


    description.textContent =
        `Showing ${
            filteredTeams.length
        } team${
            filteredTeams.length === 1
                ? ""
                : "s"
        }: ${
            pieces.join(" · ")
        }.`;
}


// ============================================================
// STAT DROPDOWN
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
// DIFFERENTIAL / TOTAL TOGGLE
// ============================================================

function initializeViewToggle() {

    const differentialBtn =
        document.getElementById(
            "differentialBtn"
        );


    const totalBtn =
        document.getElementById(
            "totalBtn"
        );


    differentialBtn.addEventListener(
        "click",
        () => {

            chartState.mode =
                "Differential";


            differentialBtn
                .classList
                .add(
                    "active"
                );


            totalBtn
                .classList
                .remove(
                    "active"
                );


            renderTeamChart();
        }
    );


    totalBtn.addEventListener(
        "click",
        () => {

            chartState.mode =
                "Total";


            totalBtn
                .classList
                .add(
                    "active"
                );


            differentialBtn
                .classList
                .remove(
                    "active"
                );


            renderTeamChart();
        }
    );
}


// ============================================================
// TEAM FILTER EVENTS
// ============================================================

function initializeTeamFilters() {

    const conferenceFilter =
        document.getElementById(
            "conferenceFilter"
        );


    const minimumWinsFilter =
        document.getElementById(
            "minimumWinsFilter"
        );


    const rankFilter =
        document.getElementById(
            "rankFilter"
        );


    const resetButton =
        document.getElementById(
            "resetTeamFilters"
        );


    conferenceFilter.addEventListener(
        "change",
        () => {

            chartState.conference =
                conferenceFilter.value;


            renderTeamChart();
        }
    );


    minimumWinsFilter.addEventListener(
        "input",
        () => {

            let value =
                Number(
                    minimumWinsFilter.value
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


            renderTeamChart();
        }
    );


    rankFilter.addEventListener(
        "change",
        () => {

            chartState.rankFilter =
                rankFilter.value;


            renderTeamChart();
        }
    );


    resetButton.addEventListener(
        "click",
        () => {

            chartState.conference =
                "ALL";


            chartState.minimumWins =
                0;


            chartState.rankFilter =
                "ALL";


            conferenceFilter.value =
                "ALL";


            minimumWinsFilter.value =
                "0";


            rankFilter.value =
                "ALL";


            renderTeamChart();
        }
    );
}


// ============================================================
// AXIS TITLES
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


        return (
            `${statLabel} (%)`
        );
    }


    return (
        `${statLabel} ${mode}`
    );
}


// ============================================================
// ZERO LINE
// ============================================================

function getZeroLineShape() {

    if (
        chartState.mode !==
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
// TEAM TRACE
// ============================================================

function buildTeamTrace(team) {

    const statLabel =
        chartState.statLabel;


    const statColumn =
        TEAM_CHART_STATS[
            statLabel
        ];


    const differentialColumn =
        `${statColumn}_diff`;


    const rows =
        sortTeamRows(
            teamComparisonRows.filter(
                row =>
                    row.team_name
                    ===
                    team
            )
        );


    const values =
        chartState.mode ===
        "Differential"
            ? rows.map(
                row =>
                    row[
                        differentialColumn
                    ]
            )
            : rows.map(
                row =>
                    row[
                        statColumn
                    ]
            );


    const teamAverage =
        average(
            values
        );


    const averageText =
        formatMetricValue(
            teamAverage,
            statLabel,
            chartState.mode
        );


    const summary =
        teamSummaryMap.get(
            team
        );


    const color =
        getTeamColor(
            team
        );


    const customData =
        rows.map(
            row => [

                row.game_date,

                row.opponent_name,

                row.result,

                row.team_score,

                row.opponent_score,

                row[
                    statColumn
                ],

                row[
                    `opp_${statColumn}`
                ],

                row.location,
            ]
        );


    let hoverTemplate;


    if (
        chartState.mode ===
        "Differential"
    ) {

        hoverTemplate =
            `<b>${team}</b><br>`
            +
            `Game %{x}<br>`
            +
            `%{customdata[0]}<br>`
            +
            `%{customdata[7]} vs %{customdata[1]}<br>`
            +
            `%{customdata[2]} `
            +
            `%{customdata[3]}-%{customdata[4]}<br><br>`
            +
            `<b>${statLabel} Differential:</b> %{y:.1f}<br>`
            +
            `Team: %{customdata[5]:.1f}<br>`
            +
            `Opponent: %{customdata[6]:.1f}`
            +
            `<extra></extra>`;

    } else {

        hoverTemplate =
            `<b>${team}</b><br>`
            +
            `Game %{x}<br>`
            +
            `%{customdata[0]}<br>`
            +
            `%{customdata[7]} vs %{customdata[1]}<br>`
            +
            `%{customdata[2]} `
            +
            `%{customdata[3]}-%{customdata[4]}<br><br>`
            +
            `<b>${statLabel}:</b> %{y:.1f}`
            +
            `<extra></extra>`;
    }


    return {

        x:
            rows.map(
                row =>
                    row.game_number
            ),

        y:
            values,

        customdata:
            customData,

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
                2.5,
        },

        marker: {

            color,

            size:
                6,
        },

        hovertemplate:
            hoverTemplate,

        connectgaps:
            false,
    };
}


// ============================================================
// RENDER CHART
// ============================================================

function renderTeamChart() {

    const statLabel =
        chartState.statLabel;


    const mode =
        chartState.mode;


    const filteredTeams =
        getEligibleTeams();


    updateFilterSummary(
        filteredTeams
    );


    const traces =
        filteredTeams.map(
            team =>
                buildTeamTrace(
                    team
                )
        );


    const title =
        `${statLabel} ${mode} by Game`;


    document.getElementById(
        "teamChartTitle"
    ).textContent =
        title;


    document.getElementById(
        "currentChartView"
    ).textContent =
        `${statLabel} ${mode}`;


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


        xaxis: {

            title: {

                text:
                    "Team Game Number",

                font: {
                    color:
                        "#cbd5e1",
                },
            },

            range:
                [
                    0.5,
                    50.5
                ],

            tickmode:
                "linear",

            tick0:
                1,

            dtick:
                1,

            gridcolor:
                "#263449",

            zerolinecolor:
                "#475569",

            tickfont: {
                size:
                    10,
            },
        },


        yaxis: {

            title: {

                text:
                    getYAxisTitle(
                        statLabel,
                        mode
                    ),

                font: {
                    color:
                        "#cbd5e1",
                },
            },

            gridcolor:
                "#263449",

            zerolinecolor:
                "#64748b",
        },


        legend: {

            title: {
                text:
                    "Rank · Team (W-L) — Avg",
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
                345,

            t:
                90,

            b:
                70,
        },


        shapes:
            getZeroLineShape(),
    };


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


    const unknownConferenceTeams =
        [
            ...teams
        ].filter(
            team =>
                !TEAM_CONFERENCES[
                    team
                ]
        );


    if (
        unknownConferenceTeams.length > 0
    ) {

        throw new Error(
            "Missing conference mapping for: "
            +
            unknownConferenceTeams.join(
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


        initializeTeamFilters();


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
                "Check docs/data/"
                +
                "team_charting_metrics_2025_26.csv. "
                +
                error.message
            );
    }
}


document.addEventListener(
    "DOMContentLoaded",
    initializeTeamCharts
);
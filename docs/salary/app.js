const SALARY_DATA_URL =
  "./data/game_salary_components_2025_26.csv";


let salaryRows = [];
let currentTeamMetrics = [];
let currentPedigreeMetrics = [];
let scatterScreenPoints = [];


const state = {
  includeGLeague: false,
  includeE10: true,
  includeTwoWay: true,
  sortKey: "money_faced_rank",
  sortDirection: "asc",
};


const pedigreeState = {
  sortKey: "pedigree_faced_rank",
  sortDirection: "asc",
};


const scatterState = {
  xKey: "avg_pedigree_available",
  yKey: "wins",
};


const scatterMetricLabels = {
  avg_pedigree_available:
    "Avg Pedigree Available / Game",

  avg_pedigree_faced:
    "Avg Pedigree Faced / Game",

  wins:
    "Wins",

  losses:
    "Losses",
};


// ============================================================
// LOAD CSV
// ============================================================

function loadCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,

      complete: results => {
        const seriousErrors = (
          results.errors || []
        ).filter(
          error =>
            error.code !== "TooFewFields"
        );

        if (seriousErrors.length > 0) {
          reject(
            new Error(
              seriousErrors[0].message
            )
          );

          return;
        }

        resolve(results.data);
      },

      error: reject,
    });
  });
}


// ============================================================
// HELPERS
// ============================================================

function numberOrZero(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}


function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    )
    /
    values.length
  );
}


function formatCurrency(value) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }
  ).format(
    numberOrZero(value)
  );
}


function formatCompactCurrency(value) {
  const number =
    numberOrZero(value);

  const absolute =
    Math.abs(number);

  if (absolute >= 1_000_000) {
    return `$${(
      number / 1_000_000
    ).toFixed(2)}M`;
  }

  if (absolute >= 100_000) {
    return `$${(
      number / 1_000
    ).toFixed(0)}K`;
  }

  if (absolute >= 1_000) {
    return `$${(
      number / 1_000
    ).toFixed(1)}K`;
  }

  return `$${number.toFixed(0)}`;
}


function formatMinutes(value) {
  return `${
    numberOrZero(value).toFixed(1)
  } min`;
}


function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(`${value}T12:00:00`);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
}


function clamp(
  value,
  minimum,
  maximum
) {
  return Math.min(
    Math.max(
      value,
      minimum
    ),
    maximum
  );
}


function escapeHTML(value) {
  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function getTeams(rows) {
  return [
    ...new Set(
      rows
        .map(row => row.team)
        .filter(Boolean)
    ),
  ].sort(
    (a, b) =>
      a.localeCompare(b)
  );
}


// ============================================================
// FINANCIAL CALCULATIONS
// ============================================================

function getSelectedOwnSpending(row) {
  let total = 0;

  if (state.includeGLeague) {
    total += numberOrZero(
      row.gleague_standard_spending
    );
  }

  if (state.includeE10) {
    total += numberOrZero(
      row.e10_spending
    );
  }

  if (state.includeTwoWay) {
    total += numberOrZero(
      row.two_way_spending
    );
  }

  return total;
}


function getSelectedMoneyFaced(row) {
  let total = 0;

  if (state.includeGLeague) {
    total += numberOrZero(
      row.gleague_standard_money_faced
    );
  }

  if (state.includeE10) {
    total += numberOrZero(
      row.e10_money_faced
    );
  }

  if (state.includeTwoWay) {
    total += numberOrZero(
      row.two_way_money_faced
    );
  }

  return total;
}


function getSelectedLabels() {
  const labels = [];

  if (state.includeGLeague) {
    labels.push(
      "G League Standard"
    );
  }

  if (state.includeE10) {
    labels.push(
      "Exhibit 10"
    );
  }

  if (state.includeTwoWay) {
    labels.push(
      "Two-Way"
    );
  }

  return labels;
}


function updateSelectedDefinition() {
  const element =
    document.getElementById(
      "selectedDefinition"
    );

  const labels =
    getSelectedLabels();

  element.textContent =
    labels.length > 0
      ? labels.join(" + ")
      : "No Dollar Contracts Selected";
}


// ============================================================
// PEDIGREE
// ============================================================
//
// Pedigree =
// E10 + Two-Way + NBA Standard
//
// ============================================================

function getPedigreeAvailable(row) {
  return (
    numberOrZero(
      row.e10_players_used
    )
    +
    numberOrZero(
      row.two_way_players_used
    )
    +
    numberOrZero(
      row.nba_standard_players_used
    )
  );
}


function getPedigreeFaced(row) {
  return (
    numberOrZero(
      row.opponent_e10_players_used
    )
    +
    numberOrZero(
      row.opponent_two_way_players_used
    )
    +
    numberOrZero(
      row.opponent_nba_standard_players_used
    )
  );
}


// ============================================================
// HEATMAP COLORS
// ============================================================

function interpolateRGB(
  start,
  end,
  amount
) {
  return {
    r: Math.round(
      start.r +
      (end.r - start.r) *
      amount
    ),

    g: Math.round(
      start.g +
      (end.g - start.g) *
      amount
    ),

    b: Math.round(
      start.b +
      (end.b - start.b) *
      amount
    ),
  };
}


function getValueColor(
  value,
  leagueAverage,
  minimum,
  maximum
) {
  if (maximum === minimum) {
    return {
      r: 75,
      g: 85,
      b: 99,
    };
  }

  const yellow = {
    r: 255,
    g: 230,
    b: 109,
  };

  const orange = {
    r: 245,
    g: 158,
    b: 11,
  };

  const red = {
    r: 220,
    g: 38,
    b: 38,
  };

  if (value <= leagueAverage) {
    const range =
      Math.max(
        leagueAverage - minimum,
        1
      );

    const amount =
      clamp(
        (
          value - minimum
        ) /
        range,
        0,
        1
      );

    return interpolateRGB(
      yellow,
      orange,
      amount
    );
  }

  const range =
    Math.max(
      maximum - leagueAverage,
      1
    );

  const amount =
    clamp(
      (
        value - leagueAverage
      ) /
      range,
      0,
      1
    );

  return interpolateRGB(
    orange,
    red,
    amount
  );
}


function rgbToCSS(rgb) {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}


function getReadableTextColor(rgb) {
  const brightness = (
    (
      rgb.r * 299
    )
    +
    (
      rgb.g * 587
    )
    +
    (
      rgb.b * 114
    )
  ) / 1000;

  return (
    brightness > 145
      ? "#111827"
      : "#ffffff"
  );
}


// ============================================================
// HEATMAP TOOLTIP
// ============================================================

function contractBreakdownRow({
  label,
  selected,
  spending,
  players,
  minutes,
}) {
  const playerCount =
    numberOrZero(players);

  return `
    <div class="tooltip-breakdown-row ${
      selected
        ? ""
        : "is-disabled"
    }">

      <div class="tooltip-contract-name">

        <span class="tooltip-selection-dot ${
          selected
            ? "is-selected"
            : ""
        }"></span>

        ${escapeHTML(label)}

      </div>

      <div class="tooltip-contract-value">
        ${formatCurrency(spending)}
      </div>

      <div class="tooltip-contract-usage">

        ${playerCount}
        player${
          playerCount === 1
            ? ""
            : "s"
        }

        ·

        ${formatMinutes(minutes)}

      </div>

    </div>
  `;
}


function showTooltip(
  event,
  row,
  leagueAverage
) {
  const tooltip =
    document.getElementById(
      "heatmapTooltip"
    );

  const selectedMoneyFaced =
    getSelectedMoneyFaced(row);

  const difference =
    selectedMoneyFaced -
    leagueAverage;

  const differenceText =
    difference >= 0
      ? `+${formatCurrency(
          difference
        )}`
      : `-${formatCurrency(
          Math.abs(difference)
        )}`;

  const opponentLocation =
    row.location === "HOME"
      ? `vs ${escapeHTML(
          row.opponent
        )}`
      : `@ ${escapeHTML(
          row.opponent
        )}`;

  const nbaPlayers =
    numberOrZero(
      row.opponent_nba_standard_players_used
    );

  const pedigreeFaced =
    getPedigreeFaced(row);

  tooltip.innerHTML = `

    <div class="tooltip-team">
      ${escapeHTML(row.team)}
    </div>

    <div class="tooltip-game-line">

      Game ${numberOrZero(
        row.game_number
      )}

      ·

      ${opponentLocation}

    </div>

    <div class="tooltip-game-line">

      ${formatDate(row.date)}

      ·

      <span class="tooltip-result ${
        row.result === "W"
          ? "win"
          : "loss"
      }">

        ${escapeHTML(row.result)}

        ${numberOrZero(
          row.team_score
        )}-${numberOrZero(
          row.opponent_score
        )}

      </span>

    </div>

    <div class="tooltip-main-value">

      <span>
        Selected Money Faced
      </span>

      <strong>
        ${formatCurrency(
          selectedMoneyFaced
        )}
      </strong>

    </div>

    <div class="tooltip-average-grid">

      <span>
        League average
      </span>

      <strong>
        ${formatCurrency(
          leagueAverage
        )}
      </strong>

      <span>
        Difference
      </span>

      <strong class="${
        difference >= 0
          ? "positive"
          : "negative"
      }">
        ${differenceText}
      </strong>

      <span>
        Pedigree faced
      </span>

      <strong>
        ${pedigreeFaced}
      </strong>

    </div>

    <div class="tooltip-divider"></div>

    <div class="tooltip-section-title">
      Opponent Contract Breakdown
    </div>

    ${
      contractBreakdownRow({
        label:
          "G League Standard",

        selected:
          state.includeGLeague,

        spending:
          row.gleague_standard_money_faced,

        players:
          row.opponent_gleague_standard_players_used,

        minutes:
          row.opponent_gleague_standard_minutes,
      })
    }

    ${
      contractBreakdownRow({
        label:
          "Exhibit 10",

        selected:
          state.includeE10,

        spending:
          row.e10_money_faced,

        players:
          row.opponent_e10_players_used,

        minutes:
          row.opponent_e10_minutes,
      })
    }

    ${
      contractBreakdownRow({
        label:
          "Two-Way",

        selected:
          state.includeTwoWay,

        spending:
          row.two_way_money_faced,

        players:
          row.opponent_two_way_players_used,

        minutes:
          row.opponent_two_way_minutes,
      })
    }

    <div class="tooltip-divider"></div>

    <div class="tooltip-nba-standard">

      <div>

        <strong>
          NBA Standard
        </strong>

        <span>
          Not included in dollar value
        </span>

      </div>

      <div class="tooltip-nba-usage">

        ${nbaPlayers}

        player${
          nbaPlayers === 1
            ? ""
            : "s"
        }

        ·

        ${
          formatMinutes(
            row.opponent_nba_standard_minutes
          )
        }

      </div>

    </div>
  `;

  tooltip.style.display =
    "block";

  moveTooltip(event);
}


function moveTooltip(event) {
  const tooltip =
    document.getElementById(
      "heatmapTooltip"
    );

  if (
    tooltip.style.display !==
    "block"
  ) {
    return;
  }

  const offset = 16;

  let x =
    event.clientX + offset;

  let y =
    event.clientY + offset;

  const rect =
    tooltip.getBoundingClientRect();

  if (
    x + rect.width >
    window.innerWidth - 8
  ) {
    x =
      event.clientX -
      rect.width -
      offset;
  }

  if (
    y + rect.height >
    window.innerHeight - 8
  ) {
    y =
      event.clientY -
      rect.height -
      offset;
  }

  tooltip.style.left =
    `${Math.max(8, x)}px`;

  tooltip.style.top =
    `${Math.max(8, y)}px`;
}


function hideTooltip() {
  document.getElementById(
    "heatmapTooltip"
  ).style.display =
    "none";
}


// ============================================================
// HEATMAP
// ============================================================

function renderHeatmap(rows) {
  const container =
    document.getElementById(
      "salaryHeatmap"
    );

  container.innerHTML = "";

  const teams =
    getTeams(rows);

  if (teams.length === 0) {
    return;
  }

  const values =
    rows.map(
      getSelectedMoneyFaced
    );

  const leagueAverage =
    average(values);

  const minValue =
    Math.min(...values);

  const maxValue =
    Math.max(...values);

  document.getElementById(
    "leagueAverage"
  ).textContent =
    formatCurrency(
      leagueAverage
    );

  const maxGameNumber =
    Math.max(
      ...rows.map(
        row =>
          numberOrZero(
            row.game_number
          )
      )
    );

  container.style.gridTemplateColumns =
    `92px repeat(${teams.length}, 106px)`;

  const corner =
    document.createElement(
      "div"
    );

  corner.className =
    "heatmap-corner";

  container.appendChild(
    corner
  );

  teams.forEach(team => {
    const header =
      document.createElement(
        "div"
      );

    header.className =
      "heatmap-team-header";

    header.textContent =
      team;

    container.appendChild(
      header
    );
  });

  const lookup =
    new Map();

  rows.forEach(row => {
    lookup.set(
      `${row.team}__${row.game_number}`,
      row
    );
  });

  for (
    let gameNumber = 1;
    gameNumber <= maxGameNumber;
    gameNumber++
  ) {
    const label =
      document.createElement(
        "div"
      );

    label.className =
      "heatmap-game-label";

    label.textContent =
      `Game ${gameNumber}`;

    container.appendChild(
      label
    );

    teams.forEach(team => {
      const row =
        lookup.get(
          `${team}__${gameNumber}`
        );

      if (!row) {
        const empty =
          document.createElement(
            "div"
          );

        empty.className =
          "salary-cell-empty";

        container.appendChild(
          empty
        );

        return;
      }

      const value =
        getSelectedMoneyFaced(
          row
        );

      const rgb =
        getValueColor(
          value,
          leagueAverage,
          minValue,
          maxValue
        );

      const cell =
        document.createElement(
          "div"
        );

      cell.className =
        "salary-cell";

      cell.textContent =
        formatCompactCurrency(
          value
        );

      cell.style.backgroundColor =
        rgbToCSS(rgb);

      cell.style.color =
        getReadableTextColor(rgb);

      cell.addEventListener(
        "mouseenter",
        event => {
          showTooltip(
            event,
            row,
            leagueAverage
          );
        }
      );

      cell.addEventListener(
        "mousemove",
        moveTooltip
      );

      cell.addEventListener(
        "mouseleave",
        hideTooltip
      );

      container.appendChild(
        cell
      );
    });
  }
}


// ============================================================
// FINANCIAL TEAM METRICS
// ============================================================

function buildTeamMetrics(rows) {
  const teams =
    getTeams(rows);

  const metrics =
    teams.map(team => {
      const teamRows =
        rows.filter(
          row =>
            row.team === team
        );

      const wins =
        teamRows.filter(
          row =>
            row.result === "W"
        );

      const losses =
        teamRows.filter(
          row =>
            row.result === "L"
        );

      const totalCoreRosterValue =
        teamRows.reduce(
          (sum, row) =>
            sum +
            getSelectedOwnSpending(
              row
            ),
          0
        );

      return {
        team,

        wins:
          wins.length,

        losses:
          losses.length,

        record:
          `${wins.length}-${losses.length}`,

        // Average Core Roster Value in games won
        game_spending_in_wins:
          average(
            wins.map(
              getSelectedOwnSpending
            )
          ),

        // Average Core Roster Value in games lost
        game_spending_in_losses:
          average(
            losses.map(
              getSelectedOwnSpending
            )
          ),

        // Cumulative game-level Core Roster Value
        // divided by season wins
        total_spending_per_season_win:
          wins.length > 0
            ? (
                totalCoreRosterValue /
                wins.length
              )
            : 0,

        // Average opponent Core Roster Value faced
        // per game
        average_money_faced:
          average(
            teamRows.map(
              getSelectedMoneyFaced
            )
          ),
      };
    });


  // Highest average Core Roster Value faced = Rank 1
  const ranked =
    [...metrics].sort(
      (a, b) =>
        (
          b.average_money_faced -
          a.average_money_faced
        )
        ||
        a.team.localeCompare(
          b.team
        )
    );


  ranked.forEach(
    (row, index) => {
      row.money_faced_rank =
        index + 1;
    }
  );


  return metrics;
}


function sortTeamMetrics(rows) {
  const direction =
    state.sortDirection === "asc"
      ? 1
      : -1;

  return [...rows].sort(
    (a, b) => {
      const aValue =
        a[state.sortKey];

      const bValue =
        b[state.sortKey];

      if (
        typeof aValue === "string"
        ||
        typeof bValue === "string"
      ) {
        return (
          String(aValue)
            .localeCompare(
              String(bValue)
            )
          *
          direction
        );
      }

      return (
        (
          numberOrZero(aValue)
          -
          numberOrZero(bValue)
        )
        *
        direction
      );
    }
  );
}


function renderTeamMetrics() {
  const tbody =
    document.getElementById(
      "teamMetricsBody"
    );

  tbody.innerHTML = "";


  sortTeamMetrics(
    currentTeamMetrics
  ).forEach(row => {
    const tr =
      document.createElement(
        "tr"
      );


    tr.innerHTML = `
      <td class="rank-cell">
        ${numberOrZero(
          row.money_faced_rank
        )}
      </td>

      <td class="team-cell">
        ${escapeHTML(
          row.team
        )}
      </td>

      <td>
        ${escapeHTML(
          row.record
        )}
      </td>

      <td>
        ${formatCurrency(
          row.game_spending_in_wins
        )}
      </td>

      <td>
        ${formatCurrency(
          row.game_spending_in_losses
        )}
      </td>

      <td>
        ${formatCurrency(
          row.total_spending_per_season_win
        )}
      </td>

      <td>
        ${formatCurrency(
          row.average_money_faced
        )}
      </td>
    `;


    tbody.appendChild(
      tr
    );
  });


  updateSortIndicators();
}


function updateSortIndicators() {
  document.querySelectorAll(
    ".sortable-header"
  ).forEach(header => {
    const indicator =
      header.querySelector(
        ".sort-indicator"
      );

    if (
      header.dataset.sortKey ===
      state.sortKey
    ) {
      indicator.textContent =
        state.sortDirection === "asc"
          ? "▲"
          : "▼";

      header.classList.add(
        "is-sorted"
      );
    } else {
      indicator.textContent = "";

      header.classList.remove(
        "is-sorted"
      );
    }
  });
}


function initializeSorting() {
  document.querySelectorAll(
    ".sortable-header"
  ).forEach(header => {
    header.addEventListener(
      "click",
      () => {
        const sortKey =
          header.dataset.sortKey;

        if (
          state.sortKey ===
          sortKey
        ) {
          state.sortDirection =
            state.sortDirection === "asc"
              ? "desc"
              : "asc";
        } else {
          state.sortKey =
            sortKey;

          state.sortDirection =
            sortKey === "team"
            ||
            sortKey ===
              "money_faced_rank"
              ? "asc"
              : "desc";
        }

        renderTeamMetrics();
      }
    );
  });
}


// ============================================================
// PEDIGREE TEAM METRICS
// ============================================================

function buildPedigreeMetrics(rows) {
  const teams =
    getTeams(rows);

  const metrics =
    teams.map(team => {
      const teamRows =
        rows.filter(
          row =>
            row.team === team
        );

      const wins =
        teamRows.filter(
          row =>
            row.result === "W"
        );

      const losses =
        teamRows.filter(
          row =>
            row.result === "L"
        );

      const pedigreeAvailableValues =
        teamRows.map(
          getPedigreeAvailable
        );

      const pedigreeFacedValues =
        teamRows.map(
          getPedigreeFaced
        );

      const pedigreeFacedInWinsValues =
        wins.map(
          getPedigreeFaced
        );

      const pedigreeFacedInLossesValues =
        losses.map(
          getPedigreeFaced
        );

      const nbaStandardGamesUsed =
        teamRows.filter(
          row =>
            numberOrZero(
              row.nba_standard_players_used
            ) > 0
        ).length;

      return {
        team,

        wins:
          wins.length,

        losses:
          losses.length,

        record:
          `${wins.length}-${losses.length}`,

        avg_pedigree_available:
          average(
            pedigreeAvailableValues
          ),

        pedigree_faced_in_wins:
          average(
            pedigreeFacedInWinsValues
          ),

        pedigree_faced_in_losses:
          average(
            pedigreeFacedInLossesValues
          ),

        avg_pedigree_faced:
          average(
            pedigreeFacedValues
          ),

        total_pedigree_faced:
          pedigreeFacedValues.reduce(
            (total, value) =>
              total + value,
            0
          ),

        avg_e10_available:
          average(
            teamRows.map(
              row =>
                numberOrZero(
                  row.e10_players_used
                )
            )
          ),

        avg_two_way_available:
          average(
            teamRows.map(
              row =>
                numberOrZero(
                  row.two_way_players_used
                )
            )
          ),

        avg_nba_standard_available:
          average(
            teamRows.map(
              row =>
                numberOrZero(
                  row.nba_standard_players_used
                )
            )
          ),

        avg_e10_faced:
          average(
            teamRows.map(
              row =>
                numberOrZero(
                  row.opponent_e10_players_used
                )
            )
          ),

        avg_two_way_faced:
          average(
            teamRows.map(
              row =>
                numberOrZero(
                  row.opponent_two_way_players_used
                )
            )
          ),

        avg_nba_standard_faced:
          average(
            teamRows.map(
              row =>
                numberOrZero(
                  row.opponent_nba_standard_players_used
                )
            )
          ),

        nba_standard_games_used:
          nbaStandardGamesUsed,
      };
    });

  const ranked =
    [...metrics].sort(
      (a, b) =>
        (
          b.avg_pedigree_faced -
          a.avg_pedigree_faced
        )
        ||
        a.team.localeCompare(
          b.team
        )
    );

  ranked.forEach(
    (row, index) => {
      row.pedigree_faced_rank =
        index + 1;
    }
  );

  return metrics;
}


// ============================================================
// PEDIGREE TABLE
// ============================================================

function sortPedigreeMetrics(rows) {
  const direction =
    pedigreeState.sortDirection ===
    "asc"
      ? 1
      : -1;

  return [...rows].sort(
    (a, b) => {
      const aValue =
        a[pedigreeState.sortKey];

      const bValue =
        b[pedigreeState.sortKey];

      if (
        typeof aValue === "string"
        ||
        typeof bValue === "string"
      ) {
        return (
          String(aValue)
            .localeCompare(
              String(bValue)
            )
          *
          direction
        );
      }

      return (
        (
          numberOrZero(aValue)
          -
          numberOrZero(bValue)
        )
        *
        direction
      );
    }
  );
}


function renderPedigreeMetrics() {
  const tbody =
    document.getElementById(
      "pedigreeMetricsBody"
    );

  tbody.innerHTML = "";

  sortPedigreeMetrics(
    currentPedigreeMetrics
  ).forEach(row => {
    const tr =
      document.createElement(
        "tr"
      );

    tr.innerHTML = `
      <td class="rank-cell">
        ${numberOrZero(
          row.pedigree_faced_rank
        )}
      </td>

      <td class="team-cell">
        ${escapeHTML(
          row.team
        )}
      </td>

      <td>
        ${escapeHTML(
          row.record
        )}
      </td>

      <td>
        ${numberOrZero(
          row.avg_pedigree_available
        ).toFixed(2)}
      </td>

      <td>
        ${numberOrZero(
          row.pedigree_faced_in_wins
        ).toFixed(2)}
      </td>

      <td>
        ${numberOrZero(
          row.pedigree_faced_in_losses
        ).toFixed(2)}
      </td>

      <td>
        ${numberOrZero(
          row.avg_pedigree_faced
        ).toFixed(2)}
      </td>

      <td>
        ${numberOrZero(
          row.total_pedigree_faced
        ).toFixed(0)}
      </td>

      <td>
        ${numberOrZero(
          row.nba_standard_games_used
        )}
      </td>
    `;

    tbody.appendChild(tr);
  });

  updatePedigreeSortIndicators();
}


function updatePedigreeSortIndicators() {
  document.querySelectorAll(
    ".pedigree-sortable-header"
  ).forEach(header => {
    const indicator =
      header.querySelector(
        ".pedigree-sort-indicator"
      );

    const sortKey =
      header.dataset
        .pedigreeSortKey;

    if (
      sortKey ===
      pedigreeState.sortKey
    ) {
      indicator.textContent =
        pedigreeState.sortDirection ===
        "asc"
          ? "▲"
          : "▼";

      header.classList.add(
        "is-sorted"
      );
    } else {
      indicator.textContent = "";

      header.classList.remove(
        "is-sorted"
      );
    }
  });
}


function initializePedigreeSorting() {
  document.querySelectorAll(
    ".pedigree-sortable-header"
  ).forEach(header => {
    header.addEventListener(
      "click",
      () => {
        const sortKey =
          header.dataset
            .pedigreeSortKey;

        if (
          pedigreeState.sortKey ===
          sortKey
        ) {
          pedigreeState.sortDirection =
            pedigreeState.sortDirection ===
            "asc"
              ? "desc"
              : "asc";
        } else {
          pedigreeState.sortKey =
            sortKey;

          pedigreeState.sortDirection =
            sortKey === "team"
            ||
            sortKey ===
              "pedigree_faced_rank"
              ? "asc"
              : "desc";
        }

        renderPedigreeMetrics();
      }
    );
  });
}


// ============================================================
// PEDIGREE SCATTER MATH
// ============================================================

function calculateCorrelation(
  rows,
  xKey,
  yKey
) {
  if (rows.length < 2) {
    return 0;
  }

  const xMean =
    average(
      rows.map(
        row =>
          numberOrZero(
            row[xKey]
          )
      )
    );

  const yMean =
    average(
      rows.map(
        row =>
          numberOrZero(
            row[yKey]
          )
      )
    );

  let numerator = 0;
  let xSquared = 0;
  let ySquared = 0;

  rows.forEach(row => {
    const xDifference =
      numberOrZero(
        row[xKey]
      ) - xMean;

    const yDifference =
      numberOrZero(
        row[yKey]
      ) - yMean;

    numerator +=
      xDifference *
      yDifference;

    xSquared +=
      xDifference *
      xDifference;

    ySquared +=
      yDifference *
      yDifference;
  });

  const denominator =
    Math.sqrt(
      xSquared *
      ySquared
    );

  if (denominator === 0) {
    return 0;
  }

  return numerator /
    denominator;
}


function calculateRegression(
  rows,
  xKey,
  yKey
) {
  const xMean =
    average(
      rows.map(
        row =>
          numberOrZero(
            row[xKey]
          )
      )
    );

  const yMean =
    average(
      rows.map(
        row =>
          numberOrZero(
            row[yKey]
          )
      )
    );

  let numerator = 0;
  let denominator = 0;

  rows.forEach(row => {
    const x =
      numberOrZero(
        row[xKey]
      );

    const y =
      numberOrZero(
        row[yKey]
      );

    numerator +=
      (x - xMean) *
      (y - yMean);

    denominator +=
      (x - xMean) *
      (x - xMean);
  });

  const slope =
    denominator === 0
      ? 0
      : numerator /
        denominator;

  const intercept =
    yMean -
    slope *
    xMean;

  return {
    slope,
    intercept,
  };
}


// ============================================================
// PEDIGREE SCATTER
// ============================================================

function renderPedigreeScatter() {
  const canvas =
    document.getElementById(
      "pedigreeScatterCanvas"
    );

  if (
    !canvas
    ||
    currentPedigreeMetrics.length ===
      0
  ) {
    return;
  }

  const container =
    canvas.parentElement;

  const cssWidth =
    Math.max(
      600,
      container.clientWidth
    );

  const cssHeight = 520;

  const pixelRatio =
    window.devicePixelRatio || 1;

  canvas.width =
    cssWidth * pixelRatio;

  canvas.height =
    cssHeight * pixelRatio;

  canvas.style.width =
    `${cssWidth}px`;

  canvas.style.height =
    `${cssHeight}px`;

  const ctx =
    canvas.getContext("2d");

  ctx.scale(
    pixelRatio,
    pixelRatio
  );

  const padding = {
    left: 74,
    right: 34,
    top: 30,
    bottom: 68,
  };

  const plotWidth =
    cssWidth -
    padding.left -
    padding.right;

  const plotHeight =
    cssHeight -
    padding.top -
    padding.bottom;

  const xValues =
    currentPedigreeMetrics.map(
      row =>
        numberOrZero(
          row[scatterState.xKey]
        )
    );

  const yValues =
    currentPedigreeMetrics.map(
      row =>
        numberOrZero(
          row[scatterState.yKey]
        )
    );

  let xMin =
    Math.min(...xValues);

  let xMax =
    Math.max(...xValues);

  let yMin =
    Math.min(...yValues);

  let yMax =
    Math.max(...yValues);

  const xRange =
    Math.max(
      xMax - xMin,
      0.5
    );

  const yRange =
    Math.max(
      yMax - yMin,
      5
    );

  xMin -=
    xRange * 0.08;

  xMax +=
    xRange * 0.08;

  yMin =
    Math.max(
      0,
      yMin -
      yRange * 0.08
    );

  yMax +=
    yRange * 0.08;

  const xToScreen = value =>
    padding.left +
    (
      (
        value - xMin
      ) /
      (
        xMax - xMin
      )
    ) *
    plotWidth;

  const yToScreen = value =>
    padding.top +
    plotHeight -
    (
      (
        value - yMin
      ) /
      (
        yMax - yMin
      )
    ) *
    plotHeight;

  ctx.clearRect(
    0,
    0,
    cssWidth,
    cssHeight
  );

  const styles =
    getComputedStyle(
      document.documentElement
    );

  const textColor =
    styles.getPropertyValue(
      "--muted-light"
    ).trim()
    || "#d1d5db";

  const mutedColor =
    styles.getPropertyValue(
      "--muted"
    ).trim()
    || "#9ca3af";

  const borderColor =
    styles.getPropertyValue(
      "--border"
    ).trim()
    || "#374151";

  const blue =
    styles.getPropertyValue(
      "--blue"
    ).trim()
    || "#2563eb";

  ctx.font =
    "12px Inter, Arial, sans-serif";

  ctx.textBaseline =
    "middle";


  // Grid + Y labels

  const yTicks = 5;

  for (
    let i = 0;
    i <= yTicks;
    i++
  ) {
    const value =
      yMin +
      (
        (
          yMax - yMin
        ) *
        i /
        yTicks
      );

    const y =
      yToScreen(value);

    ctx.beginPath();

    ctx.strokeStyle =
      borderColor;

    ctx.lineWidth = 1;

    ctx.moveTo(
      padding.left,
      y
    );

    ctx.lineTo(
      padding.left +
      plotWidth,
      y
    );

    ctx.stroke();

    ctx.fillStyle =
      mutedColor;

    ctx.textAlign =
      "right";

    ctx.fillText(
      value.toFixed(0),
      padding.left - 10,
      y
    );
  }


  // X labels

  const xTicks = 5;

  for (
    let i = 0;
    i <= xTicks;
    i++
  ) {
    const value =
      xMin +
      (
        (
          xMax - xMin
        ) *
        i /
        xTicks
      );

    const x =
      xToScreen(value);

    ctx.fillStyle =
      mutedColor;

    ctx.textAlign =
      "center";

    ctx.fillText(
      value.toFixed(2),
      x,
      padding.top +
      plotHeight +
      24
    );
  }


  // Axes

  ctx.beginPath();

  ctx.strokeStyle =
    textColor;

  ctx.lineWidth = 1.2;

  ctx.moveTo(
    padding.left,
    padding.top
  );

  ctx.lineTo(
    padding.left,
    padding.top +
    plotHeight
  );

  ctx.lineTo(
    padding.left +
    plotWidth,
    padding.top +
    plotHeight
  );

  ctx.stroke();


  // Regression line

  const regression =
    calculateRegression(
      currentPedigreeMetrics,
      scatterState.xKey,
      scatterState.yKey
    );

  const regressionStartY =
    regression.intercept +
    regression.slope *
    xMin;

  const regressionEndY =
    regression.intercept +
    regression.slope *
    xMax;

  ctx.beginPath();

  ctx.strokeStyle =
    textColor;

  ctx.lineWidth = 2;

  ctx.setLineDash(
    [7, 6]
  );

  ctx.moveTo(
    xToScreen(xMin),
    yToScreen(
      regressionStartY
    )
  );

  ctx.lineTo(
    xToScreen(xMax),
    yToScreen(
      regressionEndY
    )
  );

  ctx.stroke();

  ctx.setLineDash([]);


  // Team points

  scatterScreenPoints = [];

  currentPedigreeMetrics.forEach(
    row => {
      const xValue =
        numberOrZero(
          row[scatterState.xKey]
        );

      const yValue =
        numberOrZero(
          row[scatterState.yKey]
        );

      const x =
        xToScreen(xValue);

      const y =
        yToScreen(yValue);

      ctx.beginPath();

      ctx.fillStyle =
        blue;

      ctx.strokeStyle =
        "#ffffff";

      ctx.lineWidth = 1.5;

      ctx.arc(
        x,
        y,
        6,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.stroke();

      scatterScreenPoints.push({
        x,
        y,
        row,
      });
    }
  );


  // X axis title

  ctx.fillStyle =
    textColor;

  ctx.textAlign =
    "center";

  ctx.font =
    "13px Inter, Arial, sans-serif";

  ctx.fillText(
    scatterMetricLabels[
      scatterState.xKey
    ],
    padding.left +
    plotWidth / 2,
    cssHeight - 14
  );


  // Y axis title

  ctx.save();

  ctx.translate(
    18,
    padding.top +
    plotHeight / 2
  );

  ctx.rotate(
    -Math.PI / 2
  );

  ctx.textAlign =
    "center";

  ctx.fillText(
    scatterMetricLabels[
      scatterState.yKey
    ],
    0,
    0
  );

  ctx.restore();


  // Correlation

  const correlation =
    calculateCorrelation(
      currentPedigreeMetrics,
      scatterState.xKey,
      scatterState.yKey
    );

  document.getElementById(
    "pedigreeCorrelation"
  ).textContent =
    correlation.toFixed(3);

  document.getElementById(
    "pedigreeRSquared"
  ).textContent =
    (
      correlation *
      correlation
    ).toFixed(3);
}


function initializeScatterInteraction() {
  const canvas =
    document.getElementById(
      "pedigreeScatterCanvas"
    );

  const tooltip =
    document.getElementById(
      "scatterTooltip"
    );

  canvas.addEventListener(
    "mousemove",
    event => {
      const rect =
        canvas.getBoundingClientRect();

      const mouseX =
        event.clientX -
        rect.left;

      const mouseY =
        event.clientY -
        rect.top;

      let closest = null;
      let closestDistance =
        Infinity;

      scatterScreenPoints.forEach(
        point => {
          const distance =
            Math.hypot(
              point.x -
              mouseX,
              point.y -
              mouseY
            );

          if (
            distance <
            closestDistance
          ) {
            closestDistance =
              distance;

            closest =
              point;
          }
        }
      );

      if (
        !closest
        ||
        closestDistance > 12
      ) {
        tooltip.style.display =
          "none";

        canvas.style.cursor =
          "default";

        return;
      }

      canvas.style.cursor =
        "pointer";

      const row =
        closest.row;

      tooltip.innerHTML = `
        <strong>
          ${escapeHTML(
            row.team
          )}
        </strong>

        <span>
          ${escapeHTML(
            scatterMetricLabels[
              scatterState.xKey
            ]
          )}:
          ${numberOrZero(
            row[
              scatterState.xKey
            ]
          ).toFixed(2)}
        </span>

        <span>
          ${escapeHTML(
            scatterMetricLabels[
              scatterState.yKey
            ]
          )}:
          ${numberOrZero(
            row[
              scatterState.yKey
            ]
          ).toFixed(0)}
        </span>

        <span>
          Record:
          ${escapeHTML(
            row.record
          )}
        </span>

        <span>
          Avg Pedigree Available:
          ${numberOrZero(
            row.avg_pedigree_available
          ).toFixed(2)}
        </span>

        <span>
          Avg Pedigree Faced:
          ${numberOrZero(
            row.avg_pedigree_faced
          ).toFixed(2)}
        </span>
      `;

      tooltip.style.display =
        "block";

      let x =
        event.clientX + 14;

      let y =
        event.clientY + 14;

      const tooltipRect =
        tooltip.getBoundingClientRect();

      if (
        x +
        tooltipRect.width >
        window.innerWidth - 8
      ) {
        x =
          event.clientX -
          tooltipRect.width -
          14;
      }

      if (
        y +
        tooltipRect.height >
        window.innerHeight - 8
      ) {
        y =
          event.clientY -
          tooltipRect.height -
          14;
      }

      tooltip.style.left =
        `${Math.max(8, x)}px`;

      tooltip.style.top =
        `${Math.max(8, y)}px`;
    }
  );

  canvas.addEventListener(
    "mouseleave",
    () => {
      tooltip.style.display =
        "none";

      canvas.style.cursor =
        "default";
    }
  );
}


function initializeScatterControls() {
  const xSelect =
    document.getElementById(
      "pedigreeScatterX"
    );

  const ySelect =
    document.getElementById(
      "pedigreeScatterY"
    );

  xSelect.addEventListener(
    "change",
    () => {
      scatterState.xKey =
        xSelect.value;

      renderPedigreeScatter();
    }
  );

  ySelect.addEventListener(
    "change",
    () => {
      scatterState.yKey =
        ySelect.value;

      renderPedigreeScatter();
    }
  );

  window.addEventListener(
    "resize",
    () => {
      renderPedigreeScatter();
    }
  );
}


// ============================================================
// PEDIGREE CSV DOWNLOAD
// ============================================================

function escapeCSV(value) {
  const text =
    String(value ?? "");

  if (
    text.includes(",")
    ||
    text.includes('"')
    ||
    text.includes("\n")
  ) {
    return `"${text.replaceAll(
      '"',
      '""'
    )}"`;
  }

  return text;
}


function downloadPedigreeSummary() {
  const headers = [
    "team",
    "wins",
    "losses",
    "record",
    "avg_pedigree_available_per_game",
    "pedigree_contracts_faced_in_wins",
    "pedigree_contracts_faced_in_losses",
    "avg_pedigree_faced_per_game",
    "total_pedigree_faced",
    "pedigree_faced_rank",
    "avg_e10_available_per_game",
    "avg_two_way_available_per_game",
    "avg_nba_standard_available_per_game",
    "avg_e10_faced_per_game",
    "avg_two_way_faced_per_game",
    "avg_nba_standard_faced_per_game",
    "nba_standard_games_used",
  ];

  const csvRows = [
    headers,
  ];

  currentPedigreeMetrics.forEach(
    row => {
      csvRows.push([
        row.team,
        row.wins,
        row.losses,
        row.record,

        numberOrZero(
          row.avg_pedigree_available
        ).toFixed(4),

        numberOrZero(
          row.pedigree_faced_in_wins
        ).toFixed(4),

        numberOrZero(
          row.pedigree_faced_in_losses
        ).toFixed(4),

        numberOrZero(
          row.avg_pedigree_faced
        ).toFixed(4),

        numberOrZero(
          row.total_pedigree_faced
        ).toFixed(0),

        numberOrZero(
          row.pedigree_faced_rank
        ),

        numberOrZero(
          row.avg_e10_available
        ).toFixed(4),

        numberOrZero(
          row.avg_two_way_available
        ).toFixed(4),

        numberOrZero(
          row.avg_nba_standard_available
        ).toFixed(4),

        numberOrZero(
          row.avg_e10_faced
        ).toFixed(4),

        numberOrZero(
          row.avg_two_way_faced
        ).toFixed(4),

        numberOrZero(
          row.avg_nba_standard_faced
        ).toFixed(4),

        numberOrZero(
          row.nba_standard_games_used
        ),
      ]);
    }
  );

  const csv =
    csvRows
      .map(
        row =>
          row
            .map(escapeCSV)
            .join(",")
      )
      .join("\n");

  const blob =
    new Blob(
      [
        "\uFEFF",
        csv,
      ],
      {
        type:
          "text/csv;charset=utf-8;",
      }
    );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    "gleague_pedigree_summary_2025_26.csv";

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}


// ============================================================
// RENDER
// ============================================================

function renderDashboard() {
  updateSelectedDefinition();

  renderHeatmap(
    salaryRows
  );

  currentTeamMetrics =
    buildTeamMetrics(
      salaryRows
    );

  renderTeamMetrics();

  currentPedigreeMetrics =
    buildPedigreeMetrics(
      salaryRows
    );

  renderPedigreeMetrics();

  //renderPedigreeScatter();
}


// ============================================================
// TOGGLES
// ============================================================

function initializeToggles() {
  const gLeagueToggle =
    document.getElementById(
      "toggleGLeague"
    );

  const e10Toggle =
    document.getElementById(
      "toggleE10"
    );

  const twoWayToggle =
    document.getElementById(
      "toggleTwoWay"
    );

  function syncState() {
    state.includeGLeague =
      gLeagueToggle.checked;

    state.includeE10 =
      e10Toggle.checked;

    state.includeTwoWay =
      twoWayToggle.checked;

    hideTooltip();

    renderDashboard();
  }

  gLeagueToggle.addEventListener(
    "change",
    syncState
  );

  e10Toggle.addEventListener(
    "change",
    syncState
  );

  twoWayToggle.addEventListener(
    "change",
    syncState
  );
}


// ============================================================
// STARTUP
// ============================================================

async function initializeDashboard() {
  const errorElement =
    document.getElementById(
      "dataError"
    );

  try {
    salaryRows =
      await loadCSV(
        SALARY_DATA_URL
      );

    salaryRows =
      salaryRows.filter(
        row =>
          row.team
          &&
          row.game_number
      );

    if (
      salaryRows.length === 0
    ) {
      throw new Error(
        "Salary data loaded, but no team-game rows were found."
      );
    }

    initializeToggles();

    initializeSorting();

    initializePedigreeSorting();

    //initializeScatterControls();

    //initializeScatterInteraction();

    const downloadPedigreeBtn =
      document.getElementById(
        "downloadPedigreeBtn"
      );

    downloadPedigreeBtn.addEventListener(
      "click",
      downloadPedigreeSummary
    );

    renderDashboard();

  } catch (error) {
    console.error(error);

    errorElement.hidden =
      false;

    errorElement.textContent =
      "Could not load salary data. Check that " +
      "docs/salary/data/game_salary_components_2025_26.csv " +
      "exists and that the page is being served through " +
      "GitHub Pages or a local web server.";
  }
}


document.addEventListener(
  "DOMContentLoaded",
  initializeDashboard
);
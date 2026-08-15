const SALARY_DATA_URL = "./data/game_salary_components_2025_26.csv";

let salaryRows = [];
let currentTeamMetrics = [];

const state = {
  includeGLeague: false,
  includeE10: true,
  includeTwoWay: true,
  sortKey: "money_faced_rank",
  sortDirection: "asc",
};


// ============================================================
// DATA LOADING
// ============================================================

function loadCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,

      complete: results => {
        const seriousErrors = (results.errors || []).filter(
          error => error.code !== "TooFewFields"
        );

        if (seriousErrors.length > 0) {
          reject(new Error(seriousErrors[0].message));
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

  return values.reduce(
    (sum, value) => sum + value,
    0
  ) / values.length;
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
  const number = numberOrZero(value);
  const absolute = Math.abs(number);

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

  const date = new Date(
    `${value}T12:00:00`
  );

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
// SELECTED CONTRACT VALUES
// ============================================================

function getSelectedOwnSpending(
  row
) {
  let total = 0;

  if (
    state.includeGLeague
  ) {
    total += numberOrZero(
      row.gleague_standard_spending
    );
  }

  if (
    state.includeE10
  ) {
    total += numberOrZero(
      row.e10_spending
    );
  }

  if (
    state.includeTwoWay
  ) {
    total += numberOrZero(
      row.two_way_spending
    );
  }

  return total;
}


function getSelectedMoneyFaced(
  row
) {
  let total = 0;

  if (
    state.includeGLeague
  ) {
    total += numberOrZero(
      row.gleague_standard_money_faced
    );
  }

  if (
    state.includeE10
  ) {
    total += numberOrZero(
      row.e10_money_faced
    );
  }

  if (
    state.includeTwoWay
  ) {
    total += numberOrZero(
      row.two_way_money_faced
    );
  }

  return total;
}


function getSelectedLabels() {
  const labels = [];

  if (
    state.includeGLeague
  ) {
    labels.push(
      "G League Standard"
    );
  }

  if (
    state.includeE10
  ) {
    labels.push(
      "Exhibit 10"
    );
  }

  if (
    state.includeTwoWay
  ) {
    labels.push(
      "Two-Way"
    );
  }

  return labels;
}


function updateSelectedDefinition() {
  const labels = (
    getSelectedLabels()
  );

  const element = (
    document.getElementById(
      "selectedDefinition"
    )
  );

  element.textContent = (
    labels.length
      ? labels.join(
          " + "
        )
      : "No Dollar Contracts Selected"
  );
}


// ============================================================
// COLOR SCALE
// ============================================================

function interpolateRGB(
  start,
  end,
  amount
) {
  return {
    r: Math.round(
      start.r +
      (
        end.r - start.r
      ) * amount
    ),

    g: Math.round(
      start.g +
      (
        end.g - start.g
      ) * amount
    ),

    b: Math.round(
      start.b +
      (
        end.b - start.b
      ) * amount
    ),
  };
}


function getValueColor(
  value,
  leagueAverage,
  minimum,
  maximum
) {
  if (
    maximum === minimum
  ) {
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

  if (
    value <= leagueAverage
  ) {
    const range = Math.max(
      leagueAverage - minimum,
      1
    );

    const amount = clamp(
      (
        value - minimum
      ) / range,
      0,
      1
    );

    return interpolateRGB(
      yellow,
      orange,
      amount
    );
  }

  const range = Math.max(
    maximum - leagueAverage,
    1
  );

  const amount = clamp(
    (
      value - leagueAverage
    ) / range,
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
  return `rgb(${
    rgb.r
  }, ${
    rgb.g
  }, ${
    rgb.b
  })`;
}


function getReadableTextColor(
  rgb
) {
  const brightness = (
    (
      rgb.r * 299
    ) +
    (
      rgb.g * 587
    ) +
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
// TEAM HELPERS
// ============================================================

function getTeams(rows) {
  return [
    ...new Set(
      rows
        .map(
          row => row.team
        )
        .filter(Boolean)
    ),
  ].sort(
    (
      a,
      b
    ) => (
      a.localeCompare(b)
    )
  );
}


// ============================================================
// TOOLTIP
// ============================================================

function contractBreakdownRow({
  label,
  selected,
  spending,
  players,
  minutes,
}) {
  const playerCount = (
    numberOrZero(players)
  );

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
        ${formatCurrency(
          spending
        )}
      </div>

      <div class="tooltip-contract-usage">
        ${playerCount}
        player${
          playerCount === 1
            ? ""
            : "s"
        }
        ·
        ${formatMinutes(
          minutes
        )}
      </div>

    </div>
  `;
}


function showTooltip(
  event,
  row,
  leagueAverage
) {
  const tooltip = (
    document.getElementById(
      "heatmapTooltip"
    )
  );

  const selectedMoneyFaced = (
    getSelectedMoneyFaced(
      row
    )
  );

  const difference = (
    selectedMoneyFaced -
    leagueAverage
  );

  const differenceText = (
    difference >= 0
      ? `+${
          formatCurrency(
            difference
          )
        }`
      : `-${
          formatCurrency(
            Math.abs(
              difference
            )
          )
        }`
  );

  const opponentLocation = (
    row.location === "HOME"
      ? `vs ${
          escapeHTML(
            row.opponent
          )
        }`
      : `@ ${
          escapeHTML(
            row.opponent
          )
        }`
  );

  const nbaPlayers = (
    numberOrZero(
      row.opponent_nba_standard_players_used
    )
  );

  tooltip.innerHTML = `
    <div class="tooltip-team">
      ${escapeHTML(
        row.team
      )}
    </div>

    <div class="tooltip-game-line">
      Game ${
        numberOrZero(
          row.game_number
        )
      }
      ·
      ${opponentLocation}
    </div>

    <div class="tooltip-game-line">
      ${
        formatDate(
          row.date
        )
      }
      ·

      <span class="tooltip-result ${
        row.result === "W"
          ? "win"
          : "loss"
      }">

        ${
          escapeHTML(
            row.result
          )
        }
        ${
          numberOrZero(
            row.team_score
          )
        }-${
          numberOrZero(
            row.opponent_score
          )
        }

      </span>
    </div>

    <div class="tooltip-main-value">
      <span>
        Selected Money Faced
      </span>

      <strong>
        ${
          formatCurrency(
            selectedMoneyFaced
          )
        }
      </strong>
    </div>

    <div class="tooltip-average-grid">

      <span>
        League average
      </span>

      <strong>
        ${
          formatCurrency(
            leagueAverage
          )
        }
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

    </div>

    <div class="tooltip-divider">
    </div>

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

    <div class="tooltip-divider">
    </div>

    <div class="tooltip-nba-standard">

      <div>
        <strong>
          NBA Standard Assignment
        </strong>

        <span>
          Excluded from dollar value
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

  tooltip.style.display = (
    "block"
  );

  moveTooltip(event);
}


function moveTooltip(event) {
  const tooltip = (
    document.getElementById(
      "heatmapTooltip"
    )
  );

  if (
    tooltip.style.display
    !== "block"
  ) {
    return;
  }

  const offset = 16;

  let x = (
    event.clientX +
    offset
  );

  let y = (
    event.clientY +
    offset
  );

  const rect = (
    tooltip
      .getBoundingClientRect()
  );

  if (
    x + rect.width >
    window.innerWidth - 8
  ) {
    x = (
      event.clientX -
      rect.width -
      offset
    );
  }

  if (
    y + rect.height >
    window.innerHeight - 8
  ) {
    y = (
      event.clientY -
      rect.height -
      offset
    );
  }

  tooltip.style.left = `${
    Math.max(
      8,
      x
    )
  }px`;

  tooltip.style.top = `${
    Math.max(
      8,
      y
    )
  }px`;
}


function hideTooltip() {
  document.getElementById(
    "heatmapTooltip"
  ).style.display = (
    "none"
  );
}


// ============================================================
// HEATMAP
// ============================================================

function renderHeatmap(rows) {
  const container = (
    document.getElementById(
      "salaryHeatmap"
    )
  );

  container.innerHTML = "";

  const teams = (
    getTeams(rows)
  );

  if (
    teams.length === 0
  ) {
    return;
  }

  const values = (
    rows.map(
      getSelectedMoneyFaced
    )
  );

  const leagueAverage = (
    average(values)
  );

  const minValue = (
    Math.min(
      ...values
    )
  );

  const maxValue = (
    Math.max(
      ...values
    )
  );

  document.getElementById(
    "leagueAverage"
  ).textContent = (
    formatCurrency(
      leagueAverage
    )
  );

  const maxGameNumber = (
    Math.max(
      ...rows.map(
        row => (
          numberOrZero(
            row.game_number
          )
        )
      )
    )
  );

  container.style.gridTemplateColumns =
    `92px repeat(${
      teams.length
    }, 106px)`;

  const corner = (
    document.createElement(
      "div"
    )
  );

  corner.className = (
    "heatmap-corner"
  );

  container.appendChild(
    corner
  );

  teams.forEach(team => {
    const header = (
      document.createElement(
        "div"
      )
    );

    header.className = (
      "heatmap-team-header"
    );

    header.textContent = (
      team
    );

    container.appendChild(
      header
    );
  });

  const lookup = (
    new Map()
  );

  rows.forEach(row => {
    lookup.set(
      `${
        row.team
      }__${
        row.game_number
      }`,
      row
    );
  });

  for (
    let gameNumber = 1;
    gameNumber <= maxGameNumber;
    gameNumber++
  ) {
    const label = (
      document.createElement(
        "div"
      )
    );

    label.className = (
      "heatmap-game-label"
    );

    label.textContent = (
      `Game ${
        gameNumber
      }`
    );

    container.appendChild(
      label
    );

    teams.forEach(team => {
      const row = lookup.get(
        `${
          team
        }__${
          gameNumber
        }`
      );

      if (!row) {
        const empty = (
          document.createElement(
            "div"
          )
        );

        empty.className = (
          "salary-cell-empty"
        );

        container.appendChild(
          empty
        );

        return;
      }

      const value = (
        getSelectedMoneyFaced(
          row
        )
      );

      const rgb = (
        getValueColor(
          value,
          leagueAverage,
          minValue,
          maxValue
        )
      );

      const cell = (
        document.createElement(
          "div"
        )
      );

      cell.className = (
        "salary-cell"
      );

      cell.textContent = (
        formatCompactCurrency(
          value
        )
      );

      cell.style.backgroundColor = (
        rgbToCSS(
          rgb
        )
      );

      cell.style.color = (
        getReadableTextColor(
          rgb
        )
      );

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
// TEAM METRICS
// ============================================================

function buildTeamMetrics(rows) {
  const teams = (
    getTeams(rows)
  );

  const metrics = (
    teams.map(team => {
      const teamRows = (
        rows.filter(
          row => (
            row.team === team
          )
        )
      );

      const wins = (
        teamRows.filter(
          row => (
            row.result === "W"
          )
        )
      );

      const losses = (
        teamRows.filter(
          row => (
            row.result === "L"
          )
        )
      );

      const totalOwnSpending = (
        teamRows.reduce(
          (
            sum,
            row
          ) => (
            sum +
            getSelectedOwnSpending(
              row
            )
          ),
          0
        )
      );

      const totalMoneyFaced = (
        teamRows.reduce(
          (
            sum,
            row
          ) => (
            sum +
            getSelectedMoneyFaced(
              row
            )
          ),
          0
        )
      );

      return {
        team,

        wins:
          wins.length,

        losses:
          losses.length,

        record:
          `${
            wins.length
          }-${
            losses.length
          }`,

        game_spending_in_wins:
          average(
            wins.map(
              getSelectedOwnSpending
            )
          ),

        game_spending_in_losses:
          average(
            losses.map(
              getSelectedOwnSpending
            )
          ),

        total_spending_per_season_win:
          wins.length > 0
            ? (
                totalOwnSpending /
                wins.length
              )
            : 0,

        average_money_faced:
          average(
            teamRows.map(
              getSelectedMoneyFaced
            )
          ),

        total_money_faced:
          totalMoneyFaced,
      };
    })
  );

  const ranked = (
    [...metrics].sort(
      (
        a,
        b
      ) => (
        (
          b.average_money_faced -
          a.average_money_faced
        )
        ||
        a.team.localeCompare(
          b.team
        )
      )
    )
  );

  ranked.forEach(
    (
      row,
      index
    ) => {
      row.money_faced_rank = (
        index + 1
      );
    }
  );

  return metrics;
}


function sortTeamMetrics(rows) {
  const direction = (
    state.sortDirection === "asc"
      ? 1
      : -1
  );

  return [...rows].sort(
    (
      a,
      b
    ) => {
      const aValue = (
        a[
          state.sortKey
        ]
      );

      const bValue = (
        b[
          state.sortKey
        ]
      );

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
          numberOrZero(
            aValue
          )
          -
          numberOrZero(
            bValue
          )
        )
        *
        direction
      );
    }
  );
}


function renderTeamMetrics() {
  const tbody = (
    document.getElementById(
      "teamMetricsBody"
    )
  );

  tbody.innerHTML = "";

  sortTeamMetrics(
    currentTeamMetrics
  ).forEach(row => {
    const tr = (
      document.createElement(
        "tr"
      )
    );

    tr.innerHTML = `
      <td class="rank-cell">
        ${
          numberOrZero(
            row.money_faced_rank
          )
        }
      </td>

      <td class="team-cell">
        ${
          escapeHTML(
            row.team
          )
        }
      </td>

      <td>
        ${
          escapeHTML(
            row.record
          )
        }
      </td>

      <td>
        ${
          formatCurrency(
            row.game_spending_in_wins
          )
        }
      </td>

      <td>
        ${
          formatCurrency(
            row.game_spending_in_losses
          )
        }
      </td>

      <td>
        ${
          formatCurrency(
            row.total_spending_per_season_win
          )
        }
      </td>

      <td>
        ${
          formatCurrency(
            row.average_money_faced
          )
        }
      </td>

      <td>
        ${
          formatCurrency(
            row.total_money_faced
          )
        }
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
    const indicator = (
      header.querySelector(
        ".sort-indicator"
      )
    );

    if (
      header.dataset.sortKey
      === state.sortKey
    ) {
      indicator.textContent = (
        state.sortDirection === "asc"
          ? "▲"
          : "▼"
      );

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
        const sortKey = (
          header.dataset.sortKey
        );

        if (
          state.sortKey === sortKey
        ) {
          state.sortDirection = (
            state.sortDirection === "asc"
              ? "desc"
              : "asc"
          );
        } else {
          state.sortKey = (
            sortKey
          );

          state.sortDirection = (
            sortKey === "team"
            ||
            sortKey === "money_faced_rank"
              ? "asc"
              : "desc"
          );
        }

        renderTeamMetrics();
      }
    );
  });
}


// ============================================================
// RENDER
// ============================================================

function renderDashboard() {
  updateSelectedDefinition();

  renderHeatmap(
    salaryRows
  );

  currentTeamMetrics = (
    buildTeamMetrics(
      salaryRows
    )
  );

  renderTeamMetrics();
}


// ============================================================
// TOGGLES
// ============================================================

function initializeToggles() {
  const gLeagueToggle = (
    document.getElementById(
      "toggleGLeague"
    )
  );

  const e10Toggle = (
    document.getElementById(
      "toggleE10"
    )
  );

  const twoWayToggle = (
    document.getElementById(
      "toggleTwoWay"
    )
  );

  function syncState() {
    state.includeGLeague = (
      gLeagueToggle.checked
    );

    state.includeE10 = (
      e10Toggle.checked
    );

    state.includeTwoWay = (
      twoWayToggle.checked
    );

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
  const errorElement = (
    document.getElementById(
      "dataError"
    )
  );

  try {
    salaryRows = await loadCSV(
      SALARY_DATA_URL
    );

    salaryRows = (
      salaryRows.filter(
        row => (
          row.team
          &&
          row.game_number
        )
      )
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

    renderDashboard();

  } catch (error) {
    console.error(
      error
    );

    errorElement.hidden = false;

    errorElement.textContent =
      "Could not load salary data. Check that " +
      "docs/salary/data/game_salary_components_2025_26.csv exists " +
      "and that the page is being served through GitHub Pages " +
      "or a local web server.";
  }
}


document.addEventListener(
  "DOMContentLoaded",
  initializeDashboard
);
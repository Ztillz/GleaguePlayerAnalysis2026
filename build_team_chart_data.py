from __future__ import annotations

import json
import math
import time
from pathlib import Path
from typing import Any, Callable

import pandas as pd
from nba_api.stats.endpoints import (
    boxscoremiscv3,
    boxscoretraditionalv3,
    scheduleleaguev2,
)


# ============================================================
# CONFIG
# ============================================================

SEASON = "2025-26"

# NBA G League
LEAGUE_ID = "20"

# We already established that the 50-game base schedule ends here.
BASE_SCHEDULE_END_DATE = pd.Timestamp("2026-03-28")


# Winter Showcase Championship.
# This was not part of the 775-game base schedule.
EXCLUDED_GAME_IDS = {
    "2062500001",
}


# Next Up / All-Star tournament teams.
EXCLUDED_TEAM_NAMES = {
    "Team Black",
    "Team Blue",
    "Team Red",
    "Team White",
}


EXPECTED_GAMES = 775
EXPECTED_TEAMS = 31
EXPECTED_GAMES_PER_TEAM = 50
EXPECTED_ROWS = 1550


# NBA Stats can occasionally timeout.
TIMEOUT = 60

# Small delay between successful requests so we do not hammer the API.
REQUEST_DELAY = 0.65

MAX_RETRIES = 4


# ============================================================
# PATHS
# ============================================================

ROOT = Path(__file__).resolve().parent


CACHE = (
    ROOT
    / "cache"
    / "team_charts_2025_26"
)


SCHEDULE_CACHE = (
    CACHE
    / "schedule_2025_26.csv"
)


TRAD_CACHE = (
    CACHE
    / "traditional"
)


MISC_CACHE = (
    CACHE
    / "misc"
)


OUTPUT = (
    ROOT
    / "docs"
    / "data"
    / "team_charting_metrics_2025_26.csv"
)


# Optional cross-check against the salary dataset
# already in this repo.
SALARY_FILE = (
    ROOT
    / "docs"
    / "salary"
    / "data"
    / "game_salary_components_2025_26.csv"
)


# ============================================================
# BASIC HELPERS
# ============================================================

def text(value: Any) -> str:

    if value is None:
        return ""

    try:

        if pd.isna(value):
            return ""

    except TypeError:

        pass

    return str(value).strip()


def norm_id(
    value: Any,
    width: int | None = None,
) -> str:

    value = text(value)

    if value.endswith(".0"):
        value = value[:-2]

    if value and width:
        value = value.zfill(width)

    return value


def team_name(
    city: Any,
    name: Any,
) -> str:

    city = text(city)
    name = text(name)

    if not city:
        return name

    if not name:
        return city

    # Prevent:
    # "Austin Austin Spurs"
    if name.casefold().startswith(
        city.casefold()
    ):
        return name

    return f"{city} {name}"


def num(value: Any) -> float:

    try:

        value = float(value)

    except (
        TypeError,
        ValueError,
    ):

        return math.nan

    if not math.isfinite(value):
        return math.nan

    return value


def pct(
    made: Any,
    attempted: Any,
) -> float:

    made = num(made)
    attempted = num(attempted)

    if (
        math.isnan(made)
        or
        math.isnan(attempted)
    ):
        return math.nan

    if attempted == 0:
        return 0.0

    return round(
        (
            made
            /
            attempted
        )
        *
        100,
        2,
    )


def records(
    df: pd.DataFrame,
) -> list[dict[str, Any]]:

    return (
        df
        .where(
            pd.notna(df),
            None,
        )
        .to_dict(
            orient="records"
        )
    )


# ============================================================
# API RETRY
# ============================================================

def api_call(
    label: str,
    fn: Callable[[], Any],
) -> Any:

    last_error = None

    for attempt in range(
        1,
        MAX_RETRIES + 1,
    ):

        try:

            result = fn()

            time.sleep(
                REQUEST_DELAY
            )

            return result

        except Exception as exc:

            last_error = exc

            if attempt == MAX_RETRIES:
                break

            wait = 3 * attempt

            print(
                f"    {label} failed "
                f"({attempt}/{MAX_RETRIES}): "
                f"{exc}"
            )

            print(
                f"    Retrying in {wait}s..."
            )

            time.sleep(wait)

    raise RuntimeError(
        f"{label} failed after "
        f"{MAX_RETRIES} attempts"
    ) from last_error


# ============================================================
# JSON CACHE
# ============================================================

def load_json(
    path: Path,
) -> dict[str, Any]:

    with path.open(
        "r",
        encoding="utf-8",
    ) as f:

        return json.load(f)


def save_json(
    path: Path,
    payload: dict[str, Any],
) -> None:

    temp = (
        path.with_suffix(
            ".tmp"
        )
    )

    with temp.open(
        "w",
        encoding="utf-8",
    ) as f:

        json.dump(
            payload,
            f,
            ensure_ascii=False,
            indent=2,
            default=str,
        )

    temp.replace(path)


# ============================================================
# SCHEDULE
# ============================================================

def load_schedule() -> pd.DataFrame:

    if SCHEDULE_CACHE.exists():

        print(
            "Loading cached schedule: "
            f"{SCHEDULE_CACHE}"
        )

        df = pd.read_csv(
            SCHEDULE_CACHE,
            dtype={
                "gameId": str
            },
        )

    else:

        print(
            "Downloading G League schedule..."
        )

        response = api_call(
            "ScheduleLeagueV2",
            lambda:
                scheduleleaguev2
                .ScheduleLeagueV2(
                    league_id=LEAGUE_ID,
                    season=SEASON,
                    timeout=TIMEOUT,
                ),
        )

        df = (
            response
            .season_games
            .get_data_frame()
        )

        df.to_csv(
            SCHEDULE_CACHE,
            index=False,
        )

    df = df.copy()


    df["gameId"] = (
        df["gameId"]
        .map(
            lambda x:
                norm_id(
                    x,
                    10,
                )
        )
    )


    df["game_date"] = (

        pd.to_datetime(
            df["gameDate"],
            errors="coerce",
            utc=True,
        )

        .dt
        .tz_convert(None)

        .dt
        .normalize()
    )


    df["home_team"] = (
        df.apply(
            lambda r:
                team_name(
                    r.get(
                        "homeTeam_teamCity"
                    ),
                    r.get(
                        "homeTeam_teamName"
                    ),
                ),
            axis=1,
        )
    )


    df["away_team"] = (
        df.apply(
            lambda r:
                team_name(
                    r.get(
                        "awayTeam_teamCity"
                    ),
                    r.get(
                        "awayTeam_teamName"
                    ),
                ),
            axis=1,
        )
    )


    df["home_team_id"] = (
        df[
            "homeTeam_teamId"
        ]
        .map(
            norm_id
        )
    )


    df["away_team_id"] = (
        df[
            "awayTeam_teamId"
        ]
        .map(
            norm_id
        )
    )


    return df


# ============================================================
# BASE-SCHEDULE FILTER
# ============================================================

def filter_schedule(
    df: pd.DataFrame,
) -> pd.DataFrame:

    status = pd.to_numeric(
        df["gameStatus"],
        errors="coerce",
    )


    # Completed games only.
    df = (
        df.loc[
            status == 3
        ]
        .drop_duplicates(
            "gameId",
            keep="last",
        )
        .copy()
    )


    # Remove postseason.
    df = df.loc[
        df["game_date"]
        <=
        BASE_SCHEDULE_END_DATE
    ]


    # Remove Winter Showcase Championship.
    df = df.loc[
        ~df["gameId"]
        .isin(
            EXCLUDED_GAME_IDS
        )
    ]


    # Remove Next Up / All-Star games.
    df = df.loc[

        ~df["home_team"]
        .isin(
            EXCLUDED_TEAM_NAMES
        )

        &

        ~df["away_team"]
        .isin(
            EXCLUDED_TEAM_NAMES
        )
    ]


    return (
        df
        .sort_values(
            [
                "game_date",
                "gameId",
            ]
        )
        .reset_index(
            drop=True
        )
    )


# ============================================================
# SCHEDULE AUDIT
# ============================================================

def audit_schedule(
    df: pd.DataFrame,
) -> None:

    teams = sorted(

        set(
            df["home_team"]
        )

        |

        set(
            df["away_team"]
        )
    )


    counts = {

        team:

            int(

                (
                    df[
                        "home_team"
                    ]
                    ==
                    team
                ).sum()

                +

                (
                    df[
                        "away_team"
                    ]
                    ==
                    team
                ).sum()

            )

        for team in teams
    }


    print()
    print("Schedule audit")
    print("--------------")


    print(
        "Games:",
        df[
            "gameId"
        ].nunique(),
    )


    print(
        "Teams:",
        len(teams),
    )


    print(
        "Games/team:",
        min(
            counts.values()
        ),
        "-",
        max(
            counts.values()
        ),
    )


    if (
        df[
            "gameId"
        ].nunique()
        !=
        EXPECTED_GAMES
    ):

        raise ValueError(
            f"Expected "
            f"{EXPECTED_GAMES} "
            f"games"
        )


    if (
        len(teams)
        !=
        EXPECTED_TEAMS
    ):

        raise ValueError(
            f"Expected "
            f"{EXPECTED_TEAMS} "
            f"teams"
        )


    bad = {

        team:
            count

        for (
            team,
            count,
        )
        in counts.items()

        if (
            count
            !=
            EXPECTED_GAMES_PER_TEAM
        )
    }


    if bad:

        raise ValueError(
            "Teams without "
            "50 games: "
            f"{bad}"
        )


    print(
        "Schedule audit: PASS"
    )

    print()


# ============================================================
# TRADITIONAL BOXSCORE
# ============================================================

def traditional_payload(
    game_id: str,
) -> dict[str, Any]:

    path = (
        TRAD_CACHE
        /
        f"{game_id}.json"
    )


    if path.exists():

        return load_json(
            path
        )


    response = api_call(

        f"Traditional {game_id}",

        lambda:
            boxscoretraditionalv3
            .BoxScoreTraditionalV3(
                game_id=game_id,
                timeout=TIMEOUT,
            ),
    )


    payload = {

        "team_stats":
            records(
                response
                .team_stats
                .get_data_frame()
            ),

        "starter_bench":
            records(
                response
                .team_starter_bench_stats
                .get_data_frame()
            ),
    }


    save_json(
        path,
        payload,
    )


    return payload


# ============================================================
# MISC BOXSCORE
# ============================================================

def misc_payload(
    game_id: str,
) -> dict[str, Any]:

    path = (
        MISC_CACHE
        /
        f"{game_id}.json"
    )


    if path.exists():

        return load_json(
            path
        )


    response = api_call(

        f"Misc {game_id}",

        lambda:
            boxscoremiscv3
            .BoxScoreMiscV3(
                game_id=game_id,
                timeout=TIMEOUT,
            ),
    )


    payload = {

        "team_stats":
            records(
                response
                .team_stats
                .get_data_frame()
            )
    }


    save_json(
        path,
        payload,
    )


    return payload


# ============================================================
# TEAM LOOKUPS
# ============================================================

def by_team(
    records_list:
        list[
            dict[
                str,
                Any,
            ]
        ],
) -> dict[
    str,
    dict[
        str,
        Any,
    ],
]:

    return {

        norm_id(
            row.get(
                "teamId"
            )
        ):
            row

        for row
        in records_list

        if norm_id(
            row.get(
                "teamId"
            )
        )
    }


def bench_by_team(
    records_list:
        list[
            dict[
                str,
                Any,
            ]
        ],
) -> dict[
    str,
    float,
]:

    result = {}


    for row in records_list:

        starter_bench = (
            text(
                row.get(
                    "startersBench"
                )
            )
            .casefold()
        )


        if (
            "bench"
            not in
            starter_bench
        ):

            continue


        team_id = (
            norm_id(
                row.get(
                    "teamId"
                )
            )
        )


        if team_id:

            result[
                team_id
            ] = num(
                row.get(
                    "points"
                )
            )


    return result


# ============================================================
# CREATE ONE TEAM-GAME ROW
# ============================================================

def make_team_row(
    game_id: str,
    game_date: pd.Timestamp,
    team_id: str,
    location: str,
    trad: dict[str, Any],
    misc: dict[str, Any],
    bench_points: float,
) -> dict[str, Any]:

    fgm = num(
        trad.get(
            "fieldGoalsMade"
        )
    )


    fga = num(
        trad.get(
            "fieldGoalsAttempted"
        )
    )


    tpm = num(
        trad.get(
            "threePointersMade"
        )
    )


    tpa = num(
        trad.get(
            "threePointersAttempted"
        )
    )


    ftm = num(
        trad.get(
            "freeThrowsMade"
        )
    )


    fta = num(
        trad.get(
            "freeThrowsAttempted"
        )
    )


    two_made = (
        fgm
        -
        tpm
    )


    two_attempted = (
        fga
        -
        tpa
    )


    steals = num(
        trad.get(
            "steals"
        )
    )


    blocks = num(
        trad.get(
            "blocks"
        )
    )


    return {

        "game_id":
            game_id,

        "season":
            SEASON,

        "game_date":
            game_date.strftime(
                "%Y-%m-%d"
            ),

        "game_number":
            None,

        "team_id":
            team_id,

        "team_name":
            team_name(
                trad.get(
                    "teamCity"
                ),
                trad.get(
                    "teamName"
                ),
            ),

        "short_name":
            text(
                trad.get(
                    "teamTricode"
                )
            ),

        "opponent_name":
            None,

        "location":
            location,

        "result":
            None,

        "team_score":
            num(
                trad.get(
                    "points"
                )
            ),

        "opponent_score":
            None,

        "points":
            num(
                trad.get(
                    "points"
                )
            ),

        "field_goals_made":
            fgm,

        "field_goals_attempted":
            fga,

        "fg_pct":
            pct(
                fgm,
                fga,
            ),

        "two_point_field_goals_made":
            two_made,

        "two_point_field_goals_attempted":
            two_attempted,

        "two_point_percentage":
            pct(
                two_made,
                two_attempted,
            ),

        "three_point_field_goals_made":
            tpm,

        "three_point_field_goals_attempted":
            tpa,

        "three_point_percentage":
            pct(
                tpm,
                tpa,
            ),

        "free_throws_made":
            ftm,

        "free_throws_attempted":
            fta,

        "ft_pct":
            pct(
                ftm,
                fta,
            ),

        "offensive_rebounds":
            num(
                trad.get(
                    "reboundsOffensive"
                )
            ),

        "defensive_rebounds":
            num(
                trad.get(
                    "reboundsDefensive"
                )
            ),

        "rebounds":
            num(
                trad.get(
                    "reboundsTotal"
                )
            ),

        "assists":
            num(
                trad.get(
                    "assists"
                )
            ),

        "steals":
            steals,

        "blocks":
            blocks,

        "turnovers":
            num(
                trad.get(
                    "turnovers"
                )
            ),

        "stocks":
            (
                steals
                +
                blocks
            ),

        "points_in_the_paint":
            num(
                misc.get(
                    "pointsPaint"
                )
            ),

        "second_chance_points":
            num(
                misc.get(
                    "pointsSecondChance"
                )
            ),

        "points_from_turnovers":
            num(
                misc.get(
                    "pointsOffTurnovers"
                )
            ),

        "bench_points":
            bench_points,

        "fast_break_points":
            num(
                misc.get(
                    "pointsFastBreak"
                )
            ),
    }


# ============================================================
# PARSE ONE GAME
# ============================================================

def parse_game(
    schedule_row: pd.Series,
) -> list[
    dict[
        str,
        Any,
    ]
]:

    game_id = (
        norm_id(
            schedule_row[
                "gameId"
            ],
            10,
        )
    )


    trad_payload = (
        traditional_payload(
            game_id
        )
    )


    misc = (
        misc_payload(
            game_id
        )
    )


    trad = (
        by_team(
            trad_payload[
                "team_stats"
            ]
        )
    )


    misc_stats = (
        by_team(
            misc[
                "team_stats"
            ]
        )
    )


    bench = (
        bench_by_team(
            trad_payload[
                "starter_bench"
            ]
        )
    )


    schedule_ids = {

        norm_id(
            schedule_row[
                "home_team_id"
            ]
        ),

        norm_id(
            schedule_row[
                "away_team_id"
            ]
        ),
    }


    schedule_ids.discard(
        ""
    )


    if (
        len(trad)
        !=
        2
    ):

        raise ValueError(
            f"Game {game_id}: "
            "expected two "
            "Traditional team rows"
        )


    if (
        len(misc_stats)
        !=
        2
    ):

        raise ValueError(
            f"Game {game_id}: "
            "expected two "
            "Misc team rows"
        )


    if (
        schedule_ids
        and
        set(trad)
        !=
        schedule_ids
    ):

        raise ValueError(
            f"Game {game_id}: "
            "schedule team IDs "
            "do not match "
            "box score team IDs"
        )


    if (
        set(trad)
        -
        set(misc_stats)
    ):

        raise ValueError(
            f"Game {game_id}: "
            "missing Misc stats"
        )


    if (
        set(trad)
        -
        set(bench)
    ):

        raise ValueError(
            f"Game {game_id}: "
            "missing bench points"
        )


    home_id = (
        norm_id(
            schedule_row[
                "home_team_id"
            ]
        )
    )


    game_date = (
        pd.Timestamp(
            schedule_row[
                "game_date"
            ]
        )
    )


    rows = [

        make_team_row(

            game_id,

            game_date,

            team_id,

            (
                "HOME"
                if team_id == home_id
                else "AWAY"
            ),

            trad_row,

            misc_stats[
                team_id
            ],

            bench[
                team_id
            ],
        )

        for (
            team_id,
            trad_row,
        )
        in trad.items()
    ]


    a, b = rows


    a[
        "opponent_name"
    ] = b[
        "team_name"
    ]


    b[
        "opponent_name"
    ] = a[
        "team_name"
    ]


    a[
        "opponent_score"
    ] = b[
        "team_score"
    ]


    b[
        "opponent_score"
    ] = a[
        "team_score"
    ]


    if (
        a[
            "team_score"
        ]
        ==
        b[
            "team_score"
        ]
    ):

        raise ValueError(
            f"Game {game_id}: "
            "tied final score"
        )


    a[
        "result"
    ] = (

        "W"

        if (
            a[
                "team_score"
            ]
            >
            b[
                "team_score"
            ]
        )

        else
        "L"
    )


    b[
        "result"
    ] = (

        "W"

        if (
            b[
                "team_score"
            ]
            >
            a[
                "team_score"
            ]
        )

        else
        "L"
    )


    return rows


# ============================================================
# CHART METRICS WE REQUIRE
# ============================================================

METRICS = [

    "points_from_turnovers",

    "points_in_the_paint",

    "second_chance_points",

    "fast_break_points",

    "bench_points",

    "two_point_percentage",

    "three_point_percentage",

    "three_point_field_goals_attempted",

    "free_throws_attempted",

    "turnovers",

    "offensive_rebounds",

    "rebounds",

    "stocks",
]


# ============================================================
# OUTPUT AUDIT
# ============================================================

def audit_output(
    df: pd.DataFrame,
) -> None:

    game_sizes = (
        df
        .groupby(
            "game_id"
        )
        .size()
    )


    team_sizes = (
        df
        .groupby(
            "team_name"
        )
        .size()
    )


    print()
    print("Output audit")
    print("------------")


    print(
        "Rows:",
        len(df),
    )


    print(
        "Unique games:",
        df[
            "game_id"
        ].nunique(),
    )


    print(
        "Teams:",
        df[
            "team_name"
        ].nunique(),
    )


    print(
        "Games/team:",
        team_sizes.min(),
        "-",
        team_sizes.max(),
    )


    if (
        len(df)
        !=
        EXPECTED_ROWS
    ):

        raise ValueError(
            f"Expected "
            f"{EXPECTED_ROWS} rows"
        )


    if (
        df[
            "game_id"
        ].nunique()
        !=
        EXPECTED_GAMES
    ):

        raise ValueError(
            f"Expected "
            f"{EXPECTED_GAMES} "
            f"unique games"
        )


    if (
        df[
            "team_name"
        ].nunique()
        !=
        EXPECTED_TEAMS
    ):

        raise ValueError(
            f"Expected "
            f"{EXPECTED_TEAMS} "
            f"teams"
        )


    if not (
        team_sizes
        ==
        EXPECTED_GAMES_PER_TEAM
    ).all():

        raise ValueError(
            "Not every team "
            "has 50 rows"
        )


    if not (
        game_sizes
        ==
        2
    ).all():

        raise ValueError(
            "Not every game "
            "has exactly "
            "two team rows"
        )


    if (
        df.duplicated(
            [
                "game_id",
                "team_name",
            ]
        ).any()
    ):

        raise ValueError(
            "Duplicate "
            "team-game rows found"
        )


    missing = (
        df[
            METRICS
        ]
        .isna()
        .sum()
    )


    missing = (
        missing[
            missing > 0
        ]
    )


    if not missing.empty:

        raise ValueError(
            "Missing chart metrics: "
            f"{missing.to_dict()}"
        )


    result_sets = (
        df
        .groupby(
            "game_id"
        )[
            "result"
        ]
        .apply(
            set
        )
    )


    if not (
        result_sets
        ==
        {
            "W",
            "L",
        }
    ).all():

        raise ValueError(
            "Every game must "
            "contain one W "
            "and one L"
        )


    print(
        "Output audit: PASS"
    )


# ============================================================
# OPTIONAL SALARY DATA CROSS-CHECK
# ============================================================

def crosscheck_salary(
    df: pd.DataFrame,
) -> None:

    if not SALARY_FILE.exists():
        return


    salary = (
        pd.read_csv(
            SALARY_FILE
        )
    )


    required = {
        "date",
        "team",
        "opponent",
    }


    if not required.issubset(
        salary.columns
    ):

        return


    def key(
        date: Any,
        team: Any,
        opponent: Any,
    ) -> str:

        matchup = sorted(
            [
                text(team),
                text(opponent),
            ]
        )


        return (
            f"{text(date)}"
            f"|{matchup[0]}"
            f"|{matchup[1]}"
        )


    chart_keys = {

        key(
            row.game_date,
            row.team_name,
            row.opponent_name,
        )

        for row
        in df.itertuples()
    }


    salary_keys = {

        key(
            row.date,
            row.team,
            row.opponent,
        )

        for row
        in salary.itertuples()
    }


    if (
        chart_keys
        ==
        salary_keys
    ):

        print(
            "Salary cross-check: "
            "PASS "
            f"({len(chart_keys)} "
            "matching games)"
        )

    else:

        print(
            "Salary cross-check: "
            "WARNING"
        )


        print(
            "  Chart-only games:",
            len(
                chart_keys
                -
                salary_keys
            ),
        )


        print(
            "  Salary-only games:",
            len(
                salary_keys
                -
                chart_keys
            ),
        )


# ============================================================
# MAIN
# ============================================================

def main() -> None:

    TRAD_CACHE.mkdir(
        parents=True,
        exist_ok=True,
    )


    MISC_CACHE.mkdir(
        parents=True,
        exist_ok=True,
    )


    OUTPUT.parent.mkdir(
        parents=True,
        exist_ok=True,
    )


    schedule = (
        filter_schedule(
            load_schedule()
        )
    )


    audit_schedule(
        schedule
    )


    rows = []


    for (
        i,
        schedule_row,
    ) in schedule.iterrows():


        game_id = (
            norm_id(
                schedule_row[
                    "gameId"
                ],
                10,
            )
        )


        cached = (

            (
                TRAD_CACHE
                /
                f"{game_id}.json"
            ).exists()

            and

            (
                MISC_CACHE
                /
                f"{game_id}.json"
            ).exists()
        )


        date = (
            pd.Timestamp(
                schedule_row[
                    "game_date"
                ]
            )
            .strftime(
                "%Y-%m-%d"
            )
        )


        print(

            f"[{i + 1:>3}/"
            f"{len(schedule)}] "

            f"{date} | "

            f"{schedule_row['away_team']} "
            f"@ "
            f"{schedule_row['home_team']} | "

            f"{'cached' if cached else 'fetching'}"
        )


        rows.extend(
            parse_game(
                schedule_row
            )
        )


    df = (
        pd.DataFrame(
            rows
        )
    )


    # --------------------------------------------------------
    # NUMBER EACH TEAM'S GAMES 1-50
    # --------------------------------------------------------

    df = (
        df
        .sort_values(
            [
                "team_name",
                "game_date",
                "game_id",
            ]
        )
        .copy()
    )


    df[
        "game_number"
    ] = (

        df
        .groupby(
            "team_name"
        )
        .cumcount()

        +

        1
    )


    df = (
        df
        .sort_values(
            [
                "team_name",
                "game_number",
            ]
        )
        .reset_index(
            drop=True
        )
    )


    # --------------------------------------------------------
    # VALIDATE
    # --------------------------------------------------------

    audit_output(
        df
    )


    crosscheck_salary(
        df
    )


    # --------------------------------------------------------
    # FINAL COLUMN ORDER
    # --------------------------------------------------------

    columns = [

        "game_id",

        "season",

        "game_date",

        "game_number",

        "team_id",

        "team_name",

        "short_name",

        "opponent_name",

        "location",

        "result",

        "team_score",

        "opponent_score",

        "points",

        "field_goals_made",

        "field_goals_attempted",

        "fg_pct",

        "two_point_field_goals_made",

        "two_point_field_goals_attempted",

        "two_point_percentage",

        "three_point_field_goals_made",

        "three_point_field_goals_attempted",

        "three_point_percentage",

        "free_throws_made",

        "free_throws_attempted",

        "ft_pct",

        "offensive_rebounds",

        "defensive_rebounds",

        "rebounds",

        "assists",

        "steals",

        "blocks",

        "turnovers",

        "stocks",

        "points_in_the_paint",

        "second_chance_points",

        "points_from_turnovers",

        "bench_points",

        "fast_break_points",
    ]


    df[
        columns
    ].to_csv(
        OUTPUT,
        index=False,
    )


    print()
    print("Done")
    print("----")


    print(
        f"Saved: {OUTPUT}"
    )


    print(
        "If the NBA API times out, "
        "rerun this same command. "
        "Already cached games will "
        "not be downloaded again."
    )


if __name__ == "__main__":
    main()
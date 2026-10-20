-- Wars we fought (regular + CWL) plus every other war in our CWL groups
-- (ours = 0, needed for standings). Our clan is always stored on the `clan` side.
CREATE TABLE IF NOT EXISTS wars (
    id          TEXT PRIMARY KEY,      -- war_<startTime> | cwl_<warTag>
    kind        TEXT NOT NULL,         -- 'regular' | 'cwl'
    ours        INTEGER NOT NULL DEFAULT 1,
    season      TEXT,                  -- CWL season, e.g. 2026-10
    round       INTEGER,               -- CWL round (1-7)
    state       TEXT,
    start_time  TEXT,
    end_time    TEXT,
    data        TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS wars_start ON wars (ours, start_time);
CREATE INDEX IF NOT EXISTS wars_season ON wars (season);

CREATE TABLE IF NOT EXISTS cwl_groups (
    season      TEXT PRIMARY KEY,
    state       TEXT,
    data        TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS raids (
    start_time  TEXT PRIMARY KEY,
    end_time    TEXT,
    state       TEXT,
    data        TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- The API war log: results from before detailed tracking started.
CREATE TABLE IF NOT EXISTS warlog (
    end_time    TEXT PRIMARY KEY,
    result      TEXT,
    data        TEXT NOT NULL
);

-- One row per UTC day of clan-level counters (the day's latest pull wins).
CREATE TABLE IF NOT EXISTS clan_daily (
    date           TEXT PRIMARY KEY,   -- YYYY-MM-DD
    member_count   INTEGER,
    clan_level     INTEGER,
    clan_points    INTEGER,
    capital_points INTEGER,
    war_wins       INTEGER,
    war_losses     INTEGER,
    war_ties       INTEGER,
    war_win_streak INTEGER,
    data           TEXT NOT NULL,      -- clan JSON without memberList
    updated_at     TEXT NOT NULL
);

-- One row per member per UTC day: the roster history.
CREATE TABLE IF NOT EXISTS member_daily (
    date        TEXT NOT NULL,
    tag         TEXT NOT NULL,
    name        TEXT,
    role        TEXT,
    town_hall   INTEGER,
    exp_level   INTEGER,
    trophies    INTEGER,
    donations   INTEGER,
    donations_received INTEGER,
    data        TEXT NOT NULL,
    PRIMARY KEY (date, tag)
);
CREATE INDEX IF NOT EXISTS member_daily_tag ON member_daily (tag, date);

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);

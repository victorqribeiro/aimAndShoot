# Shared evolution: plan and handoff

Status: **built on branch `claude/relaxed-sagan-k058qf`, not yet deployed or
merged.** Steps 1–4 are done; see "Implementation notes" at the end for where
the code differs from the original plan.

## Goal

Today every visitor starts from a random population and evolution resets when
they die, so the bots rarely get past 10–20 generations. Instead, keep one
shared population on the server so that every game played by anyone moves it
forward: "these bots were evolved by everyone who played before you."

The game itself keeps running entirely in the browser. The server only stores
brains, scores them and breeds them.

## Decisions already made

- **Backend:** PHP with SQLite (PDO `sqlite` driver), on the owner's
  DigitalOcean droplet, where the game is already hosted.
- **Hosting:** the VPS becomes the real home of the game. GitHub Pages is
  expected to be retired (see open questions for the exact handling).
- **Weights never travel from browser to server.** Browsers only report raw
  stats per brain id; the server computes fitness and does all breeding.
  This is the main defence against people posting junk or deliberately
  dumb brains from the dev tools.
- **Milestone snapshots** (gen 1, 10, 100, 1000, …) are kept so they can be
  offered as difficulty levels later.
- **Offline fallback:** if the API can't be reached, the game falls back to
  the current local evolution, unchanged.

## Owner's answers (2026-10-08)

1. **New players** face the current crowd-evolved population. Snapshots may
   become difficulty levels later.
2. **GitHub Pages** is retired: `index.html` redirects `*.github.io` to
   `https://victorribeiro.com/aimAndShoot/`, so no CORS is needed.
3. **HUD** shows both: "Generation 1,234 · Round 3" (offline: "Generation: N"
   as before).
4. Work stays on this branch until the owner merges it. No database backups
   for now. Fix the phone-landscape HUD overlap.

## State of the code (branch `claude/relaxed-sagan-k058qf`)

On top of `master` (`988d141`), this branch already has:

| Commit | Change |
|---|---|
| `e64dca4` | AI fixes: each bot sees all players plus its own state (46 inputs), aim/threshold fixes, gentle mutation, elitism, safe spawns, `deltaTime` cap, resize no longer resets |
| `5b3115c` | Time-based fire rate (250ms bots / 200ms player), 1.5s grace period with fade-in, fitness no longer rewards spray, `totalTime` is the in-game round clock (ms) |
| `73bd748` | Fixed 1366×768 arena scaled to fit with letterbox, device-pixel-ratio rendering, visible red arena border, DOM HUD, portrait-phone overlay and landscape lock |
| `57b7806` | Body touch listeners registered as non-passive |
| `21d6adc` | Collision fix: pairwise separation + bounce, clamped inside the arena |

Not yet decided by the owner: whether/how to merge this branch, tagging the
original as `v1-original`, and a README note about the 2026 update. Known
small issue: in phone landscape the HUD can overlap a bot in the top-left.

### Facts the server must match

- **Brain shape:** `Dejavu([46, 6, 7])`, tanh on every layer.
  - Layer 0: weights 6×46 (276 values, row-major `rows × cols`), bias 6.
  - Layer 1: weights 7×6 (42 values), bias 7.
  - 331 numbers total. Built in `Genetics.createBrain()`; input size is
    `4 + 6 * maxEnemies` with `maxEnemies = 7`.
  - Initial values: uniform in [-1, 1] (`Matrix` with `"RANDOM"`).
- **Inputs** (`Player.updateAI`): own x/w, y/h, health/10, cooldown ratio,
  then 7 slots × 6 values for the other players (human always first).
- **Outputs:** left, up, right, down, aim x, aim y, shoot; booleans are
  `> 0`, aim is `(v + 1) / 2 * w|h`.
- **Fitness** (`Genetics.evaluate`, per bot, per round), which the server
  will re-implement:

  ```
  survival     = age / roundTime                      (both ms)
  accuracy     = hits / (shots + 5)
  misses       = shots - hits - friendlyFire
  friendly     = shots ? friendlyFire / shots : 0
  wall         = selfInjury / 40
  fitness      = survival*0.02 + accuracy*0.55 - friendly*0.08
                 - wall*0.12 - min(1, misses/50)*0.1
  fitness     *= move / 100
  fitness      = max(0, fitness)
  ```

- **Crossover** (`Genetics.crossOver`): biases take even indices from
  parent A and odd from B; weights take odd indices from A and even from B.
  Colour: each channel is either the average or a random parent's value.
- **Mutation** (`Genetics.mutate`): every child; each weight and bias has a
  10% chance of `+= uniform(-0.5, 0.5)`. 25% chance to replace one colour
  channel with a random 0–255.
- **Selection:** fitness-proportional (roulette) without replacement for the
  two parents; the best brain is copied unchanged (elitism).

## Step 1: make the stats frame-rate independent (client, prerequisite)

`Player.move` and `Player.selfInjury` are still counted **per frame**, so a
144Hz player produces values ~2.4× those of a 60Hz player. Harmless for local
play, but the server will average stats across many devices, so fix this
first:

- `move`: accumulate milliseconds spent moving (`+= deltaTime`) and rescale
  its divisor in the fitness (100 frames ≈ 1667ms at 60Hz).
- `selfInjury`: count wall *contacts* (entering the wall), not frames spent
  touching it — or accumulate ms and rescale like `move`.
- Wall damage (`health -= 0.25` per frame) has the same problem; make it per
  ms or per contact so the game plays the same at any refresh rate.

## Step 2: database (SQLite)

Keep the database file **outside the web root**. Enable WAL
(`PRAGMA journal_mode=WAL`) and a busy timeout so concurrent players don't
collide.

```sql
CREATE TABLE brains (
  id           INTEGER PRIMARY KEY,
  generation   INTEGER NOT NULL,
  parent_a     INTEGER,
  parent_b     INTEGER,
  color        TEXT    NOT NULL,          -- JSON [r,g,b]
  weights      TEXT    NOT NULL,          -- JSON {"layers":[{"w":[...],"b":[...]}, ...]}
  games        INTEGER NOT NULL DEFAULT 0,
  fitness_sum  REAL    NOT NULL DEFAULT 0,
  alive        INTEGER NOT NULL DEFAULT 1, -- 0 once replaced by breeding
  created_at   INTEGER NOT NULL
);
CREATE INDEX brains_alive ON brains(alive, games);

CREATE TABLE rounds (                     -- one per issued population
  token        TEXT    PRIMARY KEY,       -- random, unguessable
  brain_ids    TEXT    NOT NULL,          -- JSON [7 ids]
  ip_hash      TEXT    NOT NULL,
  issued_at    INTEGER NOT NULL,
  reported_at  INTEGER                    -- NULL until results arrive
);

CREATE TABLE snapshots (
  generation   INTEGER PRIMARY KEY,       -- 1, 10, 100, 1000, ...
  brain_ids    TEXT    NOT NULL,          -- JSON, top N at that point
  created_at   INTEGER NOT NULL
);

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);  -- e.g. global_generation
```

Pool size: start with ~50 live brains. Seed with random brains on first run.

## Step 3: API (PHP)

Two endpoints, JSON in and out. Suggested files: `api/population.php`,
`api/results.php`, a shared `api/lib.php` (DB connection, fitness, breeding),
and a one-off `api/init.php` or CLI script to create the schema and seed.

### `GET api/population.php`

- Pick 7 live brains. Prefer brains with few games (so new children get
  evaluated) mixed with top-ranked ones; exact mix is a tuning choice.
- Create a `rounds` row with a random token.
- Return `{ token, generation, brains: [{ id, color, weights }] }`.

### `POST api/results.php`

Body: `{ token, roundTime, stats: [{ id, shots, hits, friendlyFire, age, selfInjury, move }] }`

Validate before trusting anything:

- The token exists, has not been reported yet, and belongs to the same IP hash.
- The ids are exactly the ones issued for that token.
- Plausibility: `roundTime` is at most the time since the token was issued
  (plus slack); `hits + friendlyFire ≤ shots`;
  `shots ≤ roundTime / 250 + 1` (the fire-rate limit); `age ≤ roundTime`;
  every value is a finite non-negative number.
- Rate limit per IP (for example, at most one report every few seconds and a
  daily cap).

Then compute fitness per brain with the formula above, add it to
`fitness_sum`, increment `games`, and mark the round reported.

### Breeding (inside `results.php`, no cron needed)

After recording results, inside a `BEGIN IMMEDIATE` transaction:

- If enough brains have `games ≥ 3` (for example, 20), breed once:
  rank them by average fitness (`fitness_sum / games`), mark the weakest
  quarter as not alive, and replace them with children of the top ones
  (roulette selection, crossover and mutation as described above). Keep the
  best brain unchanged.
- Increment `global_generation` in `meta`.
- When `global_generation` hits a milestone, write a `snapshots` row.

Requiring several independent games before a brain is ranked both limits the
damage of faked stats and smooths out the noise of one lucky round.

## Step 4: client changes

- On game start, and after each round, call `population.php` and build the 7
  bots from the returned weights (copy into `Dejavu` layers as in
  `Genetics.copyBrain`). Keep the token for the round.
- At round end, `POST` the raw stats for each brain id to `results.php`
  instead of (or in addition to) evolving locally.
- The 1.5s grace period at round start hides the network round trip; if the
  next population hasn't arrived yet, wait on a short "loading" state.
- On any network failure, switch to the current local `Genetics` evolution
  for the rest of the session.
- Decide what the HUD shows (open question 3).

## Step 5: deployment (DigitalOcean droplet)

- Serve the static game and `api/` from the existing web server with PHP-FPM.
- The SQLite file and its directory must be writable by the PHP user, and
  must not be downloadable (outside the web root, or denied by the server
  config).
- Back up the database file regularly (for example, a daily copy using
  `sqlite3 db.sqlite ".backup ..."`).
- Handle GitHub Pages according to open question 2. Update the README links,
  `og:url`, and `manifest.json` if the canonical URL changes.
- The service worker in `aux.js` is still disabled (commented out in
  `index.html`). If it is ever re-enabled, it must not cache `api/` responses.

## Testing

- Local: `php -S localhost:8000` from the repo root serves both the game
  and the API. Use a throwaway database file.
- Unit-test the PHP fitness function against the JS one with the same
  inputs, so both give the same numbers.
- Script many fake rounds against the API to check that breeding triggers,
  the generation advances, snapshots appear, and validation rejects
  impossible stats and reused tokens.
- Play-test in the browser, including the offline fallback (stop the PHP
  server mid-game).

## Risks to keep in mind

- **Difficulty only goes up.** Crowd-evolved bots may be harsh on newcomers;
  snapshots or a ladder can soften that (open question 1).
- **The fitness rewards hurting players, not being fun to play against.**
  Watch real games; the weights live on the server and can be tuned without
  a client release.
- **It is now a real backend** to keep running and backed up, rather than
  static files only.

## Implementation notes

- **Files:** `api/_lib.php` (DB, fitness, breeding; `_` files are denied by
  `api/.htaccess`, like the owner's other apps), `api/population.php`,
  `api/results.php`, `js/Shared.js` (client), `tests/`.
- **Database:** `/home/sqlite3-DBs/aimAndShoot.sqlite3` by default, override
  with the `AIMANDSHOOT_DB` env var. Schema and the 50 random seed brains are
  created on first request (`PRAGMA user_version`), so no init script. The IP
  hash salt is stored in `meta`.
- **Units:** `move`, `selfInjury` and `age` are in ms; fitness uses
  `move / MOVE_MS` and `selfInjury / WALL_MS` with `MOVE_MS = 100 frames` and
  `WALL_MS = 40 frames` at 60Hz, so values match the old per-frame ones.
  Acceleration, friction and wall damage are scaled by elapsed time.
- **Breeding trigger:** "20 brains with ≥ 3 games" would fire on every report
  once reached, so instead a generation is bred when *every* live brain has
  ≥ 3 games: the 12 weakest (about a quarter of 50) are replaced by children
  of the other 38, which always include the best one. About 8 reported rounds
  per generation.
- **Selection per round:** up to 2 slots from the top-ranked brains, the rest
  from the brains with the fewest games.
- **Dead brains** keep their row (lineage and stats) but their weights are
  blanked to `{}` unless a snapshot references them, so the file stays small.
- **Rounds** are also reported when the player dies (surviving bots get
  `age = roundTime`). The next population is prefetched as soon as a round
  starts, so there is normally no loading pause.
- **Rate limits:** 60 populations and 40 reports per IP per 5 minutes,
  1500 reports per day. Rounds older than 2 days are purged.
- **Service worker:** `sw.js` is now a self-unregistering worker that deletes
  only the `aimAndShoot-v1` cache, for any visitor who still has the 2019 one.
- **HUD overlap:** the HUD fades while a player is under it.

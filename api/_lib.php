<?php
// Shared evolution backend: database, fitness and breeding.
// Must match the client: Dejavu([46, 6, 7]) and Genetics.evaluate in js/.

const LAYERS = [[46, 6], [6, 7]];      // [inputs, outputs] per layer
const POOL_SIZE = 50;                  // live brains
const ROUND_SIZE = 7;                  // bots per round
const TOP_SLOTS = 2;                   // of those, picked among the best ranked
const MIN_GAMES = 3;                   // games before a brain is ranked
const MIN_PLAYERS = 2;                 // ...reported by at least this many players (ip_hash)
const MAX_GAMES_PER_PLAYER = 2;        // games one player can add to one brain
const CULL = 12;                       // brains replaced per generation (~quarter)
const SNAPSHOT_SIZE = 7;

const FRAME_MS = 1000 / 60;
const MOVE_MS = 100 * FRAME_MS;
const WALL_MS = 40 * FRAME_MS;
const BOT_SHOT_INTERVAL = 250;         // ms, Player.shotInterval for bots

const MAX_ROUND_MS = 30 * 60 * 1000;
const CLOCK_SLACK_MS = 10 * 1000;
const RATE_WINDOW = 300;               // s
const MAX_ISSUED_PER_WINDOW = 60;
const MAX_REPORTS_PER_WINDOW = 40;
const MAX_REPORTS_PER_DAY = 1500;
const ROUND_TTL = 2 * 86400;           // s, unreported/old rounds are purged after this
const SCHEMA_VERSION = 2;              // PRAGMA user_version

// SQL: brain b has enough games from enough players to be ranked
const RANKED_SQL = '(b.games >= ' . MIN_GAMES . ' AND (SELECT COUNT(*) FROM brain_games g WHERE g.brain_id = b.id) >= ' . MIN_PLAYERS . ')';

function db_path() {
	$path = $_SERVER['AIMANDSHOOT_DB'] ?? getenv('AIMANDSHOOT_DB');
	if (!$path)
		throw new RuntimeException('AIMANDSHOOT_DB is not set');
	return $path;
}

function db() {
	static $pdo = null;
	if ($pdo)
		return $pdo;
	$pdo = new PDO('sqlite:' . db_path(), null, null, [
		PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
		PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
	]);
	$pdo->exec('PRAGMA busy_timeout = 5000');
	$pdo->exec('PRAGMA journal_mode = WAL');
	$pdo->exec('PRAGMA synchronous = NORMAL');
	if ((int)$pdo->query('PRAGMA user_version')->fetchColumn() < SCHEMA_VERSION)
		migrate_db($pdo);
	return $pdo;
}

// Creates the database, or brings an older one up to SCHEMA_VERSION.
function migrate_db($pdo) {
	$pdo->exec('BEGIN IMMEDIATE');
	try {
		// another request may have migrated it while we waited for the lock
		$version = (int)$pdo->query('PRAGMA user_version')->fetchColumn();
		if ($version === 0)
			init_db($pdo);
		elseif ($version < 2)
			add_brain_games($pdo);
		if ($version < SCHEMA_VERSION)
			$pdo->exec('PRAGMA user_version = ' . SCHEMA_VERSION);
		$pdo->exec('COMMIT');
	} catch (Throwable $e) {
		$pdo->exec('ROLLBACK');
		throw $e;
	}
}

// A new database, created with the current schema.
function init_db($pdo) {
	$pdo->exec('
		CREATE TABLE brains (
			id          INTEGER PRIMARY KEY,
			generation  INTEGER NOT NULL,
			parent_a    INTEGER,
			parent_b    INTEGER,
			color       TEXT    NOT NULL,
			weights     TEXT    NOT NULL,
			games       INTEGER NOT NULL DEFAULT 0,
			fitness_sum REAL    NOT NULL DEFAULT 0,
			alive       INTEGER NOT NULL DEFAULT 1,
			created_at  INTEGER NOT NULL
		);
		CREATE INDEX brains_alive ON brains(alive, games);
		CREATE TABLE rounds (
			token       TEXT    PRIMARY KEY,
			brain_ids   TEXT    NOT NULL,
			ip_hash     TEXT    NOT NULL,
			issued_at   INTEGER NOT NULL,
			reported_at INTEGER
		);
		CREATE INDEX rounds_ip_issued ON rounds(ip_hash, issued_at);
		CREATE INDEX rounds_ip_reported ON rounds(ip_hash, reported_at);
		CREATE TABLE snapshots (
			generation  INTEGER PRIMARY KEY,
			brain_ids   TEXT    NOT NULL,
			created_at  INTEGER NOT NULL
		);
		CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
	');
	add_brain_games($pdo);
	set_meta('global_generation', 1);
	set_meta('ip_salt', bin2hex(random_bytes(32)));
	for ($i = 0; $i < POOL_SIZE; $i++)
		insert_brain(1, null, null, random_color(), random_weights());
	take_snapshot(1);
}

// Version 2: which players reported games for each brain. Rebuilt from the
// reported rounds still in the database (older ones were purged, so brains
// that were already ranked may need a game from one more player).
function add_brain_games($pdo) {
	$pdo->exec('
		CREATE TABLE brain_games (
			brain_id    INTEGER NOT NULL,
			ip_hash     TEXT    NOT NULL,
			games       INTEGER NOT NULL,
			PRIMARY KEY (brain_id, ip_hash)
		) WITHOUT ROWID;
		INSERT INTO brain_games (brain_id, ip_hash, games)
			SELECT b.id, r.ip_hash, COUNT(*) FROM rounds r, json_each(r.brain_ids) j
			JOIN brains b ON b.id = j.value AND b.alive = 1
			WHERE r.reported_at IS NOT NULL
			GROUP BY b.id, r.ip_hash;
	');
}

function get_meta($key) {
	$st = db()->prepare('SELECT value FROM meta WHERE key = ?');
	$st->execute([$key]);
	return $st->fetchColumn();
}

function set_meta($key, $value) {
	db()->prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
		->execute([$key, (string)$value]);
}

function ip_hash() {
	return hash_hmac('sha256', $_SERVER['REMOTE_ADDR'] ?? '', get_meta('ip_salt'));
}

// ---- random helpers --------------------------------------------------------

function rnd() {
	return mt_rand() / (mt_getrandmax() + 1);
}

function random_color() {
	return [mt_rand(0, 255), mt_rand(0, 255), mt_rand(0, 255)];
}

function random_weights() {
	$layers = [];
	foreach (LAYERS as [$in, $out]) {
		$w = [];
		for ($i = 0; $i < $in * $out; $i++)
			$w[] = rnd() * 2 - 1;
		$b = [];
		for ($i = 0; $i < $out; $i++)
			$b[] = rnd() * 2 - 1;
		$layers[] = ['w' => $w, 'b' => $b];
	}
	return ['layers' => $layers];
}

function insert_brain($generation, $parentA, $parentB, $color, $weights) {
	foreach ($weights['layers'] as &$layer)
		foreach (['w', 'b'] as $k)
			$layer[$k] = array_map(fn($v) => round($v, 6), $layer[$k]);
	unset($layer);
	db()->prepare('INSERT INTO brains (generation, parent_a, parent_b, color, weights, created_at) VALUES (?, ?, ?, ?, ?, ?)')
		->execute([$generation, $parentA, $parentB, json_encode(array_map('intval', $color)), json_encode($weights), time()]);
	return (int)db()->lastInsertId();
}

// ---- fitness (same formula as Genetics.evaluate) ---------------------------

function fitness($s, $roundTime) {
	$survival = $roundTime ? $s['age'] / $roundTime : 0;
	$accuracy = $s['hits'] / ($s['shots'] + 5);
	$misses = $s['shots'] - $s['hits'] - $s['friendlyFire'];
	$friendly = $s['shots'] ? $s['friendlyFire'] / $s['shots'] : 0;
	$wall = $s['selfInjury'] / WALL_MS;
	$f = $survival * 0.02 + $accuracy * 0.55 - $friendly * 0.08 - $wall * 0.12 - min(1, $misses / 50) * 0.1;
	$f *= min(1, $s['move'] / MOVE_MS);   // must move, but a longer life isn't a bigger multiplier
	return max(0, $f);
}

// ---- selection -------------------------------------------------------------

// Mostly brains that still need games from this player, plus a couple of the
// best ranked ones.
function pick_round_brains($ip) {
	$st = db()->prepare('SELECT b.id, b.games, b.fitness_sum, ' . RANKED_SQL . ' AS ranked,
		(SELECT g.games FROM brain_games g WHERE g.brain_id = b.id AND g.ip_hash = ?) AS mine
		FROM brains b WHERE b.alive = 1');
	$st->execute([$ip]);
	$alive = $st->fetchAll();
	shuffle($alive);
	$ranked = array_values(array_filter($alive, fn($b) => $b['ranked']));
	usort($ranked, fn($a, $b) => $b['fitness_sum'] / $b['games'] <=> $a['fitness_sum'] / $a['games']);
	$picked = [];
	foreach (array_slice($ranked, 0, TOP_SLOTS * 3) as $b) {
		if (count($picked) >= TOP_SLOTS)
			break;
		if (rnd() < 0.6)
			$picked[$b['id']] = true;
	}
	// unranked brains first, then the ones this player has played least, then
	// fewest games; brains where this player's games no longer count go last
	$key = fn($b) => [(int)$b['mine'] >= MAX_GAMES_PER_PLAYER, (int)$b['ranked'], (int)$b['mine'], (int)$b['games']];
	usort($alive, fn($a, $b) => $key($a) <=> $key($b));   // stable: ties stay shuffled
	foreach ($alive as $b) {
		if (count($picked) >= ROUND_SIZE)
			break;
		$picked[$b['id']] = true;
	}
	$ids = array_keys($picked);
	shuffle($ids);
	return $ids;
}

// Adds a reported game to a brain, unless the brain is gone or this player
// already added MAX_GAMES_PER_PLAYER games to it.
function record_game($brainId, $ip, $fitness) {
	$count = db()->prepare('INSERT INTO brain_games (brain_id, ip_hash, games)
		SELECT id, ?, 1 FROM brains WHERE id = ? AND alive = 1
		ON CONFLICT (brain_id, ip_hash) DO UPDATE SET games = games + 1 WHERE games < ' . MAX_GAMES_PER_PLAYER);
	$count->execute([$ip, $brainId]);
	if ($count->rowCount() > 0)
		db()->prepare('UPDATE brains SET games = games + 1, fitness_sum = fitness_sum + ? WHERE id = ?')
			->execute([$fitness, $brainId]);
}

// ---- breeding (same operators as Genetics.crossOver / mutate) --------------

function cross_over($a, $b) {
	$color = [];
	for ($i = 0; $i < 3; $i++)
		$color[] = rnd() < 0.5 ? intdiv($a['color'][$i] + $b['color'][$i], 2) : (rnd() < 0.5 ? $a['color'][$i] : $b['color'][$i]);
	$layers = [];
	foreach ($a['weights']['layers'] as $l => $la) {
		$lb = $b['weights']['layers'][$l];
		$bias = [];
		foreach ($la['b'] as $j => $v)
			$bias[] = $j % 2 ? $lb['b'][$j] : $v;
		$w = [];
		foreach ($la['w'] as $j => $v)
			$w[] = $j % 2 ? $v : $lb['w'][$j];
		$layers[] = ['w' => $w, 'b' => $bias];
	}
	return [$color, ['layers' => $layers]];
}

function mutate($color, $weights) {
	if (rnd() < 0.25)
		$color[mt_rand(0, 2)] = mt_rand(0, 255);
	$rate = 0.1;
	$strength = 0.5;
	foreach ($weights['layers'] as &$layer)
		foreach (['w', 'b'] as $k)
			foreach ($layer[$k] as &$v)
				if (rnd() < $rate)
					$v += (rnd() * 2 - 1) * $strength;
	unset($layer, $v);
	return [$color, $weights];
}

// Fitness-proportional pick, removed from $pool so the two parents differ.
function select_parent(&$pool) {
	$total = array_sum(array_column($pool, 'avg'));
	if ($total <= 0)
		return array_splice($pool, mt_rand(0, count($pool) - 1), 1)[0];
	$prob = rnd() * $total;
	foreach ($pool as $i => $b) {
		if ($prob < $b['avg'])
			return array_splice($pool, $i, 1)[0];
		$prob -= $b['avg'];
	}
	return array_pop($pool);
}

// Breeds one generation once every live brain has been ranked (MIN_GAMES games
// from at least MIN_PLAYERS players), so one player can't evolve the pool alone.
// Call inside a write transaction. Returns true if a generation was bred.
function maybe_breed() {
	$pending = (int)db()->query('SELECT COUNT(*) FROM brains b WHERE b.alive = 1 AND NOT ' . RANKED_SQL)->fetchColumn();
	if ($pending > 0)
		return false;
	$ranked = db()->query('SELECT id, color, weights, games, fitness_sum FROM brains WHERE alive = 1')->fetchAll();
	foreach ($ranked as &$b) {
		$b['avg'] = $b['fitness_sum'] / $b['games'];
		$b['color'] = json_decode($b['color'], true);
		$b['weights'] = json_decode($b['weights'], true);
	}
	unset($b);
	usort($ranked, fn($a, $b) => $b['avg'] <=> $a['avg']);
	// the best brain is always among the survivors, so it carries over unchanged
	$survivors = array_slice($ranked, 0, count($ranked) - CULL);
	$culled = array_slice($ranked, count($ranked) - CULL);

	$generation = (int)get_meta('global_generation') + 1;
	$kill = db()->prepare('UPDATE brains SET alive = 0 WHERE id = ?');
	foreach ($culled as $b)
		$kill->execute([$b['id']]);
	db()->exec('DELETE FROM brain_games WHERE brain_id NOT IN (SELECT id FROM brains WHERE alive = 1)');
	for ($i = 0; $i < CULL; $i++) {
		$pool = $survivors;
		$a = select_parent($pool);
		$b = select_parent($pool);
		[$color, $weights] = mutate(...cross_over($a, $b));
		insert_brain($generation, $a['id'], $b['id'], $color, $weights);
	}
	// weights of brains that are gone and not in a snapshot are no longer needed
	db()->exec("UPDATE brains SET weights = '{}' WHERE alive = 0 AND weights != '{}'
		AND id NOT IN (SELECT value FROM snapshots, json_each(snapshots.brain_ids))");

	set_meta('global_generation', $generation);
	if (is_milestone($generation))
		take_snapshot($generation);
	return true;
}

function is_milestone($generation) {
	for ($m = 1; $m <= $generation; $m *= 10)
		if ($m === $generation)
			return true;
	return false;
}

// Top brains by average fitness (unranked brains last).
function take_snapshot($generation) {
	$ids = db()->query('SELECT id FROM brains b WHERE alive = 1
		ORDER BY ' . RANKED_SQL . ' DESC, fitness_sum / MAX(games, 1) DESC LIMIT ' . SNAPSHOT_SIZE)
		->fetchAll(PDO::FETCH_COLUMN);
	db()->prepare('INSERT OR REPLACE INTO snapshots (generation, brain_ids, created_at) VALUES (?, ?, ?)')
		->execute([$generation, json_encode(array_map('intval', $ids)), time()]);
}

// ---- HTTP helpers ----------------------------------------------------------

function respond($status, $data) {
	http_response_code($status);
	header('Content-Type: application/json');
	header('Cache-Control: no-store');
	echo json_encode($data);
	exit;
}

function fail($status, $message) {
	respond($status, ['error' => $message]);
}

function run($handler) {
	try {
		$handler();
	} catch (Throwable $e) {
		error_log('aimAndShoot api: ' . $e->getMessage());
		fail(500, 'server error');
	}
}

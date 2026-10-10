<?php
// POST: raw stats for a round issued by population.php. The server computes
// fitness and breeds; weights never come from the browser.
require __DIR__ . '/_lib.php';

function valid_stats($body, $round, $now) {
	$roundTime = $body['roundTime'] ?? null;
	if (!is_int($roundTime) && !is_float($roundTime))
		return false;
	if (!is_finite($roundTime) || $roundTime < 0 || $roundTime > MAX_ROUND_MS)
		return false;
	if ($roundTime > ($now - $round['issued_at']) * 1000 + CLOCK_SLACK_MS)
		return false;
	$stats = $body['stats'] ?? null;
	$issued = json_decode($round['brain_ids'], true);
	if (!is_array($stats) || !array_is_list($stats) || count($stats) !== count($issued))
		return false;
	$seen = [];
	foreach ($stats as $s) {
		if (!is_array($s))
			return false;
		foreach (['id', 'shots', 'hits', 'friendlyFire', 'age', 'selfInjury', 'move'] as $k) {
			$v = $s[$k] ?? null;
			if ((!is_int($v) && !is_float($v)) || !is_finite($v) || $v < 0)
				return false;
		}
		foreach (['id', 'shots', 'hits', 'friendlyFire'] as $k)
			if (!is_int($s[$k]))
				return false;
		if (!in_array($s['id'], $issued, true) || isset($seen[$s['id']]))
			return false;
		$seen[$s['id']] = true;
		if ($s['hits'] + $s['friendlyFire'] > $s['shots'])
			return false;
		if ($s['shots'] > floor($roundTime / BOT_SHOT_INTERVAL) + 1)
			return false;
		foreach (['age', 'selfInjury', 'move'] as $k)
			if ($s[$k] > $roundTime + 1)
				return false;
	}
	return true;
}

run(function () {
	if ($_SERVER['REQUEST_METHOD'] !== 'POST')
		fail(405, 'method not allowed');
	$raw = file_get_contents('php://input', false, null, 0, 16384);
	$body = json_decode($raw, true);
	if (!is_array($body) || !is_string($body['token'] ?? null))
		fail(400, 'bad request');

	$pdo = db();
	$ip = ip_hash();
	$now = time();
	$pdo->exec('BEGIN IMMEDIATE');
	$reject = function ($status, $message) use ($pdo) {
		$pdo->exec('ROLLBACK');
		fail($status, $message);
	};

	$st = $pdo->prepare('SELECT COUNT(*) FROM rounds WHERE ip_hash = ? AND reported_at > ?');
	$st->execute([$ip, $now - RATE_WINDOW]);
	if ($st->fetchColumn() >= MAX_REPORTS_PER_WINDOW)
		$reject(429, 'too many requests');
	$st->execute([$ip, $now - 86400]);
	if ($st->fetchColumn() >= MAX_REPORTS_PER_DAY)
		$reject(429, 'too many requests');

	$st = $pdo->prepare('SELECT * FROM rounds WHERE token = ?');
	$st->execute([$body['token']]);
	$round = $st->fetch();
	if (!$round || $round['reported_at'] !== null || !hash_equals($round['ip_hash'], $ip))
		$reject(409, 'unknown or used token');
	if (!valid_stats($body, $round, $now))
		$reject(422, 'implausible stats');

	$pdo->prepare('UPDATE rounds SET reported_at = ? WHERE token = ?')->execute([$now, $round['token']]);
	foreach ($body['stats'] as $s)
		record_game($s['id'], $ip, fitness($s, $body['roundTime']));
	maybe_breed();
	$pdo->prepare('DELETE FROM rounds WHERE issued_at < ?')->execute([$now - ROUND_TTL]);
	$generation = (int)get_meta('global_generation');
	$pdo->exec('COMMIT');
	respond(200, ['ok' => true, 'generation' => $generation]);
});

<?php
// GET: issues 7 brains from the shared pool and a token to report the round with.
require __DIR__ . '/_lib.php';

run(function () {
	if ($_SERVER['REQUEST_METHOD'] !== 'GET')
		fail(405, 'method not allowed');
	$pdo = db();
	$ip = ip_hash();
	$now = time();
	$pdo->exec('BEGIN IMMEDIATE');
	$st = $pdo->prepare('SELECT COUNT(*) FROM rounds WHERE ip_hash = ? AND issued_at > ?');
	$st->execute([$ip, $now - RATE_WINDOW]);
	if ($st->fetchColumn() >= MAX_ISSUED_PER_WINDOW) {
		$pdo->exec('ROLLBACK');
		fail(429, 'too many requests');
	}
	$ids = pick_round_brains();
	$token = bin2hex(random_bytes(16));
	$pdo->prepare('INSERT INTO rounds (token, brain_ids, ip_hash, issued_at) VALUES (?, ?, ?, ?)')
		->execute([$token, json_encode($ids), $ip, $now]);
	$generation = (int)get_meta('global_generation');
	$pdo->exec('COMMIT');

	$in = implode(',', array_fill(0, count($ids), '?'));
	$st = $pdo->prepare("SELECT id, color, weights FROM brains WHERE id IN ($in)");
	$st->execute($ids);
	$brains = array_map(fn($b) => [
		'id' => (int)$b['id'],
		'color' => json_decode($b['color']),
		'weights' => json_decode($b['weights']),
	], $st->fetchAll());
	respond(200, ['token' => $token, 'generation' => $generation, 'brains' => $brains]);
});

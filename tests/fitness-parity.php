<?php
require $argv[1] . '/api/_lib.php';
$cases = json_decode(file_get_contents($argv[2]), true);
$worst = 0; $nonzero = 0;
foreach ($cases as $c) {
	$php = fitness($c['s'], $c['roundTime']);
	$worst = max($worst, abs($php - $c['js']));
	$nonzero += $c['js'] > 0;
}
printf("%d cases (%d with fitness > 0), max |php - js| = %g\n", count($cases), $nonzero, $worst);

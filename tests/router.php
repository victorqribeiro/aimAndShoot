<?php
// Router for `php -S` (see README.md): lets api-sim.py play as several
// players by sending the client address in an X-Test-Remote-Addr header.
// Only the built-in development server uses it.
if (PHP_SAPI !== 'cli-server')
	exit;
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (!preg_match('#^/api/[a-z]+\.php$#', $path))
	return false;
if (isset($_SERVER['HTTP_X_TEST_REMOTE_ADDR']))
	$_SERVER['REMOTE_ADDR'] = $_SERVER['HTTP_X_TEST_REMOTE_ADDR'];
require dirname(__DIR__) . $path;

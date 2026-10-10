# API tests

Run from the repo root with a throwaway database:

```sh
AIMANDSHOOT_DB=/tmp/aas-test.sqlite3 php -S 127.0.0.1:8765 tests/router.php &

# fake rounds (one player can't breed alone, two or more can) and validation rejections
python3 tests/api-sim.py /tmp/aas-test.sqlite3 300

# PHP fitness() must give the same numbers as Genetics.evaluate()
node tests/fitness-parity.js . /tmp/aas-cases.json && php tests/fitness-parity.php . /tmp/aas-cases.json
```

`api-sim.py` backdates rounds in the database to stay under the per-IP rate
limits, so point it only at a test database. It plays as several players
through `tests/router.php`, which sets the client address from a request
header and only runs under `php -S`.

To check the upgrade of an older (version 1) database, start the server on a
copy of it and run:

```sh
python3 tests/migration-check.py /tmp/aas-copy.sqlite3
```

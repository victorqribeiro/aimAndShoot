import json, sqlite3, sys, urllib.request
# Usage: migration-check.py <copy of a version 1 database>  (see tests/README.md)
# Opens the API once against it and checks that the upgrade to version 2 kept
# the brains, generation and snapshots and rebuilt who played which brain.
DB, BASE = sys.argv[1], 'http://127.0.0.1:8765/api/'
db = sqlite3.connect(DB, isolation_level=None)
failed = 0
def check(ok, label, *info):
    global failed
    failed += not ok; print(('OK  ' if ok else 'BAD ') + label, *info)
def rows(sql):
    return db.execute(sql).fetchall()
assert rows('PRAGMA user_version')[0][0] == 1, 'expected a version 1 database'
brains, meta = rows('SELECT * FROM brains ORDER BY id'), rows('SELECT * FROM meta ORDER BY key')
snapshots, rounds = rows('SELECT * FROM snapshots ORDER BY generation'), rows('SELECT COUNT(*) FROM rounds')[0][0]
alive = {b[0] for b in rows('SELECT id FROM brains WHERE alive = 1')}
expected = {}
for ids, ip in rows('SELECT brain_ids, ip_hash FROM rounds WHERE reported_at IS NOT NULL'):
    for i in json.loads(ids):
        if i in alive:
            expected[(i, ip)] = expected.get((i, ip), 0) + 1

p = json.load(urllib.request.urlopen(BASE + 'population.php'))   # migrates
check(rows('PRAGMA user_version')[0][0] == 2, 'user_version is 2')
check(rows('SELECT * FROM brains ORDER BY id') == brains, 'brains unchanged', len(brains), 'brains')
check(rows('SELECT * FROM meta ORDER BY key') == meta, 'meta unchanged')
check(p['generation'] == int(dict(meta)['global_generation']), 'generation kept', p['generation'])
check(rows('SELECT * FROM snapshots ORDER BY generation') == snapshots, 'snapshots unchanged')
check(rows('SELECT COUNT(*) FROM rounds')[0][0] == rounds + 1, 'rounds kept (+1 issued now)')
got = {(b, ip): g for b, ip, g in rows('SELECT brain_id, ip_hash, games FROM brain_games')}
check(got == expected, 'brain_games rebuilt from reported rounds', len(got), 'rows')
ranked = rows('SELECT COUNT(*) FROM brains WHERE alive = 1 AND games >= 3')[0][0]
players = rows('''SELECT COUNT(*) FROM brains b WHERE alive = 1 AND games >= 3
                  AND (SELECT COUNT(*) FROM brain_games g WHERE g.brain_id = b.id) >= 2''')[0][0]
print(f'ranked before: {ranked}, after (also 2 players): {players} of {len(alive)}')
sys.exit(1 if failed else 0)

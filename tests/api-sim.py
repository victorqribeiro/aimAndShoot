import json, random, sqlite3, sys, urllib.request
# Usage: api-sim.py <test database> <rounds>  (see tests/README.md)
DB, BASE, N = sys.argv[1], 'http://127.0.0.1:8765/api/', int(sys.argv[2])
db = sqlite3.connect(DB, isolation_level=None)
failed = 0
def call(url, body=None, ip='10.0.0.1'):  # tests/router.php turns the header into REMOTE_ADDR
    req = urllib.request.Request(url, body and json.dumps(body).encode(),
                                 {'Content-Type': 'application/json', 'X-Test-Remote-Addr': ip})
    try:
        r = urllib.request.urlopen(req); return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)
def get(ip='10.0.0.1'):
    code, p = call(BASE + 'population.php', ip=ip); assert code == 200, (code, p); return p
def post(body, ip='10.0.0.1'):
    return call(BASE + 'results.php', body, ip)
def backdate():  # keep the rate limit out of the way of a fast simulation
    db.execute("UPDATE rounds SET issued_at = issued_at - 600, reported_at = reported_at - 600")
def stats(p, rt=30000):
    out = []
    for b in p['brains']:
        shots = random.randint(0, min(100, rt // 250)); hits = random.randint(0, shots // 2)
        ff = random.randint(0, shots - hits)
        out.append(dict(id=b['id'], shots=shots, hits=hits, friendlyFire=ff, age=random.uniform(0, rt),
                        selfInjury=random.uniform(0, 2000), move=random.uniform(0, rt)))
    return out
def check(ok, label, *info):
    global failed
    failed += not ok; print(('OK  ' if ok else 'BAD ') + label, *info)
def play(ips, n):  # n rounds, the players taking turns; returns the generation reached
    for i in range(n):
        ip = ips[i % len(ips)]
        p = get(ip); backdate()
        code, r = post(dict(token=p['token'], roundTime=30000, stats=stats(p)), ip)
        assert code == 200, (code, r)
    return r['generation']
get('10.0.0.1'); get('10.0.0.2')
assert db.execute("SELECT COUNT(DISTINCT ip_hash) FROM rounds").fetchone()[0] == 2, 'start php -S with tests/router.php'
# one player can't evolve the pool alone
start = get()['generation']
gen = play(['10.0.0.1'], N)
check(gen == start, f'one player, {N} rounds: no new generation', gen)
games = db.execute("SELECT MAX(games) FROM brains WHERE alive = 1").fetchone()[0]
check(games <= 2, 'one player adds at most 2 games to a brain', games)
# two or more can
gen2 = play(['10.0.0.1', '10.0.0.2'], N)
check(gen2 > gen, f'two players, {N} rounds: generations advance', gen2 - gen)
gen5 = play([f'10.0.1.{i}' for i in range(5)], N)
check(gen5 > gen2, f'five players, {N} rounds: generations advance', gen5 - gen2)
print('generations reached', gen5)
# validation checks
def expect(code_wanted, body, label, ip='10.0.0.1'):
    code, r = post(body, ip); check(code == code_wanted, label, code, r)
p = get(); backdate(); good = stats(p)
expect(409, dict(token=p['token'], roundTime=30000, stats=good), "another player's token", ip='10.0.0.2')
expect(200, dict(token=p['token'], roundTime=30000, stats=good), 'valid report')
expect(409, dict(token=p['token'], roundTime=30000, stats=good), 'reused token')
expect(409, dict(token='nope', roundTime=30000, stats=good), 'unknown token')
p = get(); backdate()
def bad(mod, label, rt=30000):
    s = stats(p); mod(s); expect(422, dict(token=p['token'], roundTime=rt, stats=s), label)
bad(lambda s: s[0].update(shots=500), 'too many shots')
bad(lambda s: s[0].update(hits=s[0]['shots'] + 1), 'hits > shots')
bad(lambda s: s[0].update(age=40000), 'age > roundTime')
bad(lambda s: s[0].update(move=-1), 'negative move')
bad(lambda s: s[0].update(id=999999), 'foreign id')
bad(lambda s: s.pop(), 'missing brain')
bad(lambda s: s[1].update(id=s[0]['id']), 'duplicate id')
bad(lambda s: s[0].update(shots='5'), 'string value')
bad(lambda s: None, 'roundTime longer than elapsed', rt=10**6)
p = get()
expect(422, dict(token=p['token'], roundTime=60000, stats=stats(p, 60000)), 'not backdated: 60s round reported instantly')
expect(200, dict(token=p['token'], roundTime=5000, stats=stats(p, 5000)), 'short round right away')
sys.exit(1 if failed else 0)

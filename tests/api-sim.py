import json, random, sqlite3, sys, urllib.request
# Usage: api-sim.py <test database> <rounds>  (see tests/README.md)
DB, BASE, N = sys.argv[1], 'http://127.0.0.1:8765/api/', int(sys.argv[2])
db = sqlite3.connect(DB, isolation_level=None)
def get():
    return json.load(urllib.request.urlopen(BASE + 'population.php'))
def post(body):
    req = urllib.request.Request(BASE + 'results.php', json.dumps(body).encode(), {'Content-Type': 'application/json'})
    try:
        r = urllib.request.urlopen(req); return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)
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
gens = set()
for i in range(N):
    p = get(); backdate()
    code, r = post(dict(token=p['token'], roundTime=30000, stats=stats(p)))
    assert code == 200, (code, r)
    gens.add(r['generation'])
print('generations reached', max(gens))
# validation checks
def expect(code_wanted, body, label):
    code, r = post(body); print(('OK  ' if code == code_wanted else 'BAD ') + label, code, r)
p = get(); backdate(); good = stats(p)
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

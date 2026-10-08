const fs = require('fs'), vm = require('vm');
const ctx = { Math, console };
vm.createContext(ctx);
const root = process.argv[2];
vm.runInContext(fs.readFileSync(root + '/js/main.js', 'utf8').split('\n').slice(0, 2).join('\n').replace(/const /g, 'var '), ctx);
vm.runInContext(fs.readFileSync(root + '/js/Genetics.js', 'utf8') + ';this.Genetics = Genetics;', ctx);
const cases = [];
for (let i = 0; i < 500; i++) {
	const roundTime = Math.random() * 60000;
	const shots = Math.floor(Math.random() * (roundTime / 250 + 1)), hits = Math.floor(Math.random() * (shots + 1));
	const s = { shots, hits, friendlyFire: Math.floor(Math.random() * (shots - hits + 1)), age: Math.random() * roundTime,
		selfInjury: Math.random() * 3000 * (i % 3 == 0), move: Math.random() * roundTime };
	if (i === 0) Object.assign(s, { shots: 0, hits: 0, friendlyFire: 0 });
	const g = new ctx.Genetics();
	g.population = [{ age: s.age, hits: s.hits, shootsFired: s.shots, friendlyFire: s.friendlyFire, selfInjury: s.selfInjury, move: s.move, fitness: 0 }];
	ctx.totalTime = roundTime;
	vm.runInContext('', ctx);
	g.evaluate.call(Object.assign(g, {}));
	cases.push({ roundTime, s, js: g.population[0].fitness });
}
fs.writeFileSync(process.argv[3], JSON.stringify(cases));

// Shared evolution: bots come from the server's crowd-evolved pool and the
// raw stats of each round are reported back. On any network failure the game
// switches to local evolution (Genetics.evolve) for the rest of the session.
class Shared {

	constructor(){

		this.online = true;

		this.pending = null;

		this.token = null;

		this.generation = null;

		this.timeout = 4000;

	}


	prefetch(){

		if( !this.online || this.pending )

			return

		this.pending = fetch('api/population.php', { cache: 'no-store' })

			.then( res => res.ok ? res.json() : Promise.reject(res.status) )

			.catch( e => {

				this.online = false;

				return null;

			});

	}


	build(data){

		const enemies = data.brains.map( b => {

			const brain = genetics.createBrain();

			for(let i = 0; i < brain.layers.length; i++){

				const layer = brain.layers[i], src = b.weights.layers[i];

				layer.weights = new Matrix(layer.weights.rows, layer.weights.cols, src.w);

				layer.bias = new Matrix(layer.bias.rows, 1, src.b);

			}

			const enemy = genetics.createEnemy(b.color.slice(0, 3), brain);

			enemy.brainId = b.id;

			return enemy;

		});

		if( enemies.length !== maxEnemies )

			throw new Error('unexpected population size');

		return { token: data.token, generation: data.generation, enemies };

	}


	// Resolves with the next population's bots, or null once offline.
	take(){

		this.prefetch();

		if( !this.online )

			return Promise.resolve(null);

		const pending = this.pending;

		const timeout = new Promise( resolve => setTimeout(resolve, this.timeout, null) );

		return Promise.race([pending, timeout]).then( data => {

			this.pending = null;

			let population = null;

			try {

				population = data && this.build(data);

			} catch(e) {}

			if( !population ){

				this.online = false;

				return null;

			}

			this.token = population.token;

			this.generation = population.generation;

			this.prefetch();

			return population.enemies;

		});

	}


	report(enemies, roundTime){

		if( !this.online || !this.token )

			return

		const stats = enemies.map( e => ({

			id: e.brainId,

			shots: e.shootsFired,

			hits: e.hits,

			friendlyFire: e.friendlyFire,

			age: e.isDead ? e.age : roundTime,

			selfInjury: e.selfInjury,

			move: e.move

		}));

		const body = JSON.stringify({ token: this.token, roundTime, stats });

		this.token = null;

		fetch('api/results.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true })

			.then( res => {

				if( res.status >= 500 )

					this.online = false;

			})

			.catch( e => this.online = false );

	}

}

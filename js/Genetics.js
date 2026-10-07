class Genetics {

	constructor(populationSize, populationFeaturesSize){
	
		this.population = [];
		
		this.populationTmp = [];
		
	}

	getRandomColor(){
	
		return [Math.floor( Math.random() * 256 ),
		
						Math.floor( Math.random() * 256 ),
						
					  Math.floor( Math.random() * 256 )];
	
	}

	createBrain(){
	
		return new Dejavu([4 + 6 * maxEnemies, 6, 7], 0.1, 100);
		
	}


	copyBrain(brain){
	
		const copy = this.createBrain();
		
		for(let i = 0; i < brain.layers.length; i++){
		
			copy.layers[i].weights = brain.layers[i].weights.copy();
			
			copy.layers[i].bias = brain.layers[i].bias.copy();
			
		}
		
		return copy;
		
	}


	spawnPosition(){
	
		const margin = 60, minDistance = 200;
		
		let x, y;
		
		for(let tries = 0; tries < 50; tries++){
		
			x = margin + Math.random() * (w - margin * 2);
			
			y = margin + Math.random() * (h - margin * 2);
			
			if( !player || Math.sqrt( (x - player.pos.x)**2 + (y - player.pos.y)**2 ) > minDistance )
			
				break;
				
		}
		
		return { x, y };
		
	}


	createEnemy(color, brain){
	
		const pos = this.spawnPosition();
	
		const enemy = new Player(pos.x, pos.y, Math.random() * TWOPI, color || this.getRandomColor(), true);
		
		enemy.brain = brain || this.createBrain();
		
		return enemy;
		
	}


	createPopulation(){
	
		this.population = [];
			
		for(let i = 0; i < maxEnemies; i++){
			
			this.population.push( this.createEnemy() );
			
		}
		
	}


	divide(a, b){
	
		if(b == 0)
		
			return 0
		
		return a / b;
		
	}


	evaluate(){
	
		let totalBulletsFired = player.shootsFired;
		
		for(let i = 0; i < this.population.length; i++){
		
			totalBulletsFired += this.population[i].shootsFired;
			
		}
		
		for(let i = 0; i < this.population.length; i++){
		
			const agressive =  this.divide(this.population[i].shootsFired, totalBulletsFired);
			
			const survial = this.divide(this.population[i].age, totalTime);
			
			const hits = this.divide(this.population[i].hits, this.population[i].shootsFired);
			
			const friendlyFire = this.divide(this.population[i].friendlyFire, this.population[i].shootsFired);
			
			const selfInjury = this.divide(this.population[i].selfInjury, 40);
			
			this.population[i].fitness += agressive * 0.23;
			
			this.population[i].fitness += survial * 0.02;
			
			this.population[i].fitness += hits * 0.55;
			
			this.population[i].fitness -= friendlyFire * 0.08;
			
			this.population[i].fitness -= selfInjury * 0.12;
			
			this.population[i].fitness *= (this.population[i].move / 100);
			
			this.population[i].fitness = Math.max(0, this.population[i].fitness);
		
		}
		
	}


	selectParent(){
	
		let total = 0;
		
		for(let i = 0; i < this.populationTmp.length; i++){
		
			total += this.populationTmp[i].fitness;
			
		}
		
		let prob = Math.random() * total;
		
		for(let i = 0; i < this.populationTmp.length; i++){
		
			if( prob < this.populationTmp[i].fitness ){
			
				return this.populationTmp.splice(i,1)[0];
				
			}
			
			prob -= this.populationTmp[i].fitness
			
		}
		
		return null
		
	}


	crossOver(a, b){
		
		if( !a )
		
			a = this.createEnemy();
		
		if( !b )
		
			b = this.createEnemy();
		
	
		const color = Array(3);
		
		for(let i = 0; i < color.length; i++){
		
			if( Math.random() < 0.5 )
		
				color[i] = (a.color[i] + b.color[i]) / 2;
				
			else
			
				color[i] = Math.random() < 0.5 ? a.color[i] : b.color[i];
			
		}
	
		const child = this.createEnemy( color );
		
		for(let i = 0; i < child.brain.layers.length; i++){
		
			for(let j = 0; j < child.brain.layers[i].bias.data.length; j++){
			
				if( !(j%2) )
				
					child.brain.layers[i].bias.data[j] = a.brain.layers[i].bias.data[j];
					
				else
				
					child.brain.layers[i].bias.data[j] = b.brain.layers[i].bias.data[j];
		
			}
		
			for(let j = 0; j < child.brain.layers[i].weights.data.length; j++){
			
				if( j%2 )
				
					child.brain.layers[i].weights.data[j] = a.brain.layers[i].weights.data[j];
					
				else
				
					child.brain.layers[i].weights.data[j] = b.brain.layers[i].weights.data[j];
		
			}
			
		}
		
		return child;
		
	}


	mutate(child){
		
		if( Math.random() < 0.25 )

			child.color[ Math.floor( Math.random() * 3) ] = Math.floor( Math.random() * 256 );
		
		const rate = 0.1, strength = 0.5;
		
		for(let i = 0; i < child.brain.layers.length; i++){
		
			for(const what of ['weights', 'bias']){
			
				const genes = child.brain.layers[i][what].data;
		
				for(let j = 0; j < genes.length; j++){
				
					if( Math.random() < rate )
					
						genes[j] += (Math.random() * 2 - 1) * strength;
			
				}
				
			}
		
		}
		
		return child;
	
	}


	evolve(){
		
		this.evaluate();
	
		const newPopulation = [];
		
		const best = this.population.reduce( (a, b) => b.fitness > a.fitness ? b : a );
		
		if( best.fitness > 0 )
		
			newPopulation.push( this.createEnemy( best.color.slice(), this.copyBrain( best.brain ) ) );
		
		while( newPopulation.length < this.population.length ){
		
			this.populationTmp = this.population.slice();
			
			const a = this.selectParent();
			
			const b = this.selectParent();
			
			newPopulation.push( this.mutate( this.crossOver(a, b) ) );
			
		}
		
		this.population = newPopulation;
		
	}

	
}

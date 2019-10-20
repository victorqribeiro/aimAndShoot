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

	createPopulation(){
	
		this.population = [];
			
		for(let i = 0; i < maxEnemies; i++){
			
			const enemy = new Player(Math.random() * w, Math.random() * h, Math.random() * TWOPI, this.getRandomColor(), true);
			
			enemy.brain = new Dejavu([6 * maxEnemies, 6, 7], 0.1, 100);
		
			this.population.push( enemy );
			
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
		
		if( !a ){
		
			a = new Player( Math.random() * w, Math.random() * h, Math.random() * TWOPI, this.getRandomColor(), true);
			
			a.brain = new Dejavu([6 * maxEnemies, 6, 7], 0.1, 100);
			
		}
		
		if( !b ){
		
			b = new Player( Math.random() * w, Math.random() * h, Math.random() * TWOPI, this.getRandomColor(), true);
			
			b.brain = new Dejavu([6 * maxEnemies, 6, 7], 0.1, 100);
			
		}
		
	
		const color = Array(3);
		
		for(let i = 0; i < color.length; i++){
		
			if( Math.random() < 0.5 )
		
				color[i] = (a.color[i] + b.color[i]) / 2;
				
			else
			
				color[i] = Math.random() < 0.5 ? a.color[i] : b.color[i];
			
		}
	
		const child = new Player( Math.random() * w, Math.random() * h, Math.random() * TWOPI, color, true);
		
		child.brain = new Dejavu([6 * maxEnemies, 6, 7], 0.1, 100);
		
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
		
		for(let i = 0, end = Math.floor( Math.random() * 3); i < end; i++){
		
			child.color[ Math.floor( Math.random() * 3) ] = Math.floor( Math.random() * 256 );
			
		}
		
		const what = Math.random() > 0.5 ? 'bias' : 'weights';
		
		for(let i = 0; i < child.brain.layers.length; i++){
		
			for(let j = 0; j < child.brain.layers[i][what].data.length; j += 2){
					
				child.brain.layers[i][what].data[j] = Math.random() * 2 - 1;
			
			}
		
		}
		
		return child;
	
	}


	evolve(){
		
		this.evaluate();
	
		let newPopulation = [];
		
		for(let x = 0; x < this.population.length; x++){
		
			this.populationTmp = this.population.slice();
			
			let a = this.selectParent();
			
			let b = this.selectParent();
			
			let child = this.crossOver(a,b);
			
			if( Math.random() < 0.25 ){
			
				child = this.mutate(child);
				
			}
			
			newPopulation.push( child );
			
		}
		
		this.population = newPopulation;
		
	}

	
}

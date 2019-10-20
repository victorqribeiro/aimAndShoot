class Genetics {

	constructor(populationSize, populationFeaturesSize){
	
		this.population = [];
		
		this.populationTmp = [];
		
	}


	createPopulation(){
	
		this.population = [];
			
		while(this.population.length < maxEnemies){
			
			const r = Math.floor( Math.random() * 256 ),
						g = Math.floor( Math.random() * 256 ),
						b = Math.floor( Math.random() * 256 );
			
			let _x, _y;
			
			do{
			
				_x = Math.floor(Math.random() * (w-60))+30;
				
				_y = Math.floor(Math.random() * (h-60))+30;
				
			}while( Math.sqrt( (_x - w2)**2 + (_y - h2)**2 ) < 60);
			
			if( this.population.length < 1 ){
			
				const enemy = new Player(_x, _y, Math.random() * TWOPI, [r,g,b], true);
				
				enemy.brain = new Dejavu([6 * maxEnemies, 6, 7], 0.1, 100);
			
				this.population.push( enemy );
				
			}else{
			
				for(let i = 0; i < this.population.length; i++){
					
					const target = this.population[i];
					
					if( Math.sqrt( (_x - target.pos.x)**2 + (_y - target.pos.y)**2 ) > 60 ){
					
						const enemy = new Player(_x, _y, Math.random() * TWOPI, [r,g,b], true);
				
						enemy.brain = new Dejavu([6 * maxEnemies, 6, 7], 0.1, 100);
			
						this.population.push( enemy );
						
						break;	
					
					}
					
				}
				
			}
			
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
			
			const selfInjury = this.divide(this.population[i].selfInjury, 40)
			
			this.population[i].fitness += agressive * 0.3;
			
			this.population[i].fitness += survial * 0.2;
			
			this.population[i].fitness += hits * 0.3;
			
			this.population[i].fitness -= friendlyFire * 0.12;
			
			this.population[i].fitness -= selfInjury * 0.08;
			
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
		
	}


	crossOver(_a,_b){
		
	}


	mutate(child){
	
	}


	evolve(){
		
		this.evaluate();
	
		let newPopulation = [];
		
		for(let x = 0; x < this.population.length; x++){
		
			this.populationTmp = this.population.slice();
			
			let a = this.selectParent();
			
			let b = this.selectParent();
			
			console.log( a );
			
			console.log( b );
			
			return;
			
			let child = this.crossOver(a,b);
			
			if( Math.random() < 0.1 ){
			
				child = this.mutate(child);
				
			}
			
			newPopulation.push( child );
			
		}
		
		this.population = newPopulation;
		
	}

	
}

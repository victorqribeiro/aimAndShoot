class Dejavu {

	constructor( nn=[0] , learningRate = 0.1, iterations = 100){

		this.layers = { 'length': 0 };

		for(let i = 0; i < nn.length-1; i++){

			this.layers[i] = {};
			
			this.layers[i]['weights'] = new Matrix( nn[i+1], nn[i], "RANDOM" ) ;
			
			this.layers[i]['bias'] = new Matrix( nn[i+1], 1, "RANDOM" );
			
			this.layers[i]['activation'] = 'tanh';
			
			this.layers['length'] += 1;
			
		}
		
		this.lr = learningRate;
		
		this.it = iterations;
		
		this.activations = {
		
			'sigmoid': { 
			
				'func': x => 1 / (1 + Math.exp(-x)),
				
				'dfunc': x => x * (1 - x)
				
			},
			
			'relu': {
			
				'func': x => x < 0 ? 0 : x,
				
				'dfunc': x => x < 0 ? 0 : 1
			},
			
			'tanh': {
			
				'func': x => Math.tanh(x),
				
				'dfunc': x => 1 - (x * x)
				
			},
			
			'identity': {
			
				'func': x => x,
				
				'dfunc': x => 1
				
			}
		};		
	}

	predict(input){	
	  
		let output = ( input instanceof Matrix ) ? input : new Matrix(input.length, 1, input);
		
		for(let i = 0; i < this.layers.length; i++){

			output = this.layers[i]['weights'].multiply( output );
			
			this.layers[i]['output'] = output;
			
			this.layers[i]['output'].add( this.layers[i]['bias'] );
			
			this.layers[i]['output'].foreach( this.activations[ this.layers[i]['activation'] ]['func'] );
			
		}
	
		return this.layers[this.layers.length-1]['output'];
	
	}

	fit(inputs, labels){
	
		let it = 0;
		
		while( it < this.it ){
		
			let s = 0;
			
			this.shuffle( inputs, labels );
			
			for(let i = 0; i < inputs.length; i++){

				const input = new Matrix(inputs[i].length, 1, inputs[i]);

				this.predict( input );
				
				let output_error = new Matrix(labels[0].length, 1, labels[i]);
				
				output_error.subtract( this.layers[this.layers.length-1]['output'] );
				
				let sum = 0
				
				for(let i = 0; i < output_error.data.length; i++){
				
					sum += output_error.data[i] ** 2;
					
				}
				
				s +=  sum/this.layers[this.layers.length-1]['output'].rows;
				
				for(let i = this.layers.length-1; i >= 0; i--){
					
					let gradient = this.layers[i]['output'].copy();
					
					gradient.foreach( this.activations[ this.layers[i]['activation'] ]['dfunc'] );
					
					gradient.hadamard( output_error );
					
					gradient.scalar( this.lr );
					
					let layer = ( i ) ? this.layers[i-1]['output'].copy() : input.copy();
					
					layer.transpose();
					
					let delta = gradient.multiply( layer );
					
					this.layers[i]['weights'].add( delta );
					
					this.layers[i]['bias'].add( gradient );
					
					let error = this.layers[i]['weights'].copy();
					
					error.transpose();
					
					output_error = error.multiply( output_error );
					
				}
				
			}
			
			it++;
			
			if( !(it % 1) ) console.log( it, s );
			
		}
		
	}

	shuffle(x,y){
	
		for(let i = 0; i < y.length; i++){
		
			const pos = Math.floor( Math.random() * y.length );
			
			const tmpy = y[i];
			
			const tmpx = x[i];
			
			y[i] = y[pos];
			
			x[i] = x[pos];
			
			y[pos] = tmpy;
			
			x[pos] = tmpx;
			
		}
		
	}

	save(filename){
	
		const nn = {
		
			'layers': this.layers,
			
			'lr': this.lr,
			
			'it': this.it
			
		};
		
		const blob = new Blob([JSON.stringify(nn)], {type: 'text/json'});
		
		const link = document.createElement('a');
		
		link.href = window.URL.createObjectURL(blob);
		
		link.download = filename;
		
		link.click();
		
	}

	load(nn){
	
		this.lr = nn.lr;
		
		this.it = nn.it;
	
		for(let i = 0; i < nn.layers.length; i++){
		
			const layer = nn.layers[i];
		
			this.layers[i] = {};
			
			this.layers[i]['weights'] = new Matrix( layer['weights'].rows, layer['weights'].cols, layer['weights'].data ) ;
			
			this.layers[i]['bias'] = new Matrix( layer['bias'].rows, layer['bias'].cols, layer['bias'].data );
			
			this.layers[i]['output'] = new Matrix( layer['output'].rows, layer['output'].cols, layer['output'].data );
			
			this.layers[i]['activation'] = layer['activation'];
			
			this.layers['length'] += 1;
			
		}
		
		console.log( 'loaded' );
		
	}

}

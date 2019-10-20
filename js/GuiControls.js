class GuiControls {

	constructor(){
	
		document.body.addEventListener('touchstart', e => {
	
			e.preventDefault();
		
		});
	
		document.body.addEventListener('touchend', e => {
	
			e.preventDefault();
		
		});
	
		document.body.addEventListener('touchmove', e => {
	
			e.preventDefault();
		
		});

		this.main = document.createElement('div');
		
		this.main.id = "GuiControls";
		
		document.body.appendChild( this.main );
		
		const top = document.createElement('div');
		
		top.appendChild( this.createFire() );
		
		top.appendChild( this.createFire() );
		
		this.main.appendChild( top )
		
		const bottom = document.createElement('div');
		
		const directional = this.createDirectional();
		
		bottom.appendChild( directional );
		
		const lookAt = this.createLookAt();
		
		bottom.appendChild( lookAt );
		
		this.main.appendChild( bottom )
		
	}

	createCanvas(size){
	
		const canvas = document.createElement('canvas');
		
		canvas.width = size || 128;
		
		canvas.height = size || 128;
		
		const cd = canvas.getContext('2d');
		
		cd.beginPath();
		
		cd.arc(size/2, size/2, size/2, 0, 2 * Math.PI);
		
		cd.fillStyle = "rgba(0,0,0,0.3)"
		
		cd.fill();
		
		return canvas;
		
	}

	createDirectional(){

		const directional = this.createCanvas(128);	

		const notMove = function(){
		
			player.isMoving.right = false;

			player.isMoving.left = false;
			
			player.isMoving.up = false;

			player.isMoving.down = false;
				
		}
		
		const move = function(e){
			
			e.preventDefault();
			
			const rect = directional.getBoundingClientRect(),
			
						_x = directional.width/rect.width,
						
						_y = directional.height/rect.height;
						
			let x = (e.targetTouches[0].pageX - rect.left) * _x;
			
			let y = (e.targetTouches[0].pageY - rect.top) * _y;
			
			if( x > 64 )
			
				player.isMoving.right = true;
				
			else
			
				player.isMoving.left = true;
				
			if( y < 64 )
			
				player.isMoving.up = true;
				
			else
			
				player.isMoving.down = true;
				
		}
		
		directional.addEventListener('touchstart', e => { 
		
			move(e) 
			
		});
		
		directional.addEventListener('touchmove', e => {
		
			notMove();
			
			move(e);
			
		});
		
		directional.addEventListener('touchend', e => {

			notMove();
				
		});
		
		return directional;
	
	}

	createLookAt(){
	
		const look = this.createCanvas(128);
		
		look.addEventListener('touchmove', e => {
			
			e.preventDefault();
			
			const rect = look.getBoundingClientRect(),
						_x = look.width/rect.width,
						_y = look.height/rect.height;
						
						
			let x = (e.targetTouches[0].pageX - rect.left) * _x;
			let y = (e.targetTouches[0].pageY - rect.top) * _y;
			
			
			player.lookAt( (x/128*w)*2-w2, (y/128*h)*2-h2 );
			
		});
		
		return look;
	
	}
	
	createFire(){
	
		const btn = this.createCanvas(64);
		
			btn.addEventListener('touchstart', e => {
		
			e.preventDefault();
	
			if( isGameover ){
	
				init();
		
				return;
		
			}
		
			if( isStarting ){
	
				isStarting = false;
		
				update();
		
				return;
		
			}
	
			player.isShooting = true;
			
		});
		
		btn.addEventListener('touchend', e => {
		
			player.isShooting = false;
			
		});
		
		return btn;
	
	}

}

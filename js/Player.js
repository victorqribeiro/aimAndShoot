class Player {

	constructor(x, y, angle, color, ai = false){
	
		this.pos = {
		
			x: x || w2,
			
			y: y || h2
			
		};
		
		this.health = 10;
		
		this.angle = angle || 0;
		
		this.ai = ai;
		
		this.color = color || [0,0,0];
		
		this.size = 30;
		
		this.looking = {
		
			x: w2,
			
			y: h2
			
		}
		
		this.isMoving = {
		
			left: false,
			
			up: false,
			
			right: false,
			
			down: false
			
		}
		
		this.isShooting = false;
		
		this.velocity = 0.01;
		
		this.speed = {
		
			x: 0,
			
			y: 0
			
		};
		
		this.friction = 0.97;
		
		this.isDead = false;
		
		this.coolDownInit = 20;
		
		this.coolDown = this.coolDownInit;
		
		this.spreadInit = 5;
		
		this.spread = this.spreadInit;
		
		this.iAnim = 0;
		
		this.shootsFired = 0;
		
		this.hits = 0;
		
		this.friendlyFire = 0;
		
		this.age = 0;
		
		this.fitness = 0;
		
		this.selfInjury = 0;
		
		this.move = 0;
		
	}


	lookAt(x, y){
	
		this.looking.x = x;
		
		this.looking.y = y;
		
	}	


	update(input = null){
	
		if(this.isDead)
		
			return
			
		if(this.health <= 0){
		
			this.isDead = true
			
			this.age = (Date.now() - startTime) / 1000;
			
			return
			
		}

		if( this.ai )
		
			this.updateAI(input)

		this.angle = Math.atan2( this.looking.y - this.pos.y, this.looking.x - this.pos.x );
		
		let moved = false;
		
		if( this.isMoving.left ){
		
			this.speed.x -= this.velocity;
			
			moved = true;
			
		}
		
		if( this.isMoving.up ){
		
			this.speed.y -= this.velocity;
			
			moved = true;
			
		}
			
		if( this.isMoving.right ){
		
			this.speed.x += this.velocity;
			
			moved = true;
			
		}
			
		if( this.isMoving.down ){
		
			this.speed.y += this.velocity;
			
			moved = true;
			
		}
	
		const _x = this.speed.x * deltaTime;
		
		const _y = this.speed.y * deltaTime;
		
		if( moved )
		
			this.move += 1;

		if( this.pos.x + _x > this.size && this.pos.x + _x < w - this.size )	
		
			this.pos.x += _x;
			
		else{
		
			this.speed.x = -this.speed.x;
			
			this.selfInjury += 1;
			
			this.health -= 0.25;
			
		}
			
		if( this.pos.y + _y > this.size && this.pos.y + _y < h - this.size )	
		
			this.pos.y += _y;
			
		else{
		
			this.speed.y = -this.speed.y
			
			this.selfInjury += 1;
			
			this.health -= 0.25;
			
		}
		
		this.speed.x *= this.friction;
		
		this.speed.y *= this.friction;
		
		for(let i = 0; i < players.length; i++){
		
			if( players[i] == this || players[i].isDead )
			
				continue
			
			if( this.distance( players[i] ) <= players[i].size + this.size ) {
				
				players[i].speed.x += (this.speed.x);
				
				players[i].speed.y += (this.speed.y);
				
				this.speed.x += -players[i].speed.x;
				
				this.speed.y += -players[i].speed.y;
				
				this.speed.x *= 0.005;
				
				this.speed.y *= 0.005;
			
			}
			
		}
		
		if( this.isShooting && this.coolDown > 0 && this.spread < 1 ){
		
		  if(aPlayer.paused)
		  
		      aPlayer.play().then( _ => _ ).catch( e => e );
		      
		  else
		  
		      aPlayer.currentTime = 0
		
			this.spread = this.spreadInit;
			
			this.coolDown -= 1
			
			const targets = players.slice( 0 );
			
			targets.splice( targets.indexOf(this), 1);
			
			bullets.push( 
			
				new Bullet( this, this.pos.x + Math.cos(this.angle) * 40, this.pos.y + Math.sin(this.angle) * 40, 5, this.angle, 1.2, 1, targets) 
				
			);
			
			this.shootsFired++;
			
		}
		
		if( this.coolDown < this.coolDownInit && !this.isShooting )
		
			this.coolDown += 0.25;
		
		this.spread -= 1;

	}

	distance(target){
		
		return Math.sqrt( (this.pos.x - target.pos.x)**2 + (this.pos.y - target.pos.y)**2 );
		
	}
	
	updateAI(target){
	
		const data = Array( 6 * maxEnemies ).fill(0);
		
		let t = 0, i = 0;
		
		while(t < maxEnemies){
		
			t++;
			
			if( players[i] === this )
			
				continue
			
			data[i*5+0] = players[i].isDead ? 0 : players[i].pos.x / w;
		
			data[i*5+1] = players[i].isDead ? 0 : players[i].pos.y / h;
		
			data[i*5+2] = players[i].isDead ? 0 : players[i].looking.x / w;
		
			data[i*5+3] = players[i].isDead ? 0 : players[i].looking.y / h;
		
			data[i*5+4] = players[i].isDead ? 0 : players[i].isShooting ? 1 : 0;
			
			data[i*5+5] = players[i].isDead ? 0 : players[i].ai ? 1 : 0;
			
			i++;
			
		}
	
		const action = this.brain.predict( data	).data;
		
		action[0] > 0.5 ? this.isMoving.left = true : this.isMoving.left = false;
			
		action[1] > 0.5 ? this.isMoving.up = true : this.isMoving.up = false;
			
		action[2] > 0.5 ? this.isMoving.right = true : this.isMoving.right = false;
		
		action[3] > 0.5 ? this.isMoving.down = true : this.isMoving.down = false;
		
		this.looking.x = action[4] * w;
		
		this.looking.y = action[5] * h;
		
		action[6] > 0.5 ? this.isShooting = true : this.isShooting = false;
		
	}

	
	showHealthBar(){
	
		c.fillStyle = "red";
		
		c.fillRect(this.pos.x - 50, this.pos.y - 60, this.health * 10 , 10);
		
		c.strokeRect(this.pos.x - 50, this.pos.y - 60, 100, 10);
		
	}

	showCooldownBar(){
	
		c.fillStyle = "green";
		
		c.fillRect(this.pos.x - 50, this.pos.y - 45, Math.max(0, this.coolDown / this.coolDownInit * 100) , 10);
		
		c.strokeRect(this.pos.x - 50, this.pos.y - 45, 100, 10);
		
	}
	
	show(){
	
		if( this.isDead ){
		
			this.iAnim += 0.1
			
			c.fillStyle = "rgba("+this.color[0]+","+this.color[1]+","+this.color[2]+","+(1-this.iAnim)+")";
			
			c.beginPath();
			
			c.arc(this.pos.x, this.pos.y, this.size, 0, TWOPI);
			
			c.fill();
			
			c.save();
			
			c.translate(this.pos.x, this.pos.y);
			
			c.rotate(this.angle+this.iAnim);
			
			c.fillRect(this.iAnim*50, -9, 50, 18);
			
			c.restore();
			
			return
			
		}
		
		this.showHealthBar();
		
		this.showCooldownBar();
		
		c.fillStyle = "rgb("+this.color[0]+","+this.color[1]+","+this.color[2]+")";
		
		c.shadowColor = "black";
		
		c.shadowBlur = 5;
		
		c.save();
		
		c.translate(this.pos.x, this.pos.y);
		
		c.rotate(this.angle);
		
		c.fillRect(0, -9, 50, 18);
		
		c.restore();
		
		c.beginPath();
		
		c.arc(this.pos.x, this.pos.y, this.size, 0, TWOPI);
		
		c.fill();
		
		c.shadowBlur = 0;
		
	}

}

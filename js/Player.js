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
		
		this.coolDownInit = 10;
		
		this.coolDown = this.coolDownInit;
		
		this.coolDownRegen = 0.005;
		
		this.shotInterval = ai ? 250 : 200;
		
		this.shotTimer = 0;
		
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
			
			this.age = totalTime;
			
			return
			
		}

		if( this.ai )
		
			this.updateAI(input)

		this.angle = Math.atan2( this.looking.y - this.pos.y, this.looking.x - this.pos.x );
		
		// physics constants are tuned per 60Hz frame; scale them by elapsed time
		
		const frames = deltaTime / FRAME_MS;
		
		const accel = this.velocity * frames;
		
		let moved = false;
		
		if( this.isMoving.left ){
		
			this.speed.x -= accel;
			
			moved = true;
			
		}
		
		if( this.isMoving.up ){
		
			this.speed.y -= accel;
			
			moved = true;
			
		}
			
		if( this.isMoving.right ){
		
			this.speed.x += accel;
			
			moved = true;
			
		}
			
		if( this.isMoving.down ){
		
			this.speed.y += accel;
			
			moved = true;
			
		}
	
		const _x = this.speed.x * deltaTime;
		
		const _y = this.speed.y * deltaTime;
		
		if( moved )
		
			this.move += deltaTime;
		
		let hitWall = false;

		if( this.pos.x + _x > this.size && this.pos.x + _x < w - this.size )	
		
			this.pos.x += _x;
			
		else{
		
			this.speed.x = -this.speed.x;
			
			hitWall = true;
			
		}
			
		if( this.pos.y + _y > this.size && this.pos.y + _y < h - this.size )	
		
			this.pos.y += _y;
			
		else{
		
			this.speed.y = -this.speed.y
			
			hitWall = true;
			
		}
		
		if( hitWall ){
		
			this.selfInjury += deltaTime;
			
			this.health -= 0.25 * frames;
			
		}
		
		const friction = this.friction ** frames;
		
		this.speed.x *= friction;
		
		this.speed.y *= friction;
		
		const canShoot = !this.ai || totalTime >= gracePeriod;
		
		if( this.isShooting && canShoot && this.coolDown >= 1 && this.shotTimer <= 0 ){
		
		  if(aPlayer.paused)
		  
		      aPlayer.play().then( _ => _ ).catch( e => e );
		      
		  else
		  
		      aPlayer.currentTime = 0
		
			this.shotTimer = this.shotInterval;
			
			this.coolDown -= 1
			
			const targets = players.slice( 0 );
			
			targets.splice( targets.indexOf(this), 1);
			
			bullets.push( 
			
				new Bullet( this, this.pos.x + Math.cos(this.angle) * 40, this.pos.y + Math.sin(this.angle) * 40, 5, this.angle, 1.2, 1, targets) 
				
			);
			
			this.shootsFired++;
			
		}
		
		if( !this.isShooting )
		
			this.coolDown = Math.min(this.coolDownInit, this.coolDown + this.coolDownRegen * deltaTime);
		
		this.shotTimer -= deltaTime;

	}

	distance(target){
		
		return Math.sqrt( (this.pos.x - target.pos.x)**2 + (this.pos.y - target.pos.y)**2 );
		
	}
	
	updateAI(target){
	
		const data = Array( this.brain.layers[0].weights.cols ).fill(0);
		
		data[0] = this.pos.x / w;
		
		data[1] = this.pos.y / h;
		
		data[2] = this.health / 10;
		
		data[3] = this.coolDown / this.coolDownInit;
		
		let slot = 0;
		
		for(let i = 0; i < players.length && slot < maxEnemies; i++){
		
			const other = players[i];
			
			if( other === this )
			
				continue
				
			const offset = 4 + slot * 6;
			
			slot++;
			
			if( other.isDead )
			
				continue
			
			data[offset+0] = other.pos.x / w;
		
			data[offset+1] = other.pos.y / h;
		
			data[offset+2] = other.looking.x / w;
		
			data[offset+3] = other.looking.y / h;
		
			data[offset+4] = other.isShooting ? 1 : 0;
			
			data[offset+5] = other.ai ? 1 : 0;
			
		}
	
		const action = this.brain.predict( data ).data;
		
		this.isMoving.left = action[0] > 0;
			
		this.isMoving.up = action[1] > 0;
			
		this.isMoving.right = action[2] > 0;
		
		this.isMoving.down = action[3] > 0;
		
		this.looking.x = (action[4] + 1) / 2 * w;
		
		this.looking.y = (action[5] + 1) / 2 * h;
		
		this.isShooting = action[6] > 0;
		
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
		
		if( this.ai && totalTime < gracePeriod )
		
			c.globalAlpha = 0.3 + 0.7 * totalTime / gracePeriod;
		
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
		
		c.globalAlpha = 1;
		
	}

}

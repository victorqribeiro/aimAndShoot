class Player {

	constructor(x, y, angle, ia = false){
		this.pos = {
			x: x || w2,
			y: y || h2
		};
		this.health = 10;
		this.angle = angle || 0;
		this.ia = ia;
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
		this.coolDown = 10;
	}

	lookAt(x, y){
		this.looking.x = x;
		this.looking.y = y;
	}	

	update(input = null){
	
		if(this.isDead)
			return

		if( this.ia )
			this.updateIA(input)

		this.angle = Math.atan2( this.looking.y - this.pos.y, this.looking.x - this.pos.x );
		if( this.isMoving.left )
			this.speed.x -= this.velocity;
		if( this.isMoving.up )
			this.speed.y -= this.velocity;
		if( this.isMoving.right )
			this.speed.x += this.velocity;
		if( this.isMoving.down )
			this.speed.y += this.velocity;
	
		const _x = this.speed.x * deltaTime;
		const _y = this.speed.y * deltaTime;

		if( this.pos.x + _x > 0 && this.pos.x + _x < w )	
			this.pos.x += _x;
		else
			this.speed.x = -this.speed.x
			
		if( this.pos.y + _y > 0 && this.pos.y + _y < h )	
			this.pos.y += _y;
		else
			this.speed.y = -this.speed.y
			
		this.speed.x *= this.friction;
		this.speed.y *= this.friction;
		
		if( this.isShooting && this.coolDown < 1){
			this.coolDown = 5;
			this.isShooting = false;
			const targets = players.slice( 0 );
			targets.splice( targets.indexOf(this), 1)
			bullets.push( 
				new Bullet( this.pos.x + Math.cos(this.angle) * 40, this.pos.y + Math.sin(this.angle) * 40, 5, this.angle, 1.2, targets) 
			);
		}
		
		this.coolDown--

	}
	
	updateIA(target){
		const action = this.brain.predict( [target.pos.x / w, target.pos.y / h, target.looking.x / w, target.looking.y / h, target.isShooting ? 1 : 0 ] ).data;
		
		action[0] > 0.5 ? this.isMoving.left = true : this.isMoving.left = false;
			
		action[1] > 0.5 ? this.isMoving.up = true : this.isMoving.up = false;
			
		action[2] > 0.5 ? this.isMoving.right = true : this.isMoving.right = false;
		
		action[3] > 0.5 ? this.isMoving.down = true : this.isMoving.down = false;
		
		this.looking.x = action[4] * w;
		
		this.looking.y = action[5] * h;
		
		action[6] > 0.5 ? this.isShooting = true : this.isShooting = false;
		
	}
	
	show(c){
		c.fillStyle = "red";
		c.fillRect(this.pos.x - 50, this.pos.y - 60, this.health * 10 , 10);
		c.strokeRect(this.pos.x - 50, this.pos.y - 60, 100, 10);
		c.fillStyle = "black";
		c.beginPath();
		c.arc(this.pos.x, this.pos.y, this.size, 0, TWOPI);
		c.fill();
		c.save();
		c.translate(this.pos.x, this.pos.y);
		c.rotate(this.angle);
		c.fillRect(0, -9, 50, 18);
		c.restore();
	}

}

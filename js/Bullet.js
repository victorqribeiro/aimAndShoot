class Bullet {

	constructor(owner, x, y, size, angle, speed, damage, targets = []){
	
		this.pos = {
		
			x: x || 0,
			
			y: y || 0
			
		};
		
		this.owner = owner || null;
		
		this.size = size || 5;
		
		this.angle = angle || 0;
		
		this.speed = speed || 0;
		
		this.damage = damage || 1;
		
		this.isGone = false;
		
		this.targets = targets;
		
	}


	update(){
	
		if( this.isGone )
		
			return
	
	
		if( this.pos.x < -this.size || this.pos.y < -this.size || this.pos.x > w+this.size || this.pos.y > h+this.size ){
		
			this.isGone = true;
			
			return;
			
		}
		
		this.pos.x += Math.cos(this.angle) * this.speed * deltaTime;
		
		this.pos.y += Math.sin(this.angle) * this.speed * deltaTime;
		
		for(let i = this.targets.length-1; i >= 0; i--){
		
				if(this.targets[i].isDead)
				
					continue
					
				if( this.distance( this.targets[i] ) < this.targets[i].size+this.size ){
				
					if(this.owner.ai !== this.targets[i].ai)
					
						this.owner.hits++;
						
					else
					
						this.owner.friendlyFire++;
					
					this.targets[i].speed.x += Math.cos(this.angle) * 0.1;
					
					this.targets[i].speed.y += Math.sin(this.angle) * 0.1;
					
					this.targets[i].health -= this.damage;
					
					this.isGone = true;
					
					break;
					
				}
				
		}
		
	}


	distance(target){
	
		return Math.abs(this.pos.x - target.pos.x) + Math.abs(this.pos.y - target.pos.y);
		
	}


	show(){
	
		c.fillStyle = "black";
		
		c.beginPath();
		
		c.arc(this.pos.x, this.pos.y, this.size, 0, TWOPI);
		
		c.fill();
		
	}
	
}

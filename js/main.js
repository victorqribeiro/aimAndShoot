let canvas, c, w, h, w2, h2, TWOPI, player, enemies, bullets, players, prevTime, nextTime, deltaTime, isGameover;

const init = function(){

	isGameover = false;

	const oldCanvas = document.querySelector('canvas');
	
		if( oldCanvas )
		
			oldCanvas.remove();
			
	canvas = document.createElement('canvas');
	canvas.width = w = innerWidth;
	canvas.height = h = innerHeight;
	w2 = w/2;
	h2 = h/2;
	TWOPI = Math.PI * 2;
	prevTime = nextTime = deltaTime = Date.now();
	c = canvas.getContext('2d');
	c.font = "25px Arial";
	c.textAlign = "center";

	document.body.appendChild(canvas);

	player = new Player();

	enemies = Array();

	bullets = Array();

	for(let i = 0; i < 3; i++){
		const enemy = new Player(Math.random() * w, Math.random() * h, Math.random() * TWOPI, true);
		enemy.brain = new Dejavu([5, 6, 7], 0.1, 100);
		enemies.push( enemy );
	}

	players = [player, ...enemies];
	
	update();
}


const update = function(){
	nextTime = Date.now();
	deltaTime = nextTime - prevTime;
	for(let i = bullets.length-1; i >= 0; i--){
		bullets[i].update();
		if( bullets[i].isGone )
			bullets.splice(i, 1)
	}
	for(let i = players.length-1; i >= 0 ; i--){
		players[i].update(player);
		if( players[i].isDead && players[i].iAnim >= 1 )
			players.splice(i, 1)
	}
	draw();
	if( player.isDead )
		return gameover()
	requestAnimationFrame( update );
	prevTime = nextTime;
}

const gameover = function(){
	let i = 0;
	const drawGameover = function(){
		c.fillStyle = "rgba(0,0,0,"+(i += 0.01)+")";
		c.fillRect(0,0,w,h)
		c.fillStyle = "white";
		c.fillText("You have failed the human race.", w2, h2-25);
		c.fillText("You should move to mars or something.", w2, h2+25);
		if( i <= 1 ){
			requestAnimationFrame( drawGameover )
		}else{
			c.fillText("Click to try again.", w2, h2/2);
			isGameover = true;
		}
	}
	drawGameover()
}

const draw = function(){
	c.clearRect(0, 0, w, h);
	for(let i = 0; i < players.length; i++){
		players[i].show();
	}
	for(let i = 0; i < bullets.length; i++){
		bullets[i].show();
	}
}

document.body.addEventListener('mousemove', e => {
	player.lookAt(e.clientX, e.clientY);
});

document.body.addEventListener('keydown', e => {
	e.preventDefault();
	switch(e.keyCode){
		case 65 :
				player.isMoving.left = true;
			break;
		case 87 :
				player.isMoving.up = true;
			break;
		case 68 :
				player.isMoving.right = true;
			break;
		case 83 :
				player.isMoving.down = true;
			break;
	}
});

init();

document.body.addEventListener('keyup', e => {
	e.preventDefault();
	switch(e.keyCode){
		case 65 :
				player.isMoving.left = false;
			break;
		case 87 :
				player.isMoving.up = false;
			break;
		case 68 :
				player.isMoving.right = false;
			break;
		case 83 :
				player.isMoving.down = false;
			break;
	}
});

document.body.addEventListener('mousedown', e => {
	e.preventDefault();
	player.isShooting = true;
	if( isGameover )
		init();
});

window.onresize = _ => init();

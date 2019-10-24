let artwork, canvas, rect, _x, _y,  c, w, h, w2, h2, TWOPI, genetics, player, enemies, bullets, players, prevTime, nextTime, deltaTime, startTime, totalTime, isGameover, u, aPlayer, maxEnemies, generation = 1, isStarting = true;

const init = function(){

	maxEnemies = 7;

	isGameover = false;

	const oldCanvas = document.querySelector('#game');

		if( oldCanvas )

			oldCanvas.remove();

		else

			addEventsListener();

	canvas = document.createElement('canvas');

	canvas.id = "game";

	canvas.width = w = 1366;

	canvas.height = h = 768;

	w2 = w/2;

	h2 = h/2;

	TWOPI = Math.PI * 2;

	prevTime = nextTime = deltaTime = startTime = Date.now();

	totalTime = 0;

	c = canvas.getContext('2d');

	c.font = "25px Arial";

	c.textAlign = "center";

	document.body.appendChild(canvas);

	rect = canvas.getBoundingClientRect();

	_x = w/rect.width;

	_y = h/rect.height;

	genetics = new Genetics();

	genetics.createPopulation();

	player = new Player();

	enemies = genetics.population.slice();

	bullets = Array();

	players = [player, ...enemies];

	if( isStarting ){

		startScreen();

	}else{

		update();

	}

}


const update = function(){

	nextTime = Date.now();

	deltaTime = nextTime - prevTime;

	totalTime += deltaTime;

	for(let i = bullets.length-1; i >= 0; i--){

		bullets[i].update();

		if( bullets[i].isGone )

			bullets.splice(i, 1)

	}

	for(let i = players.length-1; i >= 0 ; i--){

		if( !players[i].isDead )

			players[i].update(player);

	}

	draw();

	if( player.isDead ){

		gameover()

		return

	}

	let allDead = true;

	for(let i = 0; i < enemies.length; i++ ){

		if( !enemies[i].isDead ){

			allDead = false;

			break;

		}

	}

	if( allDead ){

		endRound()

		return

	}

	prevTime = nextTime;

	u = requestAnimationFrame( update );

}


const draw = function(){

	c.clearRect(0, 0, w, h);

	for(let i = 0; i < bullets.length; i++){

		bullets[i].show();

	}

	for(let i = 0; i < players.length; i++){

		if( !players[i].isDead )

			players[i].show();

	}

	c.textAlign = "start";

	c.fillStyle = "black";

	c.fillText("Generation: "+generation, 10, 30 )

	c.textAlign = "center";

}

const endRound = function(){

	totalTime = (Date.now() - startTime) / 1000;

	genetics.evolve();

	enemies = genetics.population.slice();

	players = [player, ...enemies];

	startTime = Date.now();

	generation += 1;

	player.health = Math.min(10, player.health + player.health * 0.15)

	update();

}

const startScreen = function(){

	c.clearRect(0,0,w,h);

	c.drawImage(artwork, 0, 0, artwork.width, artwork.height, 0, 0, w, h);

	c.fillColor = "black";

	c.fillText("Click to Start", w-w2/2, h2 )

}

const gameover = function(){

	if(u)

		cancelAnimationFrame(u)

	generation = 1;

	let i = 0;

	const drawGameover = function(){

		c.fillStyle = "rgba(0,0,0,"+(i += 0.01)+")";

		c.fillRect(0,0,w,h);

		c.fillStyle = "white";

		c.fillText("You have failed the human race.", w2, h2-25);

		c.fillText("You should move to mars or something.", w2, h2+25);

		if( i <= 1 ){

			requestAnimationFrame( drawGameover );

		}else{

			c.fillText("Click to try again.", w2, h2/2);

			isGameover = true;

		}

	}

	drawGameover();

}

const addEventsListener = function(){

	document.body.addEventListener('mousemove', e => {

		player.lookAt(e.clientX * _x, e.clientY * _y);

	});


	document.body.addEventListener('keydown', e => {

		e.preventDefault();

		switch(e.keyCode){

			case 37 :
			case 65 :

					player.isMoving.left = true;

				break;

			case 38 :
			case 87 :

					player.isMoving.up = true;

				break;

			case 39 :
			case 68 :

					player.isMoving.right = true;

				break;

			case 40 :
			case 83 :

					player.isMoving.down = true;

				break;
		}

	});


	document.body.addEventListener('keyup', e => {

		e.preventDefault();

		switch(e.keyCode){

			case 37 :
			case 65 :

					player.isMoving.left = false;

				break;

			case 38 :
			case 87 :

					player.isMoving.up = false;

				break;

			case 39 :
			case 68 :

					player.isMoving.right = false;

				break;

			case 40 :
			case 83 :

					player.isMoving.down = false;

				break;
		}

	});


	document.body.addEventListener('mouseup', e => {

		e.preventDefault();

		player.isShooting = false;

	});

	document.body.addEventListener('mousedown', e => {

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

	window.onresize = _ => {

		if(u)

			cancelAnimationFrame(u)

		isStarting = true;

		init();

	}

}

aPlayer = document.createElement('audio');

aPlayer.src = "sounds/shoot.mp3";

artwork = new Image();

artwork.src = "artwork.png";

artwork.onload = _ => {

	init();

	if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ){

		const control = new GuiControls();

	}

}

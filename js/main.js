// stats are kept in ms; the fitness divisors match the old per-frame values at 60Hz
const FRAME_MS = 1000 / 60, MOVE_MS = 100 * FRAME_MS, WALL_MS = 40 * FRAME_MS;

let artwork, canvas, scale, offsetX, offsetY, hud, portrait, c, w, h, w2, h2, TWOPI, genetics, player, enemies, bullets, players, prevTime, nextTime, deltaTime, totalTime, isGameover, gameoverScreen, u, aPlayer, maxEnemies, gracePeriod, round = 1, hudText, hudRect, isStarting = true;

const shared = new Shared();

shared.prefetch();

const init = function(){

	maxEnemies = 7;

	gracePeriod = 1500;

	isGameover = false;

	const oldCanvas = document.querySelector('#game');

		if( oldCanvas )

			oldCanvas.remove();

		else

			addEventsListener();

	canvas = document.createElement('canvas');

	canvas.id = "game";

	w = 1366;

	h = 768;

	w2 = w/2;

	h2 = h/2;

	TWOPI = Math.PI * 2;

	prevTime = nextTime = deltaTime = Date.now();

	totalTime = 0;

	c = canvas.getContext('2d');

	document.body.appendChild(canvas);

	fitCanvas();

	player = new Player();

	genetics = new Genetics();

	enemies = [];

	bullets = Array();

	players = [player];

	if( isStarting ){

		startScreen();

	}else{

		startRound();

	}

}


const fitCanvas = function(){

	scale = Math.min(window.innerWidth / w, window.innerHeight / h);

	const cssWidth = w * scale, cssHeight = h * scale;

	offsetX = (window.innerWidth - cssWidth) / 2;

	offsetY = (window.innerHeight - cssHeight) / 2;

	canvas.style.width = cssWidth + "px";

	canvas.style.height = cssHeight + "px";

	canvas.style.left = offsetX + "px";

	canvas.style.top = offsetY + "px";

	hud.style.left = offsetX + "px";

	hud.style.top = offsetY + "px";

	hudRect = null;

	const dpr = window.devicePixelRatio || 1;

	canvas.width = Math.round(cssWidth * dpr);

	canvas.height = Math.round(cssHeight * dpr);

	c.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);

	c.font = "25px Arial";

	c.textAlign = "center";

}

const resolveCollisions = function(){

	const restitution = 0.8;

	for(let i = 0; i < players.length; i++){

		const a = players[i];

		if( a.isDead )

			continue

		for(let j = i + 1; j < players.length; j++){

			const b = players[j];

			if( b.isDead )

				continue

			let dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;

			let dist = Math.sqrt(dx * dx + dy * dy);

			const minDist = a.size + b.size;

			if( dist >= minDist )

				continue

			if( dist === 0 ){

				const angle = Math.random() * TWOPI;

				dx = Math.cos(angle);

				dy = Math.sin(angle);

				dist = 1;

			}

			const nx = dx / dist, ny = dy / dist;

			const push = (minDist - dist) / 2;

			a.pos.x -= nx * push;

			a.pos.y -= ny * push;

			b.pos.x += nx * push;

			b.pos.y += ny * push;

			const approach = (b.speed.x - a.speed.x) * nx + (b.speed.y - a.speed.y) * ny;

			if( approach < 0 ){

				const impulse = -(1 + restitution) * approach / 2;

				a.speed.x -= impulse * nx;

				a.speed.y -= impulse * ny;

				b.speed.x += impulse * nx;

				b.speed.y += impulse * ny;

			}

			keepInside(a);

			keepInside(b);

		}

	}

}

const keepInside = function(p){

	p.pos.x = Math.min(Math.max(p.pos.x, p.size + 1), w - p.size - 1);

	p.pos.y = Math.min(Math.max(p.pos.y, p.size + 1), h - p.size - 1);

}

const update = function(){

	if( portrait.matches ){

		prevTime = Date.now();

		u = requestAnimationFrame( update );

		return

	}

	nextTime = Date.now();

	deltaTime = Math.min(nextTime - prevTime, 50);

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

	resolveCollisions();

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

			players[i].show();

	}

	c.lineWidth = 6;

	c.strokeStyle = "#c0392b";

	c.strokeRect(3, 3, w - 6, h - 6);

	c.lineWidth = 1;

	c.strokeStyle = "black";

	updateHud();

}

const updateHud = function(){

	hud.hidden = false;

	const text = shared.online && shared.generation ?

		"Generation " + shared.generation.toLocaleString() + " · Round " + round :

		"Generation: " + round;

	if( text !== hudText ){

		hud.textContent = hudText = text;

		hudRect = null;

	}

	if( !hudRect ){

		const r = hud.getBoundingClientRect();

		hudRect = {

			left: (r.left - offsetX) / scale,

			top: (r.top - offsetY) / scale,

			right: (r.right - offsetX) / scale,

			bottom: (r.bottom - offsetY) / scale

		};

	}

	// fade the HUD while a player or its status bars are under it

	const covered = players.some( p => !p.isDead &&

		p.pos.x + 50 > hudRect.left && p.pos.x - 50 < hudRect.right &&

		p.pos.y + p.size > hudRect.top && p.pos.y - 60 < hudRect.bottom );

	hud.classList.toggle('faded', covered);

}

// Next bots: the shared population if the server answers, otherwise local evolution.
const nextPopulation = function(fresh){

	drawLoading();

	return shared.take().then( sharedEnemies => {

		if( sharedEnemies )

			genetics.population = sharedEnemies;

		else if( fresh || !genetics.population.length )

			genetics.createPopulation();

		else

			genetics.evolve();

	});

}

const beginRound = function(){

	totalTime = 0;

	enemies = genetics.population.slice();

	players = [player, ...enemies];

	prevTime = Date.now();

	update();

}

const startRound = function(){

	nextPopulation(true).then( beginRound );

}

const endRound = function(){

	shared.report(enemies, totalTime);

	round += 1;

	player.health = Math.min(10, player.health + player.health * 0.15)

	nextPopulation(false).then( beginRound );

}

const drawLoading = function(){

	draw();

	c.fillStyle = "black";

	c.fillText("Loading bots...", w2, h2 - 80);

}

const startScreen = function(){

	c.clearRect(0,0,w,h);

	c.drawImage(artwork, 0, 0, artwork.width, artwork.height, 0, 0, w, h);

	hud.hidden = true;

	c.fillStyle = "black";

	c.fillText("Click to Start", w-w2/2, h2 )

}

const gameover = function(){

	if(u)

		cancelAnimationFrame(u)

	shared.report(enemies, totalTime);

	round = 1;

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

	gameoverScreen = function(){

		i = 1;

		drawGameover();

	}

	drawGameover();

}

const addEventsListener = function(){

	document.body.addEventListener('mousemove', e => {

		player.lookAt((e.clientX - offsetX) / scale, (e.clientY - offsetY) / scale);

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

			startRound();

			return;

		}

		player.isShooting = true;

	});

	window.onresize = _ => {

		fitCanvas();

		if( isStarting )

			startScreen();

		else if( isGameover )

			gameoverScreen();

	}

}

hud = document.createElement('div');

hud.id = "hud";

hud.hidden = true;

document.body.appendChild(hud);

portrait = window.matchMedia("(orientation: portrait) and (pointer: coarse)");

const canLockLandscape = !!(document.documentElement.requestFullscreen && screen.orientation && screen.orientation.lock);

const lockLandscape = function(){

	if( !canLockLandscape || document.fullscreenElement )

		return

	document.documentElement.requestFullscreen()

		.then( _ => screen.orientation.lock('landscape') )

		.catch( e => e );

}

if( canLockLandscape ){

	const rotate = document.getElementById('rotate');

	rotate.textContent += " Or tap here to switch.";

	rotate.addEventListener('touchend', lockLandscape);

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

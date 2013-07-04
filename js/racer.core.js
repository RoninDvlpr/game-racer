//define([], function () {

var fps            = 60;                      // how many 'update' frames per second
var step           = 1/fps;                   // how long is each frame (in seconds)
var centrifugal    = 0.3;                     // centrifugal force multiplier when going around curves
var offRoadDecel   = 0.99;                    // speed multiplier when off road (e.g. you lose 2% speed each update frame)
var skySpeed       = 0.001;                   // background sky layer scroll speed when going around curve (or up hill)
var hillSpeed      = 0.002;                   // background hill layer scroll speed when going around curve (or up hill)
var treeSpeed      = 0.003;                   // background tree layer scroll speed when going around curve (or up hill)
var skyOffset      = 0;                       // current sky scroll offset
var hillOffset     = 0;                       // current hill scroll offset
var treeOffset     = 0;                       // current tree scroll offset
var segments       = [];                      // array of road segments
var cars           = [];                      // array of cars on the road
var background     = null;                    // our background image (loaded below)
var sprites        = null;                    // our spritesheet (loaded below)
var resolution     = null;                    // scaling factor to provide resolution independence (computed)
var roadWidth      = 2000;                    // actually half the roads width, easier math if the road spans from -roadWidth to +roadWidth
var segmentLength  = 200;                     // length of a single segment
var rumbleLength   = 3;                       // number of segments per red/white rumble strip
var trackLength    = null;                    // z length of entire track (computed)
var lanes          = 3;                       // number of lanes
var camera         = {
  fieldOfView      : 100,                     // angle (degrees) for field of view
  height           : 1000,                    // z height of camera
  depth            : null,                    // z distance camera is from screen (computed)
  playerZ          : null,                    // player relative z distance from camera (computed)
  drawDistance     : 300,                     // number of segments to draw
  fogDensity       : 1                        // exponential fog density
}
var player = {
  x                : 0,                       // player x offset from center of road (-1 to 1 to stay independent of roadWidth)
  z                : 0,                       // current camera Z position (add camera.playerZ to get player's absolute Z position)
  dx               : 0,                       // current horizontal velocity
  speed            : 0                        // current speed
}
var maxSpeed       = segmentLength/step;      // top speed (ensure we can't move more than 1 segment in a single frame to make collision detection easier)
var accel          =  maxSpeed/5;             // acceleration rate - tuned until it 'felt' right
var breaking       = -maxSpeed;               // deceleration rate when braking
var decel          = -maxSpeed/5;             // 'natural' deceleration rate when neither accelerating, nor braking
var offRoadDecel   = -maxSpeed/2;             // off road deceleration is somewhere in between
var offRoadLimit   =  maxSpeed/4;             // limit when off road deceleration no longer applies (e.g. you can always go at least this speed even when off road)
var totalCars      = 10;                      // total number of cars on the road
var currentLapTime = 0;                       // current lap time
var lastLapTime    = null;                    // last lap time
var lap            = 1;
var numLaps        = 3;
var numRacers      = 6;
var carsPassed     = 0;                       // net cars passed (if they pass you, -1, you pass them, +1)

var keyLeft        = false;
var keyRight       = false;
var keyFaster      = false;
var keySlower      = false;

var racer;

//=========================================================================
// UPDATE THE GAME WORLD
//=========================================================================
function update(dt) {

  var n, car, carW, sprite, spriteW;
  var playerSegment = findSegment(player.z+camera.playerZ);
  var playerW       = SPRITES.CAR_STRAIGHT.w * SPRITES.SCALE;
  var speedPercent  = player.speed/maxSpeed;
  var dx            = dt * 2 * speedPercent; // at top speed, should be able to cross from left to right (-1 to 1) in 1 second
  startPosition = player.z;

  updateCars(dt, playerSegment, playerW);

  player.z = Util.increase(player.z, dt * player.speed, trackLength);

  if (keyLeft)
    player.x = player.x - dx;
  else if (keyRight)
    player.x = player.x + dx;

  player.x = player.x - (dx * speedPercent * playerSegment.curve * centrifugal);

  if (keyFaster)
    player.speed = Util.accelerate(player.speed, accel, dt);
  else if (keySlower)
    player.speed = Util.accelerate(player.speed, breaking, dt);
  else
    player.speed = Util.accelerate(player.speed, decel, dt);


  if ((player.x < -1) || (player.x > 1)) {

    if (player.speed > offRoadLimit)
      player.speed = Util.accelerate(player.speed, offRoadDecel, dt);

    for(n = 0 ; n < playerSegment.sprites.length ; n++) {
      sprite  = playerSegment.sprites[n];
      spriteW = sprite.source.w * SPRITES.SCALE;
      if (Util.overlap(player.x, playerW, sprite.offset + spriteW/2 * (sprite.offset > 0 ? 1 : -1), spriteW)) {
        player.speed = maxSpeed/5;
        player.z = Util.increase(playerSegment.p1.world.z, -camera.playerZ, trackLength); // stop in front of sprite (at front of segment)
        break;
      }
    }
  }

  for(n = 0 ; n < playerSegment.cars.length ; n++) {
    car  = playerSegment.cars[n];
    carW = car.sprite.w * SPRITES.SCALE;
    if (player.speed > car.speed) {
      if (Util.overlap(player.x, playerW, car.offset, carW, 0.8)) {
        player.speed    = car.speed * (car.speed/speed);
        player.z = Util.increase(car.z, -camera.playerZ, trackLength);
        break;
      }
    }
  }

  player.x = Util.limit(player.x, -3, 3);     // dont ever let it go too far out of bounds
  player.speed   = Util.limit(player.speed, 0, maxSpeed); // or exceed maxSpeed

  skyOffset  = Util.increase(skyOffset,  skySpeed  * playerSegment.curve * (player.z-startPosition)/segmentLength, 1);
  hillOffset = Util.increase(hillOffset, hillSpeed * playerSegment.curve * (player.z-startPosition)/segmentLength, 1);
  treeOffset = Util.increase(treeOffset, treeSpeed * playerSegment.curve * (player.z-startPosition)/segmentLength, 1);

  if (player.z > camera.playerZ) {
    if (currentLapTime && (startPosition < camera.playerZ)) {
      lastLapTime    = currentLapTime;
      currentLapTime = 0;
      lap++;
      console.log(lap)
    }
    else {
      currentLapTime += dt;
    }
  }
}

//-------------------------------------------------------------------------

function updateCars(dt, playerSegment, playerW) {
  var n, car, oldSegment, newSegment;
  for(n = 0 ; n < cars.length ; n++) {
    car         = cars[n];
    oldSegment  = findSegment(car.z);
    car.offset  = car.offset + updateCarOffset(car, oldSegment, playerSegment, playerW);
    car._z      = car.z;
    car.z       = Util.increase(car.z, dt * car.speed, trackLength);
    car.percent = Util.percentRemaining(car.z, segmentLength); // useful for interpolation during rendering phase
    newSegment  = findSegment(car.z);
    if (oldSegment != newSegment) {
      index = oldSegment.cars.indexOf(car);
      oldSegment.cars.splice(index, 1);
      newSegment.cars.push(car);
    }
    if(car.z<car._z) car.lap++;
    //checkPlace(car,camera.playerZ)
  }
}
var xyz=0;
function checkPlace(car) {
  if(car.z%trackLength > player.z%trackLength && car._z%trackLength < player.z%trackLength && car.speed > player.speed) {
    carsPassed--;
    console.log(car.z%trackLength, player.z%trackLength,car._z%trackLength)
  }
  if(car.z%trackLength < player.z%trackLength && car._z%trackLength > player.z%trackLength && car.speed < player.speed) {
    carsPassed++;
    console.log(car.z%trackLength, player.z%trackLength,car._z%trackLength)
  }
}

function updateCarOffset(car, carSegment, playerSegment, playerW) {

  var i, j, dir, segment, otherCar, otherCarW, lookahead = 20, carW = car.sprite.w * SPRITES.SCALE;

  // optimization, dont bother steering around other cars when 'out of sight' of the player
  if ((carSegment.index - playerSegment.index) > camera.drawDistance)
    return 0;

  for(i = 1 ; i < lookahead ; i++) {
    segment = segments[(carSegment.index+i)%segments.length];

    if ((segment === playerSegment) && (car.speed > player.speed) && (Util.overlap(player.x, playerW, car.offset, carW, 1.2))) {
      if (player.x > 0.5)
        dir = -1;
      else if (player.x < -0.5)
        dir = 1;
      else
        dir = (car.offset > player.x) ? 1 : -1;
      return dir * 1/i * (car.speed-player.speed)/maxSpeed; // the closer the cars (smaller i) and the greated the speed ratio, the larger the offset
    }

    for(j = 0 ; j < segment.cars.length ; j++) {
      otherCar  = segment.cars[j];
      otherCarW = otherCar.sprite.w * SPRITES.SCALE;
      if ((car.speed > otherCar.speed) && Util.overlap(car.offset, carW, otherCar.offset, otherCarW, 1.2)) {
        if (otherCar.offset > 0.5)
          dir = -1;
        else if (otherCar.offset < -0.5)
          dir = 1;
        else
          dir = (car.offset > otherCar.offset) ? 1 : -1;
        return dir * 1/i * (car.speed-otherCar.speed)/maxSpeed;
      }
    }
  }

  // if no cars ahead, but I have somehow ended up off road, then steer back on
  if (car.offset < -0.9)
    return 0.1;
  else if (car.offset > 0.9)
    return -0.1;
  else
    return 0;
}

function findSegment(z) {
  return segments[Math.floor(z/segmentLength) % segments.length]; 
}

//=========================================================================
// BUILD ROAD GEOMETRY
//=========================================================================

function lastY() { return (segments.length == 0) ? 0 : segments[segments.length-1].p2.world.y; }

function addSegment(curve, y) {
  var n = segments.length;
  segments.push({
      index: n,
         p1: { world: { y: lastY(), z:  n   *segmentLength }, camera: {}, screen: {} },
         p2: { world: { y: y,       z: (n+1)*segmentLength }, camera: {}, screen: {} },
      curve: curve,
    sprites: [],
       cars: [],
      color: Math.floor(n/rumbleLength)%2 ? COLORS.DARK : COLORS.LIGHT
  });
}

function addSprite(n, sprite, offset) {
  segments[n].sprites.push({ source: sprite, offset: offset });
}

function addRoad(enter, hold, leave, curve, y) {
  var startY   = lastY();
  var endY     = startY + (Util.toInt(y, 0) * segmentLength);
  var n, total = enter + hold + leave;
  for(n = 0 ; n < enter ; n++)
    addSegment(Util.easeIn(0, curve, n/enter), Util.easeInOut(startY, endY, n/total));
  for(n = 0 ; n < hold  ; n++)
    addSegment(curve, Util.easeInOut(startY, endY, (enter+n)/total));
  for(n = 0 ; n < leave ; n++)
    addSegment(Util.easeInOut(curve, 0, n/leave), Util.easeInOut(startY, endY, (enter+hold+n)/total));
}

var ROAD = {
  LENGTH: { NONE: 0, SHORT:  25, MEDIUM:   50, LONG:  100 },
  HILL:   { NONE: 0, LOW:    20, MEDIUM:   40, HIGH:   60 },
  CURVE:  { NONE: 0, EASY:    2, MEDIUM:    4, HARD:    6 }
};

function addStraight(num) {
  num = num || ROAD.LENGTH.MEDIUM;
  addRoad(num, num, num, 0, 0);
}

function addHill(num, height) {
  num    = num    || ROAD.LENGTH.MEDIUM;
  height = height || ROAD.HILL.MEDIUM;
  addRoad(num, num, num, 0, height);
}

function addCurve(num, curve, height) {
  num    = num    || ROAD.LENGTH.MEDIUM;
  curve  = curve  || ROAD.CURVE.MEDIUM;
  height = height || ROAD.HILL.NONE;
  addRoad(num, num, num, curve, height);
}
    
function addLowRollingHills(num, height) {
  num    = num    || ROAD.LENGTH.SHORT;
  height = height || ROAD.HILL.LOW;
  addRoad(num, num, num,  0,                height/2);
  addRoad(num, num, num,  0,               -height);
  addRoad(num, num, num,  ROAD.CURVE.EASY,  height);
  addRoad(num, num, num,  0,                0);
  addRoad(num, num, num, -ROAD.CURVE.EASY,  height/2);
  addRoad(num, num, num,  0,                0);
}

function addSCurves() {
  addRoad(ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM,  -ROAD.CURVE.EASY,    ROAD.HILL.NONE);
  addRoad(ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM,   ROAD.CURVE.MEDIUM,  ROAD.HILL.MEDIUM);
  addRoad(ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM,   ROAD.CURVE.EASY,   -ROAD.HILL.LOW);
  addRoad(ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM,  -ROAD.CURVE.EASY,    ROAD.HILL.MEDIUM);
  addRoad(ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM, ROAD.LENGTH.MEDIUM,  -ROAD.CURVE.MEDIUM, -ROAD.HILL.MEDIUM);
}

function addBumps() {
  addRoad(10, 10, 10, 0,  5);
  addRoad(10, 10, 10, 0, -2);
  addRoad(10, 10, 10, 0, -5);
  addRoad(10, 10, 10, 0,  8);
  addRoad(10, 10, 10, 0,  5);
  addRoad(10, 10, 10, 0, -7);
  addRoad(10, 10, 10, 0,  5);
  addRoad(10, 10, 10, 0, -2);
}

function addDownhillToEnd(num) {
  num = num || 200;
  addRoad(num, num, num, -ROAD.CURVE.EASY, -lastY()/segmentLength);
}

function resetRoad() {
  segments = [];

  addStraight(ROAD.LENGTH.SHORT);
  /*addLowRollingHills();
  addSCurves();
  addCurve(ROAD.LENGTH.MEDIUM, ROAD.CURVE.MEDIUM, ROAD.HILL.LOW);
  addBumps();
  addLowRollingHills();
  addCurve(ROAD.LENGTH.LONG*2, ROAD.CURVE.MEDIUM, ROAD.HILL.MEDIUM);
  addStraight();
  addHill(ROAD.LENGTH.MEDIUM, ROAD.HILL.HIGH);
  addSCurves();
  addCurve(ROAD.LENGTH.LONG, -ROAD.CURVE.MEDIUM, ROAD.HILL.NONE);
  addHill(ROAD.LENGTH.LONG, ROAD.HILL.HIGH);
  addCurve(ROAD.LENGTH.LONG, ROAD.CURVE.MEDIUM, -ROAD.HILL.LOW);
  addBumps();
  addHill(ROAD.LENGTH.LONG, -ROAD.HILL.MEDIUM);
  addStraight();*/
  addSCurves();
  addDownhillToEnd();

  resetSprites();
  resetCars();

  segments[findSegment(camera.playerZ).index + 2].color = COLORS.START;
  segments[findSegment(camera.playerZ).index + 3].color = COLORS.START;
  for(var n = 0 ; n < rumbleLength ; n++)
    segments[segments.length-1-n].color = COLORS.FINISH;

  trackLength = segments.length * segmentLength;
}

function resetSprites() {
  var n, i;

  addSprite(20,  SPRITES.BILLBOARD, -1.2);
  addSprite(60,  SPRITES.BILLBOARD, -1.2);
  addSprite(100, SPRITES.BILLBOARD, -1.2);
  addSprite(140, SPRITES.BILLBOARD, -1.2);
  addSprite(180, SPRITES.BILLBOARD, -1.2);

  addSprite(240,                  SPRITES.BILLBOARD, -1.2);
  addSprite(240,                  SPRITES.BILLBOARD,  1.2);
  addSprite(segments.length - 25, SPRITES.BILLBOARD, -1.2);
  addSprite(segments.length - 25, SPRITES.BILLBOARD,  1.2);

  for(n = 10 ; n < 200 ; n += 4 + Math.floor(n/100)) {
    addSprite(n, SPRITES.PALM_TREE, 0.6 + Math.random()*0.5);
    addSprite(n, SPRITES.PALM_TREE,   1.1 + Math.random()*2);
  }

  for(n = 250 ; n < 1000 ; n += 5) {
    addSprite(n,     SPRITES.COLUMN, 1.2);
    addSprite(n + Util.randomInt(0,5), SPRITES.TREE1, -1.2 - (Math.random() * 2));
    addSprite(n + Util.randomInt(0,5), SPRITES.TREE2, -1.2 - (Math.random() * 2));
  }

  for(n = 200 ; n < segments.length ; n += 3) {
    addSprite(n, Util.randomChoice(SPRITES.PLANTS), Util.randomChoice([1,-1]) * (2 + Math.random() * 5));
  }

  var side, sprite, offset;
  for(n = 1000 ; n < (segments.length-50) ; n += 100) {
    side      = Util.randomChoice([1, -1]);
    addSprite(n + Util.randomInt(0, 50), Util.randomChoice(SPRITES.BILLBOARDS), -side);
    for(i = 0 ; i < 20 ; i++) {
      sprite = Util.randomChoice(SPRITES.PLANTS);
      offset = side * (1.5 + Math.random());
      addSprite(n + Util.randomInt(0, 50), sprite, offset);
    }
      
  }

}

function resetCars() {
  cars = [];
  var n, car, segment, offset, z, sprite, speed;
  for (var n = 0 ; n < totalCars ; n++) {
    offset = Math.random() * Util.randomChoice([-0.8, 0.8]);
    z      = Math.floor(Math.random() * segments.length) * segmentLength;
    sprite = Util.randomChoice(SPRITES.CARS);
    speed  = maxSpeed/2 + Math.random() * maxSpeed/(sprite == SPRITES.SEMI ? 4 : 2);
    car = { offset: offset, z: z, sprite: sprite, speed: speed, lap: 1};
    segment = findSegment(car.z);
    segment.cars.push(car);
    cars.push(car);
  }
}

//=========================================================================
// THE GAME LOOP
//=========================================================================

Game.run({
  canvas: canvas, render: render, update: update, step: step,
  images: ["background", "sprites"],
  ready: function(images) {
    background = images[0];
    sprites    = images[1];
    reset();
  }
});

function reset(options) {
  options       = options || {};
  canvas.width  = width  = Util.toInt(options.width,          width);
  canvas.height = height = Util.toInt(options.height,         height);
  lanes                  = Util.toInt(options.lanes,          lanes);
  roadWidth              = Util.toInt(options.roadWidth,      roadWidth);
  camera.height          = Util.toInt(options.cameraHeight,   camera.height);
  camera.drawDistance    = Util.toInt(options.drawDistance,   camera.drawDistance);
  camera.fogDensity      = Util.toInt(options.fogDensity,     camera.fogDensity);
  camera.fieldOfView     = Util.toInt(options.fieldOfView,    camera.fieldOfView);
  segmentLength          = Util.toInt(options.segmentLength,  segmentLength);
  rumbleLength           = Util.toInt(options.rumbleLength,   rumbleLength);
  camera.depth           = 1 / Math.tan((camera.fieldOfView/2) * Math.PI/180);
  camera.playerZ         = (camera.height * camera.depth);
  resolution             = height/480;

  if ((segments.length==0) || (options.segmentLength) || (options.rumbleLength))
    resetRoad(); // only rebuild road when necessary
}

//});
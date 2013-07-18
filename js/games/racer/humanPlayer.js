// A basic AI implementation for the racing game
define(['games/racer/util','games/racer/common','games/racer/racer.core'], function (Util,C,Core) {

var humanPlayer = (function() {
    var player = function() {
        this.maxSpeed  = C.maxSpeed;
        this.accel     = this.maxSpeed/5;
        this.car       = jQuery.extend(true, {}, C.carDefault);
        this.car.speed = 0;
        this.sprite    = Util.randomChoice(C.SPRITES.CARS);
        this.playerW   = C.SPRITES.CAR_STRAIGHT.w * C.SPRITES.SCALE;
        this.place     = null;                  // position in the race, calculated each step
        this.finished  = false;                 // boolean whether the given player is finished
        this.isYou     = true;                  // used to determine that you are the player
        this.car.reset = -1;                     // used to determine if the car has crashed recently

        this.setPlayerNum = function(playerNum) {
            this.pNum  = playerNum;
            this.car.x = (playerNum%C.lanes - 1)*2/3; // Lines players up at -2/3, 0, 2/3
            this.car.z = (C.trackLength-Math.floor(playerNum/C.lanes)*C.segmentLength*5)%C.trackLength;
            var segment = Core.findSegment(this.car.z);
            segment.cars.push(this);
        }
    };

    player.prototype = {
        move: function(dt) {
            if(this.car.reset < 0) {
                var oldSegment = Core.findSegment(this.car.z);

                //this.car.x       = this.car.x + this.steer();
                this.steer(dt);
                this.accelerate(dt);
                this.adjustCentrifugal(dt);
                var newSegment = Core.findSegment(this.car.z);

                if ((this.car.x < -1) || (this.car.x > 1)) {
                    if (this.car.speed > C.offRoadLimit) this.car.speed = Util.accelerate(this.car.speed, C.offRoadDecel, dt);
                    this.checkTerrainCollisions(newSegment);
                }

                this.checkCarCollisions(newSegment);

                // regulate
                this.car.x = Util.limit(this.car.x, -3, 3);                 // don't ever let it go too far out of bounds
                this.car.speed = Util.limit(this.car.speed, 0, C.maxSpeed); // or exceed maxSpeed

                newSegment  = Core.findSegment(this.car.z);
                if (oldSegment != newSegment) {
                    var index = oldSegment.cars.indexOf(this);
                    oldSegment.cars.splice(index, 1);
                    newSegment.cars.push(this);
                }
            } else if(this.car.reset == 0) {
                this.resetCar();
            }else {
                this.car.reset--;
            }

            if(this.finished) return; //don't track once done, but you can still drive around
            if(C.raceActive &&!this.finished) {
                this.place = Core.getPlace(0);
                if (this.car.currentLapTime && (this.car._z > this.car.z)) {
                    this.car.lapTimes.push(this.car.currentLapTime);
                    this.car.lap++;
                    if(this.car.lap > C.numLaps) {
                        this.finished = true;
                    }
                    else {
                        this.car.currentLapTime = 0;
                    }
                }
                else {
                    this.car.currentLapTime += dt;
                }
            }
        },
        steer : function(dt) {
            var speedPercent  = this.car.speed/C.maxSpeed;
            var ax            = speedPercent/2;           // at top speed, should be able to cross from left to right (-1 to 1) in 1 second
            var dx            = 2*speedPercent*dt;
            if (C.keyLeft) {
                this.car.dx = Math.max(Util.accelerate(this.car.dx, -ax, dt),-dx);
            }
            else if (C.keyRight) {
                this.car.dx = Math.min(Util.accelerate(this.car.dx, ax, dt),dx);
            }
            else {
                if(this.car.x != 0) this.car.dx -= this.car.dx/2;
            }
            this.car.x += this.car.dx;
        },
        adjustCentrifugal : function(dt) {
            var speedPercent  = this.car.speed/C.maxSpeed;
            var dx            = 2*speedPercent*dt;
            var dz            = this.car.z - this.car._z;
            var sign          = C.playerSegment.curve < 0 ? -1 : 1;

            var outwardForce = dx * C.playerSegment.curve / C.centrifugal;
            this.car.x = this.car.x - outwardForce;

            var xoff          = Math.abs(sign - this.car.x);
            var zoff          = dz * 0.03 * Math.pow(Math.abs(C.playerSegment.curve),1/3) * xoff;  //Adjust for a little longer distance traveled
            this.car.z  -= zoff;
            if(this.car.z < 0) this.car.z = C.trackLength - this.car.z;
        },
        accelerate : function(dt) {
            this.car._z = this.car.z;
            this.car.z  = Util.increase(this.car.z, dt * this.car.speed, C.trackLength);
            
            if (C.keyFaster)
                this.car.speed = Util.accelerate(this.car.speed, this.accel, dt);
            else if (C.keySlower)
                this.car.speed = Util.accelerate(this.car.speed, C.breaking, dt);
            else
                this.car.speed = Util.accelerate(this.car.speed, C.decel, dt);

            this.car.percent = Util.percentRemaining(this.car.z, C.segmentLength);
        },
        checkTerrainCollisions : function(segment) {
            for(var n = 0 ; n < segment.sprites.length ; n++) {
                var sprite  = segment.sprites[n];
                var spriteW = sprite.source.w * C.SPRITES.SCALE;
                if (Util.overlap(this.car.x, this.playerW, sprite.x + spriteW/2 * (sprite.x > 0 ? 1 : -1), spriteW)) {
                    this.car.reset = Math.floor(C.fps*(1 + this.car.speed/this.maxSpeed));     // Player draw function uses this value to determine explosions
                    console.log(this.car.reset)
                    this.car.speed = 0;
                    this.car.z = this.car._z;
                    break;
                }
            }
        },
        checkCarCollisions : function(segment) {
            for(var n = 0 ; n < segment.cars.length ; n++) {
                var opponent  = segment.cars[n];
                var carW = opponent.sprite.w * C.SPRITES.SCALE;
                if (this.car.speed > opponent.car.speed) {
                    if (Util.overlap(this.car.x, this.playerW, opponent.car.x, carW, 0.8)) {
                        this.car.speed    = opponent.car.speed * (opponent.car.speed/this.car.speed)/3;
                        this.car.z = this.car._z;
                        break;
                    }
                }
            }
        },
        resetCar : function() {
            this.car.x = 0;
            this.car.dx = 0;
            this.car.speed = 0;
            this.car.reset = -1;
        }
    };

    return player;
})();

return humanPlayer;
});
Javascript Pseudo 3D Racer
==========================

An Outrun-style pseudo-3d racing game in HTML5 and Javascript. This project was originally 
developed by Jake Gordon (@jakesgordon) as a tutorial for pseudo-3d games. It is being ported
to the Animatron Javascript player and turned into a full-fledged game by Brian Clanton 
(@brianclanton) and Andrew Hollenbach (@ahollenbach).

 * [Play the original game](http://codeincomplete.com/projects/racer/v4.final.html)
 * View the [original source](https://github.com/jakesgordon/javascript-racer)
 * Read about [how it works](http://codeincomplete.com/posts/2012/6/22/javascript_racer/)

A note on performance
=====================

The performance of this game is **very** machine/browser dependent. It works quite well in modern
browsers, especially those with GPU canvas acceleration, but a bad graphics driver can kill it stone
dead. So your mileage may vary. There are controls provided to change the rendering resolution
and the draw distance to scale to fit your machine.

Currently supported browsers include:

 * Firefox (v12+) works great, 60fps at high res - Nice!
 * Chrome (v19+) works great, 60fps at high res... provided you dont have a bad GPU driver
 * IE9 - ok, 30fps at medium res... not great, but at least it works

The current state of mobile browser performance is pretty dismal. Dont expect this to be playable on
any mobile device.

>> _NOTE: I havent actually spent anytime optimizing for performance yet. So it might be possible to
   make it play well on older browsers, but that's not really what this project is about._

Related Links
=============

 * [Lou's Pseudo-3d Page](http://www.gorenfeld.net/lou/pseudo/) - high level how-to guide
 * [Racer 10k](http://10k.aneventapart.com/1/Entry/198) - another javascript racing game

License
=======

[MIT](http://en.wikipedia.org/wiki/MIT_License) license.

>> NOTE: the music tracks included in this project are royalty free resources paid for and licensed
from [Lucky Lion Studios](http://luckylionstudios.com/). They are licensed ONLY for use in this
project and should not be reproduced.

>> NOTE: the sprite graphics are placeholder graphics [borrowed](http://pixel.garoux.net/game/44) from the old
genesis version of outrun and used here as teaching examples. If there are any pixel artists out there who want to 
provide original art to turn this into a real game please get in touch!


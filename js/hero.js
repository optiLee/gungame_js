// Hero.js
export class Hero {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.speed = 200;
        this.weapons = []; // Array to hold weapon objects
    }
}
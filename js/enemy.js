// Enemy.js
export class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.dropRate = 0.02;  // 기본 아이템 드롭 확률 설정
        this.mass = 1;
        this.initializeProperties(type);
    }

    initializeProperties(type) {
        switch (type) {
            case 'small':
                this.hp = 8;
                this.size = 8;
                this.color = 0xff0000;
                this.speed = 120;
                break;
            case 'medium':
                this.hp = 100;
                this.size = 12;
                this.color = 0xffa500;
                this.speed = 100;
                this.mass = 5;
                break;
            case 'large':
                this.hp = 200;
                this.size = 18;
                this.color = 0xffd700;
                this.speed = 30;
                this.dropRate = 0.2;  // large일 경우 확률 조정
                this.mass = 10;
                break;
            default:
                this.hp = 50;
                this.size = 8;
                this.color = 0xff0000;
                this.speed = 150;
                break;
        }
    }
}

// MainScene.js
import { CardEvent } from './card_event.js';
import { Util } from './util.js';
import { Hero } from './hero.js';
import { Enemy } from './enemy.js';

export class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    preload() {
        this.load.plugin(
            'rexvirtualjoystickplugin',
            './js/rexvirtualjoystickplugin.min.js',
            true
        );
    }

    create() {
        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x646464).setOrigin(0);

        this.cardEvent = new CardEvent(this);
        this.util = new Util(this);

        // Create hero
        this.hero = new Hero(this.scale.width / 2, this.scale.height / 2, 15, 15, 0x0000ff);
        this.heroGraphics = this.add.rectangle(this.hero.x, this.hero.y, this.hero.width, this.hero.height, this.hero.color);
        this.physics.add.existing(this.heroGraphics);
        this.heroGraphics.body.setCollideWorldBounds(true);

        // Create enemy group
        this.enemies = this.physics.add.group();

        // Create weapon group
        this.weapons = this.physics.add.group();

        // Key input setup
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Virtual joystick setup
        this.joystick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
            x: this.scale.width - 150,
            y: this.scale.height - 150,
            radius: 50,
            base: this.add.circle(0, 0, 50, 0x888888),
            thumb: this.add.circle(0, 0, 25, 0xcccccc),
            dir: '8dir',
            forceMin: 16,
            enable: true
        }).on('update', this.handleJoystickInput, this);

        this.handleJoystickInput = this.util.debounce(this.handleJoystickInput.bind(this), 100);
        this.handleJoystickInput = this.util.throttle(this.handleJoystickInput.bind(this), 100);

        this.enemyHpIncreaseRate = 1;

        this.createNewEnemy(5);

        // Add test weapons to hero
        this.hero.weapons.push({ time: 0, weaponSpeed: 100, damage: 10, criticalRate: 10, criticalChance: 0.5, fireRate: 1000, color: 0x0000ff });
        this.hero.weapons.push({ time: 0, weaponSpeed: 300, damage: 5, criticalRate: 2, criticalChance: 0.2, fireRate: 300, color: 0x00ff00 });

        this.physics.add.collider(this.heroGraphics, this.enemies, this.handleHeroEnemyCollision, null, this);
        this.physics.add.collider(this.enemies, this.enemies);
        this.physics.add.overlap(this.weapons, this.enemies, this.handleWeaponEnemyCollision, null, this);

        this.score = 0;
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '15px', fill: '#000' });

        this.elapsedTime = 0;
        this.elapsedTimeText = this.add.text(this.scale.width - 150, 16, '0:00', { fontSize: '15px', fill: '#000' }).setOrigin(0.5, 0);

        //this.enemyDeathUpgradeChance = 0.1;

        this.lastEnemySpawnTime = 0;
        this.lastUpgradeCardTime = 0;
    }

    update(time, delta) {
        if (!this.isPaused) {
            this.handleInput(delta);
            this.handleWeaponFire(time);
            this.moveEnemiesTowardsHero();

            this.elapsedTime += delta / 1000;
            const minutes = Math.floor(this.elapsedTime / 60);
            const seconds = Math.floor(this.elapsedTime % 60);
            this.elapsedTimeText.setText(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);

            this.updateEnemySpawn(this.elapsedTime);
            this.updateUpgradeCard(this.elapsedTime);
        }
    }

    handleInput(delta) {
        if (this.cursors.left.isDown) {
            this.heroGraphics.body.setVelocityX(-this.hero.speed);
        } else if (this.cursors.right.isDown) {
            this.heroGraphics.body.setVelocityX(this.hero.speed);
        } else {
            this.heroGraphics.body.setVelocityX(0);
        }

        if (this.cursors.up.isDown) {
            this.heroGraphics.body.setVelocityY(-this.hero.speed);
        } else if (this.cursors.down.isDown) {
            this.heroGraphics.body.setVelocityY(this.hero.speed);
        } else {
            this.heroGraphics.body.setVelocityY(0);
        }
    }

    handleJoystickInput() {
        const forceX = this.joystick.forceX;
        const forceY = this.joystick.forceY;

        const magnitude = Math.sqrt(forceX * forceX + forceY * forceY);
        const normalizedForceX = (forceX / magnitude) || 0;
        const normalizedForceY = (forceY / magnitude) || 0;

        this.heroGraphics.body.setVelocity(normalizedForceX * this.hero.speed, normalizedForceY * this.hero.speed);
    }

    handleWeaponFire(time) {
        this.hero.weapons.forEach(weapon => {
            if (time > weapon.time + weapon.fireRate) {
                const closestEnemy = this.util.getClosestEnemy(this.enemies, this.heroGraphics);
                if (closestEnemy) {
                    const weaponSprite = this.add.circle(this.heroGraphics.x, this.heroGraphics.y, 3, weapon.color);
                    this.physics.add.existing(weaponSprite);
                    weaponSprite.body.setCollideWorldBounds(true);
                    weaponSprite.damage = weapon.damage;
                    weaponSprite.criticalChance = weapon.criticalChance;
                    weaponSprite.criticalRate = weapon.criticalRate;
                    weaponSprite.color = weapon.color;
                    this.weapons.add(weaponSprite);
                    this.physics.moveToObject(weaponSprite, closestEnemy, weapon.weaponSpeed);
                    weapon.time = time;
                }
            }
        });
    }

    handleWeaponEnemyCollision(weapon, enemy) {
        const isCritical = Math.random() < weapon.criticalChance;
        const finalDamage = isCritical ? weapon.damage * weapon.criticalRate : weapon.damage;

        enemy.hp -= finalDamage;

        this.createCollisionEffect(weapon.x, weapon.y, isCritical, weapon.color);

        this.showDamageText(weapon.x, weapon.y, finalDamage, isCritical);

        const roundedHp = Math.round(enemy.hp);
        enemy.hpText.setText(roundedHp.toString());

        if (enemy.hp <= 0) {
            if (Math.random() < enemy.dropRate) {
                this.cardEvent.triggerUpgradeCardSelection();
            }

            enemy.hpText.destroy();
            enemy.destroy();
            this.score += 10;
            this.scoreText.setText(`Score: ${this.score}`);
        }

        weapon.destroy();
    }

    createCollisionEffect(x, y, isCritical, color) {
        const effectSize = isCritical ? 15 : 10;

        const effect = this.add.circle(x, y, effectSize, color);
        this.tweens.add({
            targets: effect,
            alpha: 0,
            duration: 500,
            onComplete: () => {
                effect.destroy();
            }
        });
    }

    moveEnemiesTowardsHero() {
        this.enemies.children.iterate((enemy) => {
            //console.log("1: ", enemy.speed);
            this.physics.moveToObject(enemy, this.heroGraphics, enemy.speed);
            enemy.hpText.setPosition(enemy.x, enemy.y);
        });
    }

    showDamageText(x, y, damage, isCritical) {
        const roundedDamage = Math.round(damage * 10) / 10;
        const ffsize = isCritical ? '18px' : '14px';
        const damageText = this.add.text(x, y, roundedDamage.toString(), { fontSize: ffsize, fill: '#000000' }).setOrigin(0.5);
        this.tweens.add({
            targets: damageText,
            y: y - 20,
            alpha: 0,
            duration: 1000,
            onComplete: () => {
                damageText.destroy();
            }
        });
    }

    createNewEnemy(count) {
        const minDistanceBetweenEnemies = 20;
        const minDistanceFromHero = 200;

        for (let i = 0; i < count; i++) {
            let enemyX, enemyY;
            let validPosition = false;

            while (!validPosition) {
                enemyX = Phaser.Math.Between(0, this.scale.width);
                enemyY = Phaser.Math.Between(0, this.scale.height);
                validPosition = true;

                const distanceFromHero = Phaser.Math.Distance.Between(enemyX, enemyY, this.heroGraphics.x, this.heroGraphics.y);
                if (distanceFromHero < minDistanceFromHero) {
                    validPosition = false;
                    continue;
                }

                this.enemies.children.iterate((enemy) => {
                    const distance = Phaser.Math.Distance.Between(enemyX, enemyY, enemy.x, enemy.y);
                    if (distance < minDistanceBetweenEnemies) {
                        validPosition = false;
                    }
                });
            }

            //const enemyType = Phaser.Math.Between(0, 2) === 0 ? 'small' : (Phaser.Math.Between(0, 1) === 0 ? 'medium' : 'large');
            const randomValue = Phaser.Math.Between(1, 100); // 1부터 100까지의 무작위 숫자 생성
            let enemyType;
            if (randomValue <= 50) {
                enemyType = 'small'; // 1부터 50까지: 50%
            } else if (randomValue <= 80) {
                enemyType = 'medium'; // 51부터 80까지: 30%
            } else {
                enemyType = 'large'; // 81부터 100까지: 20%
            }
            const enemy = new Enemy(enemyX, enemyY, enemyType);
            const enemyGraphics = this.add.circle(enemy.x, enemy.y, enemy.size, enemy.color);
            this.physics.add.existing(enemyGraphics);

            // 적의 체력 증가 로직
            const baseHp = enemy.hp;
            const hpIncrease = this.enemyHpIncreaseRate * 1.1;
            enemy.hp = baseHp * hpIncrease;

            enemyGraphics.hp = enemy.hp;
            enemyGraphics.hpText = this.add.text(enemy.x, enemy.y, Math.round(enemy.hp).toString(), { fontSize: '12px', fill: '#fff' }).setOrigin(0.5);
            enemyGraphics.dropRate = enemy.dropRate;
            enemyGraphics.speed = enemy.speed;
            enemyGraphics.body.mass = enemy.mass;
            this.enemies.add(enemyGraphics);
        }

        this.enemyHpIncreaseRate += 0.1;
    }

    handleHeroEnemyCollision(hero, enemy) {
        this.physics.pause();
        hero.setFillStyle(0xff0000);
        this.add.text(this.scale.width / 2, this.scale.height / 2, 'Game Over', { fontSize: '64px', fill: '#000' }).setOrigin(0.5);
        this.isPaused = true;
    }

    updateEnemySpawn(elapsedTime) {
        if (elapsedTime > this.lastEnemySpawnTime + 5) {
            this.createNewEnemy(5);
            if (Math.random() < 0.5) {
                this.createNewEnemy(5);
            } else if (Math.random() >= 0.9) {
                this.createNewEnemy(15);
            }
            this.lastEnemySpawnTime = elapsedTime;
        }
    }

    updateUpgradeCard(elapsedTime) {
        if (elapsedTime > this.lastUpgradeCardTime + 8) {
            this.cardEvent.triggerUpgradeCardSelection();
            this.lastUpgradeCardTime = elapsedTime;
        }
    }
}

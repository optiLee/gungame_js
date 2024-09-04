// MainScene.js 파일

import { CardEvent } from './card_event.js';
import { Util } from './util.js';
import { Hero } from './hero.js';
import { Enemy } from './enemy.js';
import { weaponCards } from './weapon.js'; // weaponCards 가져오기

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

        // 무기 이미지 프리로드
        this.load.image('canon', './assets/canon.png');
        this.load.image('gun', './assets/gun.png');
        this.load.image('rifle', './assets/rifle.png');
        this.load.image('shotgun', './assets/shotgun.png');
        this.load.image('sniper', './assets/sniper.png');
        this.load.image('upgrade', './assets/upgrade.png');
    }

    create() {
        // 화면 비율 설정
        this.updateAspectRatio();

        // resize 이벤트 처리
        this.scale.on('resize', this.updateAspectRatio, this);

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
        // this.hero.weapons.push(weaponCards[0]); // 예시로 첫 번째 무기 추가
        // this.hero.weapons.push(weaponCards[1]); // 예시로 두 번째 무기 추가
        this.cardEvent.triggerUpgradeCardSelection("weaponOnly");

        this.physics.add.collider(this.heroGraphics, this.enemies, this.handleHeroEnemyCollision, null, this);
        this.physics.add.collider(this.enemies, this.enemies);
        this.physics.add.overlap(this.weapons, this.enemies, this.handleWeaponEnemyCollision, null, this);

        this.score = 0;
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '15px', fill: '#000' });

        this.elapsedTime = 0;
        this.elapsedTimeText = this.add.text(this.scale.width - 150, 16, '0:00', { fontSize: '15px', fill: '#000' }).setOrigin(0.5, 0);

        // this.enemyDeathUpgradeChance = 0.1;

        this.lastEnemySpawnTime = 0;
        this.lastUpgradeCardTime = 0;
    }

    updateAspectRatio() {
        const aspectRatio = 1.3 / 2.8;
        const height = this.scale.height;
        const width = height * aspectRatio;

        this.scale.resize(width, height);
        this.physics.world.setBounds(0, 0, width, height);

        if (this.heroGraphics) {
            this.heroGraphics.setPosition(this.scale.width / 2, this.scale.height / 2);
        }

        if (this.elapsedTimeText) {
            this.elapsedTimeText.setPosition(this.scale.width - 150, 16);
        }
    }

    update(time, delta) {
        if (!this.isPaused) {
            this.elapsedTime += delta / 1000;
            const minutes = Math.floor(this.elapsedTime / 60);
            const seconds = Math.floor(this.elapsedTime % 60);
            this.elapsedTimeText.setText(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);

            this.handleInput();
            this.handleWeaponFire(time);
            this.moveEnemiesTowardsHero(this.elapsedTime);

            this.updateEnemySpawn(this.elapsedTime, minutes);
            this.updateUpgradeCard(this.elapsedTime);
        }
    }

    handleInput() {
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
                    const angleStep = weapon.fireCount > 1 ? weapon.fireAngle / (weapon.fireCount - 1) : Math.random() * weapon.fireAngle;
                    const startAngle = weapon.fireCount > 1 ? -weapon.fireAngle / 2: angleStep;
                    const step = weapon.fireCount > 1 ? this.heroGraphics.height * weapon.fireCount / 2 / (weapon.fireCount - 1) : 0;
                    const startstep = weapon.fireCount > 1 ? -this.heroGraphics.height * weapon.fireCount / 4: 0;
                    //console.log(weapon.name, step, startstep);

                    for (let i = 0; i < weapon.fireCount; i++) {
                        const angle = startAngle + i * angleStep;
                        const radian = Phaser.Math.DegToRad(angle);
                        const angleHtoE = Phaser.Math.Angle.Between(this.heroGraphics.x, this.heroGraphics.y, closestEnemy.x, closestEnemy.y);
                        //console.log(weapon.name, i, angle);
                        // const targetX = closestEnemy.x;
                        // const targetY = closestEnemy.y;
                        const targetX = this.heroGraphics.x + Math.cos(angleHtoE) * 3000;
                        const targetY = this.heroGraphics.y + Math.sin(angleHtoE) * 3000;
                        const firePositionY = this.heroGraphics.y + (startstep + i * step);
                        
                        let newStartPoint = Phaser.Math.RotateAroundDistance({ x: this.heroGraphics.x, y: firePositionY }, this.heroGraphics.x, this.heroGraphics.y, angleHtoE, 5);
                        // console.log(weapon.name, i, this.heroGraphics.y + (startstep + i * step));
                        // console.log("-", weapon.name, i, newStartPoint.y);
                        // console.log("**", this.heroGraphics.y-firePositionY);

                        //let newStartPoint = Phaser.Math.RotateAroundDistance({ x: 0, y: 0 }, this.heroGraphics.x, this.heroGraphics.y, radian, 50);
                        //const weaponSprite = this.add.circle(this.heroGraphics.x, this.heroGraphics.y, 3, weapon.color);
                        const weaponSprite = this.add.circle(newStartPoint.x, newStartPoint.y, 3, weapon.color);
                        this.physics.add.existing(weaponSprite);
                        weaponSprite.body.setCollideWorldBounds(true);
                        weaponSprite.damage = weapon.damage;
                        weaponSprite.criticalChance = weapon.criticalChance;
                        weaponSprite.criticalRate = weapon.criticalRate;
                        weaponSprite.color = weapon.color;
                        weaponSprite.range = weapon.range;
                        this.weapons.add(weaponSprite);

                        if (weapon.fireAngle) {
                            // 발사 각도에 따라 무기의 목표 위치를 설정
                            let newPoint = Phaser.Math.RotateAroundDistance({ x: targetX, y: targetY }, this.heroGraphics.x, this.heroGraphics.y, radian, weapon.range);
                            this.physics.moveTo(weaponSprite, newPoint.x, newPoint.y, weapon.weaponSpeed);
                        } else {
                            this.physics.moveTo(weaponSprite, targetX, targetY, weapon.weaponSpeed);
                        }                        
                    }
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

    moveEnemiesTowardsHero(elapsedTime) {
        this.enemies.children.iterate((enemy) => {
            let i = Math.floor(elapsedTime / 5); //시간에 따른 속도 증가
            this.physics.moveToObject(enemy, this.heroGraphics, enemy.speed + (i * 2));
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

            const randomValue = Phaser.Math.Between(1, 100); // 1부터 100까지의 무작위 숫자 생성
            let enemyType;
            if (randomValue <= 80) {
                enemyType = 'small'; // 1부터 80까지: 80%
            } else if (randomValue <= 95) {
                enemyType = 'medium'; // 81부터 95까지: 15%
            } else {
                enemyType = 'large'; // 96부터 100까지: 5%
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
            enemyGraphics.body.setCollideWorldBounds(true);
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

    updateEnemySpawn(elapsedTime, minutes) {
        let enemySpawnCnt = 2 + elapsedTime / 10;
        if (elapsedTime > this.lastEnemySpawnTime + 5) {
            this.createNewEnemy(enemySpawnCnt);
            let i = Math.random() + (minutes / 20);
            if (i >= 0.7 && i < 0.99) {
                this.createNewEnemy(enemySpawnCnt * 2);
            } else if (i >= 0.99) {
                this.createNewEnemy(enemySpawnCnt * 3);
            }
            this.lastEnemySpawnTime = elapsedTime;
        }
    }

    updateUpgradeCard(elapsedTime) {
        let interval = Math.exp(elapsedTime / 120) * 8;

        if (elapsedTime > this.lastUpgradeCardTime + interval) {
            this.cardEvent.triggerUpgradeCardSelection();
            this.lastUpgradeCardTime = elapsedTime;
        }
    }
}

// game_phaser_card.js 파일
import { CardEvent } from './card_event.js';

export class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    preload() {
        // 이미지를 로드하지 않습니다.

        // rexvirtualjoystickplugin을 Phaser의 플러그인 시스템을 통해 로드합니다.
        this.load.plugin(
            'rexvirtualjoystickplugin',
            './js/rexvirtualjoystickplugin.min.js',
            true
        );
    }

    create() {
        // 배경
        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x87CEEB).setOrigin(0); // 하늘색 배경

        // 영웅 생성
        this.hero = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 15, 15, 0x0000ff); // 파란색 네모
        this.physics.add.existing(this.hero);
        this.hero.body.setCollideWorldBounds(true);
        this.hero.speed = 200;
        this.hero.weapons = []; // 무기 리스트 초기화

        // 적 그룹 생성
        this.enemies = this.physics.add.group();

        // 무기 그룹 생성
        this.weapons = this.physics.add.group();

        // 키 입력 설정
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // 가상 조이스틱 설정
        this.joystick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
            x: 100,
            y: this.scale.height - 100,
            radius: 50,
            base: this.add.circle(0, 0, 50, 0x888888),
            thumb: this.add.circle(0, 0, 25, 0xcccccc),
            dir: '8dir', // 8방향 조이스틱
            forceMin: 16,
            enable: true
        }).on('update', this.handleJoystickInput, this);

        // 적 생성 시 HP 증가를 위한 초기화
        this.enemyHpIncreaseRate = 0;

        // 적 생성
        this.createNewEnemy(5);

        // 테스트용 무기 추가 (색상 포함)
        this.hero.weapons.push({ time: 0, weaponSpeed: 100, damage: 10, criticalRate: 10, criticalChance: 0.5, fireRate: 1000, color: 0x0000ff }); // 파란색 무기
        this.hero.weapons.push({ time: 0, weaponSpeed: 300, damage: 5, criticalRate: 2, criticalChance: 0.2, fireRate: 300, color: 0x00ff00 }); // 초록색 무기

        // 충돌 처리
        this.physics.add.collider(this.hero, this.enemies, this.handleHeroEnemyCollision, null, this);
        this.physics.add.collider(this.enemies, this.enemies); // 적군 간의 충돌 처리
        this.physics.add.overlap(this.weapons, this.enemies, this.handleWeaponEnemyCollision, null, this);

        // 점수
        this.score = 0;
        this.scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', fill: '#000' });

        // 5초마다 적 생성
        this.enemySpawnTimer = this.time.addEvent({
            delay: 5000, // 5000ms = 5초
            callback: () => {
                this.createNewEnemy(5);
            },
            callbackScope: this,
            loop: true
        });

        // 강화카드 선택 이벤트 타이머
        this.upgradeCardTimer = this.time.addEvent({
            delay: 8000, // 8000ms = 8초
            callback: () => {
                this.cardEvent.triggerUpgradeCardSelection();
            },
            callbackScope: this,
            loop: true
        });

        // 적이 죽을 때 강화카드 선택 확률
        this.enemyDeathUpgradeChance = 0.1; // 10%

        // 카드 이벤트 인스턴스 생성
        this.cardEvent = new CardEvent(this);
    }

    update(time, delta) {
        this.handleInput(delta);
        this.handleWeaponFire(time); // 무기 발사 처리
        this.moveEnemiesTowardsHero();
    }

    handleInput(delta) {
        if (this.cursors.left.isDown) {
            this.hero.body.setVelocityX(-this.hero.speed);
        } else if (this.cursors.right.isDown) {
            this.hero.body.setVelocityX(this.hero.speed);
        } else {
            this.hero.body.setVelocityX(0);
        }

        if (this.cursors.up.isDown) {
            this.hero.body.setVelocityY(-this.hero.speed);
        } else if (this.cursors.down.isDown) {
            this.hero.body.setVelocityY(this.hero.speed);
        } else {
            this.hero.body.setVelocityY(0);
        }
    }

    handleJoystickInput() {
        const forceX = this.joystick.forceX;
        const forceY = this.joystick.forceY;

        this.hero.body.setVelocity(forceX * this.hero.speed, forceY * this.hero.speed);
    }

    handleWeaponFire(time) {
        this.hero.weapons.forEach(weapon => {
            if (time > weapon.time + weapon.fireRate) {
                const closestEnemy = this.getClosestEnemy();
                if (closestEnemy) {
                    const weaponSprite = this.add.circle(this.hero.x, this.hero.y, 8, weapon.color); // 무기 색상 설정
                    this.physics.add.existing(weaponSprite);
                    weaponSprite.body.setCollideWorldBounds(true);
                    weaponSprite.damage = weapon.damage;
                    weaponSprite.criticalChance = weapon.criticalChance;
                    weaponSprite.criticalRate = weapon.criticalRate;
                    weaponSprite.color = weapon.color; // 여기서 color 속성을 추가합니다.
                    this.weapons.add(weaponSprite);
                    this.physics.moveToObject(weaponSprite, closestEnemy, weapon.weaponSpeed);
                    weapon.time = time; // 무기 발사 시간 갱신
                }
            }
        });
    }

    getClosestEnemy() {
        let closestEnemy = null;
        let closestDistance = Infinity;
        this.enemies.children.iterate((enemy) => {
            const distance = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, enemy.x, enemy.y);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestEnemy = enemy;
            }
        });
        return closestEnemy;
    }

    handleWeaponEnemyCollision(weapon, enemy) {
        // 치명타 계산
        const isCritical = Math.random() < weapon.criticalChance;
        const finalDamage = isCritical ? weapon.damage * weapon.criticalRate : weapon.damage;

        // 적의 체력 감소
        enemy.hp -= finalDamage;
        //console.log(weapon.damage);
        //console.log(weapon.criticalRate, finalDamage);
        //console.log(weapon.color);

        // 충돌 이펙트 생성
        this.createCollisionEffect(weapon.x, weapon.y, isCritical, weapon.color);

        // 데미지 숫자 표시
        this.showDamageText(weapon.x, weapon.y, finalDamage, isCritical);

        // 적의 체력 텍스트 업데이트
        enemy.hpText.setText(enemy.hp.toString());

        // 적의 체력이 0 이하이면 제거
        if (enemy.hp <= 0) {
            enemy.hpText.destroy();
            enemy.destroy();
            this.score += 10;
            this.scoreText.setText(`Score: ${this.score}`);

            // 적 사망 시 강화카드 선택 확률
            if (Math.random() < this.enemyDeathUpgradeChance) {
                this.cardEvent.triggerUpgradeCardSelection();
            }
        }

        // 무기는 충돌 후 제거
        weapon.destroy();
    }

    createCollisionEffect(x, y, isCritical, color) {
        const effectSize = isCritical ? 15 : 10; // 크리티컬일 경우 더 큰 이펙트
        //console.log(color);
    
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
            this.physics.moveToObject(enemy, this.hero, 100); // 적이 영웅을 향해 움직임
            // 적의 체력 텍스트 위치 업데이트, 약간 아래로 조정
            enemy.hpText.setPosition(enemy.x, enemy.y);
        });
    }

    showDamageText(x, y, damage, isCritical) {
        const ffsize = isCritical ? '18px' : '14px';
        const damageText = this.add.text(x, y, damage.toString(), { fontSize: ffsize, fill: '#000000' }).setOrigin(0.5);
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
        const minDistanceBetweenEnemies = 20; // 적들 간 최소 거리
        const minDistanceFromHero = 200; // 영웅과의 최소 거리

        for (let i = 0; i < count; i++) {
            let enemyX, enemyY;
            let validPosition = false;

            while (!validPosition) {
                enemyX = Phaser.Math.Between(0, this.scale.width);
                enemyY = Phaser.Math.Between(0, this.scale.height);
                validPosition = true;

                // 영웅과의 거리 확인
                const distanceFromHero = Phaser.Math.Distance.Between(enemyX, enemyY, this.hero.x, this.hero.y);
                if (distanceFromHero < minDistanceFromHero) {
                    validPosition = false;
                    continue;
                }

                // 다른 적들과의 거리 확인
                this.enemies.children.iterate((enemy) => {
                    const distance = Phaser.Math.Distance.Between(enemyX, enemyY, enemy.x, enemy.y);
                    if (distance < minDistanceBetweenEnemies) {
                        validPosition = false;
                    }
                });
            }

            const enemy = this.add.circle(enemyX, enemyY, 8, 0xff0000); // 빨간색 원
            this.physics.add.existing(enemy);

            // 적의 체력 증가 로직
            const baseHp = 80;
            const hpIncrease = this.enemyHpIncreaseRate * 5;
            enemy.hp = baseHp + hpIncrease;
            enemy.maxHp = baseHp + hpIncrease;

            // 적의 체력 표시 텍스트 추가, 약간 아래로 조정
            enemy.hpText = this.add.text(enemyX, enemyY, enemy.hp.toString(), { fontSize: '12px', fill: '#fff' }).setOrigin(0.5);

            this.enemies.add(enemy);
        }

        // 적 생성 후 HP 증가율 증가
        this.enemyHpIncreaseRate++;
    }

    handleHeroEnemyCollision(hero, enemy) {
        this.physics.pause();
        hero.setFillStyle(0xff0000); // 충돌 시 영웅 색상 변경
        this.add.text(this.scale.width / 2, this.scale.height / 2, 'Game Over', { fontSize: '64px', fill: '#000' }).setOrigin(0.5);

        // 적 생성 타이머 중지
        this.enemySpawnTimer.remove(false);
        this.upgradeCardTimer.remove(false);
    }
}

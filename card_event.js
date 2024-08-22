export class CardEvent {
    constructor(scene) {
        this.scene = scene;
        this.upgradeCards = [
            { text: '내가 가진 무기 데미지 100% 강화', effect: 'increaseDamage' },
            { text: '내가 가진 무기 fireRate 2배', effect: 'increaseFireRate' },
            { text: 'critical chance 2배', effect: 'increaseCriticalChance' },
            { text: '내 속도 2배', effect: 'increaseSpeed' },
            { text: '내 전체무기 속도 2배', effect: 'increaseWeaponSpeed' },
            { text: '새로운 무기 추가', effect: 'addNewWeapon' }
        ];
        this.selectedCardIndex = 0;
        this.keyboardEnabled = true;

        // 키보드 입력을 위한 이벤트 핸들러 바인딩
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    triggerUpgradeCardSelection() {
        this.selectedCardIndex = 0;
        this.keyboardEnabled = true;

        // upgradeCardTexts 초기화
        if (this.scene.upgradeCardTexts) {
            this.scene.upgradeCardTexts.forEach(text => text.destroy());
        }
        this.scene.upgradeCardTexts = [];

        this.scene.physics.pause();
        this.scene.upgradeCardTimer.paused = true;
        this.scene.enemySpawnTimer.paused = true; // 적 생성 타이머 일시 정지

        // 랜덤하게 세 장의 강화카드를 선택
        const selectedCards = Phaser.Utils.Array.Shuffle(this.upgradeCards).slice(0, 3);

        // UI 생성
        this.scene.upgradeCardTexts = selectedCards.map((card, index) => {
            const text = this.scene.add.text(this.scene.scale.width / 2, this.scene.scale.height / 2 + index * 60, card.text, {
                fontSize: '24px',
                fill: '#000',
                backgroundColor: '#ffffff',
                padding: { x: 10, y: 20 } // 세로 길이 늘리기
            }).setOrigin(0.5);
            text.setInteractive();
            text.on('pointerdown', () => {
                this.applyUpgrade(card.effect);
            });
            return text;
        });

        this.updateCardSelection();

        // 기존 키보드 이벤트 리스너 제거
        this.scene.input.keyboard.off('keydown', this.handleKeyDown);

        // 키보드 입력 설정
        this.scene.input.keyboard.on('keydown', this.handleKeyDown);
    }

    handleKeyDown(event) {
        switch (event.code) {
            case 'ArrowUp':
                this.moveSelectionUp();
                break;
            case 'ArrowDown':
                this.moveSelectionDown();
                break;
            case 'Space':
                this.confirmSelection();
                break;
            case 'Digit1':
                this.applyUpgrade(this.scene.upgradeCardTexts[0]?.effect);
                break;
            case 'Digit2':
                this.applyUpgrade(this.scene.upgradeCardTexts[1]?.effect);
                break;
            case 'Digit3':
                this.applyUpgrade(this.scene.upgradeCardTexts[2]?.effect);
                break;
        }
    }

    moveSelectionUp() {
        if (this.keyboardEnabled) {
            this.selectedCardIndex = (this.selectedCardIndex - 1 + this.scene.upgradeCardTexts.length) % this.scene.upgradeCardTexts.length;
            this.updateCardSelection();
        }
    }

    moveSelectionDown() {
        if (this.keyboardEnabled) {
            this.selectedCardIndex = (this.selectedCardIndex + 1) % this.scene.upgradeCardTexts.length;
            this.updateCardSelection();
        }
    }

    confirmSelection() {
        if (this.keyboardEnabled) {
            const selectedCard = this.scene.upgradeCardTexts[this.selectedCardIndex];
            const effect = this.upgradeCards.find(card => card.text === selectedCard.text)?.effect;
            if (effect) {
                this.applyUpgrade(effect);
            }
        }
    }

    updateCardSelection() {
        if (this.scene.upgradeCardTexts) {
            this.scene.upgradeCardTexts.forEach((text, index) => {
                if (text) { // text가 유효한지 확인
                    if (index === this.selectedCardIndex) {
                        text.setStyle({ backgroundColor: '#ff0' }); // 선택된 카드의 테두리 색상 변경
                    } else {
                        text.setStyle({ backgroundColor: '#ffffff' });
                    }
                }
            });
        }
    }

    applyUpgrade(effect) {
        this.keyboardEnabled = false; // 키보드 입력 비활성화
        // 강화카드 효과 적용
        switch (effect) {
            case 'increaseDamage':
                this.scene.hero.weapons.forEach(weapon => weapon.damage *= 2);
                break;
            case 'increaseFireRate':
                this.scene.hero.weapons.forEach(weapon => weapon.fireRate /= 2);
                break;
            case 'increaseCriticalChance':
                this.scene.hero.weapons.forEach(weapon => weapon.criticalChance *= 2);
                break;
            case 'increaseSpeed':
                this.scene.hero.speed *= 2;
                break;
            case 'increaseWeaponSpeed':
                this.scene.hero.weapons.forEach(weapon => weapon.weaponSpeed *= 2);
                break;
            case 'addNewWeapon':
                this.scene.hero.weapons.push({ time: 0, weaponSpeed: 200, damage: 7, criticalRate: 3, criticalChance: 0.3, fireRate: 700, color: 0xff00ff }); // 새로운 무기 추가
                break;
        }

        // UI 제거 및 게임 재개
        if (this.scene.upgradeCardTexts) {
            this.scene.upgradeCardTexts.forEach(text => text.destroy());
        }
        this.scene.physics.resume();
        this.scene.upgradeCardTimer.paused = false;
        this.scene.enemySpawnTimer.paused = false; // 적 생성 타이머 재개
    }
}

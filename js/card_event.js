import { weaponCards } from './weapon.js';

export class CardEvent {
    constructor(scene) {
        this.scene = scene;
        this.upgradeCards = [
            { name: '데미지 증가', text: '무기 데미지 20% 증가', effect: 'increaseDamage' },
            { name: '공속 증가', text: '무기 공속 20% 증가', effect: 'increaseFireRate' },
            { name: '크리확률 증가', text: '크리확률 20% 증가', effect: 'increaseCriticalChance' },
            { name: '속도 증가', text: '무기 속도 20% 증가', effect: 'increaseWeaponSpeed' },
            { name: '크리배율 증가', text: '크리배율 20% 증가', effect: 'increaseCriticalRate' }
        ];
        this.selectedCardIndex = 0;
        this.keyboardEnabled = true;

        // 키보드 입력을 위한 이벤트 핸들러 바인딩
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    triggerUpgradeCardSelection(upgradeType) {
        this.selectedCardIndex = 0;
        this.keyboardEnabled = true;

        // upgradeCardTexts 초기화
        if (this.scene.upgradeCardTexts) {
            this.scene.upgradeCardTexts.forEach(text => text.destroy());
        }
        this.scene.upgradeCardTexts = [];

        this.scene.physics.pause();
        this.scene.isPaused = true; // 게임 일시 중지

        let selectedCards;
        // 무기와 업그레이드를 랜덤하게 섞어서 선택
        const availableWeaponCards = weaponCards.filter(weaponCard => 
            !this.scene.hero.weapons.some(weapon => weapon.name === weaponCard.name)
        );

        // 현재 무기 개수 확인
        const currentWeaponCount = this.scene.hero.weapons.length;

        if (currentWeaponCount >= 3) {
            // 무기가 3개 이상인 경우 업그레이드 카드만 선택
            selectedCards = Phaser.Utils.Array.Shuffle(this.upgradeCards).slice(0, 3);
        } else if (upgradeType === 'weaponOnly') {
            selectedCards = Phaser.Utils.Array.Shuffle(availableWeaponCards).slice(0, 3);
        } else {
            const allCards = [...this.upgradeCards, ...availableWeaponCards];
            selectedCards = Phaser.Utils.Array.Shuffle(allCards).slice(0, 3);
        }

        // UI 생성
        this.scene.upgradeCardTexts = selectedCards.map((card, index) => {
            const cardWidth = this.scene.scale.width * 0.9; // 카드의 너비
            const cardHeight = cardWidth / 3.2; // 카드의 높이 (가로:세로 = 4:1 비율)
            const padding = 8;

            // 배경
            const cardBackground = this.scene.add.rectangle(
                this.scene.scale.width / 2,
                this.scene.scale.height / 4 + index * (cardHeight + 20),
                cardWidth,
                cardHeight,
                0xffffff
            ).setOrigin(0.5);

            // 이미지
            const imageSize = cardHeight - padding * 2;
            const image = this.scene.add.image(
                this.scene.scale.width / 2 - cardWidth / 2 + padding + imageSize / 2,
                cardBackground.y,
                card.image || 'upgrade' // 여기에 이미지 키를 넣어주세요
            ).setDisplaySize(imageSize, imageSize);

            // 동적 폰트 크기 계산
            const nameFontSize = Math.floor(this.scene.scale.width / 35); // 화면 너비의 일정비율 폰트 크기로 사용
            const descriptionFontSize = Math.floor(this.scene.scale.width / 45); // 화면 너비의 일정비율 폰트 크기로 사용

            // 이름
            const name = this.scene.add.text(
                image.x + imageSize / 2 + padding,
                cardBackground.y - imageSize / 2 + padding, // 여백 추가
                card.name,
                {
                    fontSize: `${nameFontSize}px`, // 동적 폰트 크기
                    fill: '#000',
                    fontStyle: 'bold'
                }
            ).setOrigin(0, 0.5);

            // 설명
            const description = card.text || 
                `데미지: ${card.damage}\n공속: ${(1000 / card.fireRate).toFixed(1)}발/초\n크리확률: ${card.criticalChance}\n크리배율: ${card.criticalRate}`;
            const descriptionText = this.scene.add.text(
                name.x,
                name.y + name.height,
                description,
                {
                    fontSize: `${descriptionFontSize}px`, // 동적 폰트 크기
                    fill: '#000',
                    wordWrap: { width: cardWidth - imageSize - padding * 4, useAdvancedWrap: true },
                    lineSpacing: 6
                }
            ).setOrigin(0, 0);

            const container = this.scene.add.container(0, 0, [cardBackground, image, name, descriptionText]);
            container.setInteractive(new Phaser.Geom.Rectangle(
                cardBackground.x - cardWidth / 2,
                cardBackground.y - cardHeight / 2,
                cardWidth,
                cardHeight
            ), Phaser.Geom.Rectangle.Contains);

            container.on('pointerdown', () => {
                this.applyUpgrade(card.effect || card);
            });

            container.cardData = card; // 카드 데이터 저장

            return container;
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
            // case 'Digit1':
            //     this.applyUpgrade(this.scene.upgradeCardTexts[0]?.cardData.effect || this.scene.upgradeCardTexts[0]?.cardData);
            //     break;
            // case 'Digit2':
            //     this.applyUpgrade(this.scene.upgradeCardTexts[1]?.cardData.effect || this.scene.upgradeCardTexts[1]?.cardData);
            //     break;
            // case 'Digit3':
            //     this.applyUpgrade(this.scene.upgradeCardTexts[2]?.cardData.effect || this.scene.upgradeCardTexts[2]?.cardData);
            //     break;
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
            const cardData = selectedCard.cardData;

            if (cardData.effect) {
                // 업그레이드 카드인 경우
                this.applyUpgrade(cardData.effect);
            } else {
                // 무기 카드인 경우
                this.applyUpgrade(cardData);
            }
        }
    }

    updateCardSelection() {
        this.scene.upgradeCardTexts.forEach((container, index) => {
            if (index === this.selectedCardIndex) {
                container.list[0].setFillStyle(0x4d4d4d); // 진한 회색 배경
                container.list[2].setColor('#ffffff'); // 흰색 텍스트 (이름)
                container.list[3].setColor('#ffffff'); // 흰색 텍스트 (설명)
                container.list[0].setStrokeStyle(4, 0xffa500); // 주황색 테두리
            } else {
                container.list[0].setFillStyle(0xffffff); // 원래 흰색 배경
                container.list[2].setColor('#000000'); // 원래 검은색 텍스트 (이름)
                container.list[3].setColor('#000000'); // 원래 검은색 텍스트 (설명)
                container.list[0].setStrokeStyle(0); // 테두리 제거
            }
        });
    }

    applyUpgrade(effect) {
        this.keyboardEnabled = false; // 키보드 입력 비활성화
        // 강화카드 효과 적용
        if (typeof effect === 'string') {
            switch (effect) {
                case 'increaseDamage':
                    this.scene.hero.weapons.forEach(weapon => weapon.damage *= 1.2);
                    break;
                case 'increaseFireRate':
                    this.scene.hero.weapons.forEach(weapon => weapon.fireRate /= 1.2);
                    break;
                case 'increaseCriticalChance':
                    this.scene.hero.weapons.forEach(weapon => weapon.criticalChance *= 1.2);
                    break;
                case 'increaseSpeed':
                    this.scene.hero.speed *= 1.2;
                    break;
                case 'increaseCriticalRate':
                    this.scene.hero.weapons.forEach(weapon => weapon.criticalRate *= 1.2);
                    break;
            }
        } else {
            // 새로운 무기 추가
            this.scene.hero.weapons.push(effect);
        }
    
        // UI 제거
        if (this.scene.upgradeCardTexts) {
            this.scene.upgradeCardTexts.forEach(text => text.destroy());
        }
    
        // 1초 대기 후 게임 재개
        this.scene.time.delayedCall(250, () => {
            this.scene.physics.resume();
            this.scene.isPaused = false;
        }, [], this);
    }
}

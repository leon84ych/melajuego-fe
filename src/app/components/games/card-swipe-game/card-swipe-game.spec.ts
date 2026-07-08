import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CardSwipeGame } from './card-swipe-game';

describe('CardSwipeGame', () => {
  let component: CardSwipeGame;
  let fixture: ComponentFixture<CardSwipeGame>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardSwipeGame]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CardSwipeGame);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CardSwipeRoomScores } from './card-swipe-room-scores';

describe('CardSwipeRoomScores', () => {
  let component: CardSwipeRoomScores;
  let fixture: ComponentFixture<CardSwipeRoomScores>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardSwipeRoomScores]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CardSwipeRoomScores);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

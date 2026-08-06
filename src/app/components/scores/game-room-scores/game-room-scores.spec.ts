import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameRoomScores } from './game-room-scores';

describe('CardSwipeRoomScores', () => {
  let component: GameRoomScores;
  let fixture: ComponentFixture<GameRoomScores>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameRoomScores]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameRoomScores);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

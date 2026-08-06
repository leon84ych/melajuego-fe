import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameBatchScores } from './game-batch-scores';

describe('CardSwipeRoomScores', () => {
  let component: GameBatchScores;
  let fixture: ComponentFixture<GameBatchScores>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameBatchScores]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameBatchScores);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

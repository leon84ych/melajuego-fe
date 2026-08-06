import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameScores } from './game-scores';

describe('GameScores', () => {
  let component: GameScores;
  let fixture: ComponentFixture<GameScores>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameScores]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameScores);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

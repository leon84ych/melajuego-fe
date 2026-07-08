import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoomScores } from './room-scores';

describe('Scores', () => {
  let component: RoomScores;
  let fixture: ComponentFixture<RoomScores>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoomScores]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoomScores);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

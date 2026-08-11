import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameRoom } from './game-room';

describe('GameRoom', () => {
  let component: GameRoom;
  let fixture: ComponentFixture<GameRoom>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameRoom]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameRoom);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

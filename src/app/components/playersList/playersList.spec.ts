import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayersList } from './playersList';

describe('Room', () => {
  let component: PlayersList;
  let fixture: ComponentFixture<PlayersList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayersList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlayersList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PairMatchGame } from './pair-match-game';

describe('PairMatchGame', () => {
  let component: PairMatchGame;
  let fixture: ComponentFixture<PairMatchGame>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PairMatchGame]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PairMatchGame);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

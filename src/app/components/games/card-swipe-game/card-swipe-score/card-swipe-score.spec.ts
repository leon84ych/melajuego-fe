import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CardSwipeScore } from './card-swipe-score';

describe('CardSwipeScore', () => {
  let component: CardSwipeScore;
  let fixture: ComponentFixture<CardSwipeScore>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardSwipeScore]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CardSwipeScore);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

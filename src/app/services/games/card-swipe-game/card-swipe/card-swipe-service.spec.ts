import { TestBed } from '@angular/core/testing';

import { CardSwipe } from './card-swipe';

describe('CardSwipe', () => {
  let service: CardSwipe;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CardSwipe);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

import { TestBed } from '@angular/core/testing';

import { CardSwipeRoomScoresService } from './card-swipe-room-scores-service';

describe('CardSwipeRoomScoresService', () => {
  let service: CardSwipeRoomScoresService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CardSwipeRoomScoresService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

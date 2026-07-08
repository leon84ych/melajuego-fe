import { TestBed } from '@angular/core/testing';

import { RoomScoresService } from './room-scores-service';

describe('RoomScoresService', () => {
  let service: RoomScoresService  ;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RoomScoresService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

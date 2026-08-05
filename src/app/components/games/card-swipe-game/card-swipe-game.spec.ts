import { TestBed } from '@angular/core/testing';

import { WebsocketService } from '../../../services/Websocket';
import { CardSwipeService } from '../../../services/games/card-swipe-game/card-swipe/card-swipe-service';

describe('CardSwipeService', () => {
  let service: CardSwipeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CardSwipeService);
  });

  it('should use the current session nickname to decide whether the user is the host', () => {
    const websocket = TestBed.inject(WebsocketService);
    websocket.nickname.set('leon84ych');

  });
});

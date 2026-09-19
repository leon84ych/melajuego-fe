import { TestBed } from '@angular/core/testing';

import { PlayerListService } from './player-list-service';
import { WebsocketService } from '../Websocket';

describe('PlayerListService', () => {
  let service: PlayerListService;
  let websocket: WebsocketService;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();

    TestBed.configureTestingModule({});
    websocket = TestBed.inject(WebsocketService);
    service = TestBed.inject(PlayerListService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should detect host using the live websocket nickname when room state arrives', () => {
    websocket.nickname.set('HostUser');
    websocket.roomState$.next({
      roomCode: 'ROOM123',
      connectedUsers: ['HostUser', 'Guest'],
      host: 'hostuser',
      totalUsers: 2,
    });

    expect(service.isHost());
  });
});

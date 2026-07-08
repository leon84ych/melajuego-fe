import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { History } from './components/history/history';
import { About } from './components/about/about';
import { Configure } from './components/configure/configure';
import { WebsocketService } from './services/Websocket';
import { GameRoom } from './components/game-room/game-room';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, GameRoom, History, About, Configure],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./app.css'],
})
export class App {
  view = 'play' as 'play' | 'history' | 'configure' | 'about';

  constructor(private websocket: WebsocketService) {}

  setView(value: 'play' | 'history' | 'configure' | 'about') {
    this.view = value;

    if (value !== 'play') {
      return;
    }

    const savedSession = sessionStorage.getItem('game_session') || localStorage.getItem('game_session');
    if (!savedSession) {
      return;
    }

    try {
      const session = JSON.parse(savedSession) as { nickname?: string; room?: string };
      const nickname = (session.nickname || '').trim();
      const roomCode = (session.room || '').trim();
      this.websocket.refreshRoomState(roomCode, nickname);
    } catch {
      // Ignore malformed saved session
    }
  }
}

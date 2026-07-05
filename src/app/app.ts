import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Batch } from './components/batch/batch';
import { History } from './components/history/history';
import { Credits } from './components/credits/credits';
import { Configure } from './components/configure/configure';
import { WebsocketService } from './services/Websocket';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, Batch, History, Credits, Configure],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./app.css'],
})
export class App {
  view = 'play' as 'play' | 'history' | 'configure' | 'credits';

  constructor(private websocket: WebsocketService) {}

  setView(value: 'play' | 'history' | 'configure' | 'credits') {
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

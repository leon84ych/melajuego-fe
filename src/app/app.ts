import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { History } from './components/history/history';
import { About } from './components/about/about';
import { Connection } from './components/connection/connection';
import { WebsocketService } from './services/Websocket';
import { GameRoom } from './components/game-room/game-room';
import { ProfileService } from './services/ProfileService';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, GameRoom, History, About, Connection, Connection],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./app.css'],
})
export class App implements OnInit {

  view = 'play' as 'play' | 'history' | 'connection' | 'about';



  username: string = '';

  constructor(private websocket: WebsocketService, private profileService: ProfileService) { }

  ngOnInit(): void {
    this.loadUserData();
  }

  loadUserData(): void {
    const sessionRaw = localStorage.getItem('game_session') || sessionStorage.getItem('game_session');
    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw);
        this.username = session.nickname || '';
      } catch (e) {
        console.error('Error parsing game_session', e);
      }
    }
  }

  setView(value: 'play' | 'history' | 'connection' | 'about') {
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
    }
  }
}

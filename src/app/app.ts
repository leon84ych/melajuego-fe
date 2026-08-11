import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { History } from './components/history/history';
import { About } from './components/about/about';
import { Connection } from './components/connection/connection';
import { WebsocketService } from './services/Websocket';
import { GameRoom } from './components/game-room/game-room';

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

  configStatus: 'red' | 'yellow' | 'green' = 'red';

  username: string = '';

  constructor(private websocket: WebsocketService) { }


  ngOnInit(): void {
    this.loadUserData();
    this.checkConfiguration();
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

  checkConfiguration(): void {
    // 1. Immediately change status to loading/checking (Yellow)
    this.configStatus = 'yellow';
    const profilesOne = localStorage.getItem('ProfilesOne');
    const profilesTwo = localStorage.getItem('ProfilesTwo');
    if (profilesOne && profilesTwo) {
      this.configStatus = 'green';
    }else{
      this.configStatus = 'red';
      
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
      // Ignore malformed saved session
    }
  }
}

import { Component, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

import { RoomState } from '../../data/DataInterfaces';
import { WebsocketService } from '../../services/Websocket';

@Component({
  selector: 'players-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './playersList.html',
  styleUrls: ['./playersList.css'],
})
export class PlayersList implements OnDestroy {

  roomName = signal('');
  nickname = signal('');
  currentNickname = signal('');
  connectedUsers = signal<string[]>([]);
  sortedUsers = computed(() => {
    const current = String(this.currentNickname()).trim().toLowerCase();
    const users = this.connectedUsers();
    if (!current || users.length === 0) {
      return users;
    }
    const leadingUsers = users.filter((nick) => String(nick).trim().toLowerCase() === current);
    const remainingUsers = users.filter((nick) => String(nick).trim().toLowerCase() !== current);
    return [...leadingUsers, ...remainingUsers];
  });

  roomHost = signal('');
  totalUsers = signal(0);

  private subscription = new Subscription();

  constructor(private websocket: WebsocketService) {
    const stored = sessionStorage.getItem('game_session') || localStorage.getItem('game_session');
    if (stored) {
      try {
        const session = JSON.parse(stored) as { nickname?: string; room?: string };
        this.nickname.set(session.nickname ?? '');
        this.currentNickname.set(session.nickname ?? '');
        this.roomName.set(session.room ?? '');
        if (this.nickname() && this.roomName()) {
          this.connectedUsers.set([this.nickname()]);
          this.totalUsers.set(1);
        }
      } catch {
        this.roomName.set('');
      }
    }

    this.subscription.add(
      this.websocket.roomState$.subscribe((state: RoomState) => {
        console.log('[Room] roomState update', state);
        if (state.roomCode) {
          this.roomName.set(state.roomCode);
        }
        this.roomHost.set(state.host);
        this.connectedUsers.set(state.connectedUsers ?? []);
        this.totalUsers.set(state.totalUsers ?? (state.connectedUsers?.length ?? 0));
      })
    );

  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}

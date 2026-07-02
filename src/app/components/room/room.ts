import { Component, OnDestroy, WritableSignal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WebsocketService, RoomState } from '../../services/Websocket';

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './room.html',
  styleUrls: ['./room.css'],
})
export class Room implements OnDestroy {
  roomName = signal('');
  nickname = signal('');
  connectedUsers = signal<string[]>([]);
  roomMessage = signal('');
  totalUsers = signal(0);
  private subscription = new Subscription();

  constructor(private websocket: WebsocketService) {
    const stored = sessionStorage.getItem('game_session') || localStorage.getItem('game_session');
    if (stored) {
      try {
        const session = JSON.parse(stored) as { nickname?: string; room?: string };
        this.nickname.set(session.nickname ?? '');
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
        if (state.roomName) {
          this.roomName.set(state.roomName);
        }
        this.connectedUsers.set(state.connectedUsers ?? []);
        this.roomMessage.set(state.message ?? '');
        this.totalUsers.set(state.totalUsers ?? (state.connectedUsers?.length ?? 0));
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}

import { Component, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import profiles from '../../data/Profiles.json';
import { WebsocketService, RoomState, BatchStartedPayload } from '../../services/Websocket';

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
  currentNickname = signal('');
  connectedUsers = signal<string[]>([]);
  roomMessage = signal('');
  batchMessage = signal('');
  totalUsers = signal(0);
  batchInProgress = false;
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
        if (state.roomName) {
          this.roomName.set(state.roomName);
        }
        this.connectedUsers.set(state.connectedUsers ?? []);
        this.roomMessage.set(state.message ?? '');
        this.totalUsers.set(state.totalUsers ?? (state.connectedUsers?.length ?? 0));
      })
    );

    this.subscription.add(
      this.websocket.batchStarted$.subscribe((payload: BatchStartedPayload) => {
        if (!payload) {
          return;
        }
        this.batchMessage.set(`Partida iniciada por ${payload.host}. Mazo recibido (${payload.itemIds.length} cartas).`);
        this.batchInProgress = true;
      })
    );
  }

  requestBatchStart() {
    if (!this.roomName()) {
      return;
    }
    this.batchMessage.set('Iniciando partida… solicitando mazo compartido.');
    this.batchInProgress = true;
    const itemIds = this.pickRandomItemIds();
    this.websocket.startBatch(this.roomName(), itemIds);
  }

  private pickRandomItemIds(): string[] {
    const allIds = (profiles as { id: string | number }[])
      .map((item) => String(item.id))
      .filter((id) => id.length > 0);

    const shuffled = [...allIds].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 10);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}

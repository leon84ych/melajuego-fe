import { Component, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import profiles from '../../data/Profiles.json';
import { BatchStartedPayload, RoomBatchScores, RoomState } from '../../data/DataInterfaces';
import { WebsocketService } from '../../services/Websocket';
import { Configuration } from '../../data/Configuration';

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './room.html',
  styleUrls: ['./room.css'],
})
export class Room implements OnDestroy {
  private readonly messageDurationMs = Configuration.messageTimeout;
  readonly durationOptions = [1, 5, 10];
  roomName = signal('');
  nickname = signal('');
  currentNickname = signal('');
  selectedDurationMinutes = signal(5);
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
  roomMessage = signal('');
  batchMessage = signal('');
  roomHost = signal('');
  totalUsers = signal(0);
  batchInProgress = false;
  private roomMessageTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private batchMessageTimeoutId: ReturnType<typeof setTimeout> | null = null;
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
        this.setTimedRoomMessage(state.message ?? '');
        this.totalUsers.set(state.totalUsers ?? (state.connectedUsers?.length ?? 0));
      })
    );

    this.subscription.add(
      this.websocket.batchStarted$.subscribe((payload: BatchStartedPayload | null) => {
        if (!payload) {
          return;
        }
        this.setTimedBatchMessage(`Partida iniciada por ${payload.host}. Mazo recibido (${payload.itemIds.length} cartas).`);
        this.batchInProgress = true;
      })
    );

    this.subscription.add(
      this.websocket.roomBatchScores$.subscribe((scores: RoomBatchScores) => {
        if (!scores?.roomCode) {
          return;
        }

        const currentRoom = String(this.roomName()).trim().toUpperCase();
        const scoresRoom = String(scores.roomCode).trim().toUpperCase();
        if (!currentRoom || currentRoom !== scoresRoom) {
          return;
        }

        if (scores.gameFinished) {
          this.batchInProgress = false;
          this.setTimedBatchMessage('Partida finalizada. Puedes iniciar otro juego.');
        }
      })
    );
  }

  requestBatchStart(selectedDuration?: string | number) {
    if (!this.roomName()) {
      return;
    }
    const parsedSelectedDuration = Number(selectedDuration ?? this.selectedDurationMinutes());
    const duration = this.durationOptions.includes(parsedSelectedDuration)
      ? parsedSelectedDuration
      : this.selectedDurationMinutes();

    this.selectedDurationMinutes.set(duration);
    this.setTimedBatchMessage(`Iniciando partida (${duration} min)... solicitando mazo compartido.`);
    this.batchInProgress = true;
    const itemIds = this.pickRandomItemIds();
    this.websocket.startBatch(this.roomName(), itemIds, duration);
  }

  onDurationChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement)?.value);
    if (this.durationOptions.includes(value)) {
      this.selectedDurationMinutes.set(value);
    }
  }

  private setTimedRoomMessage(message: string) {
    this.roomMessage.set(message);
    this.scheduleRoomMessageClear(message);
  }

  private setTimedBatchMessage(message: string) {
    this.batchMessage.set(message);
    this.scheduleBatchMessageClear(message);
  }

  private scheduleRoomMessageClear(message: string) {
    if (this.roomMessageTimeoutId) {
      clearTimeout(this.roomMessageTimeoutId);
      this.roomMessageTimeoutId = null;
    }

    if (!message) {
      return;
    }

    this.roomMessageTimeoutId = setTimeout(() => {
      this.roomMessage.set('');
      this.roomMessageTimeoutId = null;
    }, this.messageDurationMs);
  }

  private scheduleBatchMessageClear(message: string) {
    if (this.batchMessageTimeoutId) {
      clearTimeout(this.batchMessageTimeoutId);
      this.batchMessageTimeoutId = null;
    }

    if (!message) {
      return;
    }

    this.batchMessageTimeoutId = setTimeout(() => {
      this.batchMessage.set('');
      this.batchMessageTimeoutId = null;
    }, this.messageDurationMs);
  }

  private pickRandomItemIds(): string[] {
    const allIds = (profiles as { id: string | number }[])
      .map((item) => String(item.id))
      .filter((id) => id.length > 0);

    const shuffled = [...allIds].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 10);
  }

  ngOnDestroy() {
    if (this.roomMessageTimeoutId) {
      clearTimeout(this.roomMessageTimeoutId);
    }
    if (this.batchMessageTimeoutId) {
      clearTimeout(this.batchMessageTimeoutId);
    }
    this.subscription.unsubscribe();
  }
}

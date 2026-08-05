import { Injectable, effect, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import profiles from '../../../../data/Profiles.json';
import { BatchStartedPayload, RoomBatchScores } from '../../../../data/DataInterfaces';
import { Configuration } from '../../../../data/Configuration';
import { WebsocketService } from '../../../Websocket';

@Injectable({
  providedIn: 'root',
})
export class CardSwipeService {
  private readonly messageDurationMs = Configuration.messageTimeout;
  readonly durationOptions = [1, 5, 10];

  readonly selectedDurationMinutes = signal(5);
  readonly roomName = signal('');
  readonly roomMessage = signal('');
  readonly batchMessage = signal('');
  readonly gameInProgress = signal(false);

  private roomMessageTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private batchMessageTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private subscription = new Subscription();
  private readonly websocket = inject(WebsocketService);

  constructor() {
    this.roomName.set(this.websocket.roomName());

    effect(() => {
      this.roomName.set(this.websocket.roomName());
    });

    this.subscription.add(
      this.websocket.batchStarted$.subscribe((payload: BatchStartedPayload | null) => {
        if (!payload) {
          return;
        }

        this.setTimedBatchMessage(`Partida iniciada por ${payload.host}. Mazo recibido (${payload.itemIds.length} cartas).`);
        this.gameInProgress.set(true);
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
          this.gameInProgress.set(false);
          this.setTimedBatchMessage('Partida finalizada. Puedes iniciar otro juego.');
        }
      })
    );
  }

  setSelectedDuration(selectedDuration?: string | number): void {
    const value = Number(selectedDuration);
    if (this.durationOptions.includes(value)) {
      this.selectedDurationMinutes.set(value);
    }
  }

  getSelectedDuration(selectedDuration?: string | number, fallback = 5): number {
    const parsedSelectedDuration = Number(selectedDuration ?? fallback);
    return this.durationOptions.includes(parsedSelectedDuration)
      ? parsedSelectedDuration
      : fallback;
  }

  requestBatchStart(selectedDuration?: string | number, roomName?: string) {
    const currentRoomName = String(roomName ?? this.roomName()).trim();
    if (!currentRoomName) {
      return;
    }

    const duration = this.getSelectedDuration(selectedDuration, this.selectedDurationMinutes());
    this.selectedDurationMinutes.set(duration);
    this.setTimedBatchMessage(`Iniciando partida (${duration} min)... solicitando mazo compartido.`);
    this.gameInProgress.set(true);
    const itemIds = this.pickRandomItemIds();
    this.websocket.startBatch(currentRoomName, itemIds, duration);
  }

  pickRandomItemIds(limit = 10): string[] {
    const allIds = (profiles as { id: string | number }[])
      .map((item) => String(item.id))
      .filter((id) => id.length > 0);

    const shuffled = [...allIds].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  }

  isHost(roomHost: string | null | undefined): boolean {
    const currentUser = String(this.websocket.nickname()).trim().toLowerCase();
    const host = String(roomHost ?? '').trim().toLowerCase();
    //TODO: Considerar que si no hay host, el primer usuario en iniciar el juego es el host. Esto se puede hacer verificando si el host está vacío y si el currentUser es el primero en la lista de connectedUsers.
    if(host.length === 0) {
      return true;
    }
    return currentUser.length > 0 && currentUser === host;
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

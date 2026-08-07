import { Injectable, effect, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ProfileService } from '../../../ProfileService';
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
  readonly gameInProgress = signal(false);

  private roomMessageTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private batchMessageTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private subscription = new Subscription();
  private profileIds: string[] = [];
  private readonly profileService = inject(ProfileService);
  private readonly websocket = inject(WebsocketService);

  constructor() {
    this.roomName.set(this.websocket.roomName());
    void this.loadProfileIds();

    effect(() => {
      this.roomName.set(this.websocket.roomName());
    });

    this.subscription.add(
      this.websocket.batchStarted$.subscribe((payload: BatchStartedPayload | null) => {
        if (!payload) {
          return;
        }

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

  async requestBatchStart(selectedDuration?: string | number, roomName?: string) {
    const currentRoomName = String(roomName ?? this.roomName()).trim();
    if (!currentRoomName) {
      return;
    }

    const duration = this.getSelectedDuration(selectedDuration, this.selectedDurationMinutes());
    this.selectedDurationMinutes.set(duration);
    this.gameInProgress.set(true);
    const itemIds = await this.pickRandomItemIds();
    if (!itemIds.length) {
      this.gameInProgress.set(false);
      return;
    }
    //como estoy en el juego card-swipe el componente es fijo
    this.websocket.startBatch(currentRoomName, 'SWIPE', itemIds, duration);
  }

  async pickRandomItemIds(limit = 10): Promise<string[]> {
    if (this.profileIds.length === 0) {
      await this.loadProfileIds();
    }

    const shuffled = [...this.profileIds].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  }

  isHost(roomHost: string | null | undefined): boolean {
    const currentUser = String(this.websocket.nickname()).trim().toLowerCase();
    const host = String(roomHost ?? '').trim().toLowerCase();
    //TODO: Considerar que si no hay host, el primer usuario en iniciar el juego es el host. Esto se puede hacer verificando si el host está vacío y si el currentUser es el primero en la lista de connectedUsers.
    if (host.length === 0) {
      return true;
    }
    return currentUser.length > 0 && currentUser === host;
  }

  private async loadProfileIds(): Promise<void> {
    const profiles = await this.profileService.getCombinedProfiles();
    this.profileIds = profiles
      .map((item) => String(item.id))
      .filter((id) => id.length > 0);
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

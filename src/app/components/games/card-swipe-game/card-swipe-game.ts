import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { BaseGameComponent, BatchStartedPayload, RoomBatchScores } from '../../../data/DataInterfaces';
import { CardSet } from './card-set/card-set';
import { RoomScores } from '../../scores/room-scores';
import { CommonModule } from '@angular/common';
import profiles from '../../../data/Profiles.json';
import { WebsocketService } from '../../../services/Websocket';
import { Subscription } from 'rxjs';
import { Configuration } from '../../../data/Configuration';


@Component({
  selector: 'app-card-swipe-game',
  imports: [CardSet, RoomScores, CommonModule],
  templateUrl: './card-swipe-game.html',
  styleUrls: ['./card-swipe-game.css'],
})
export class CardSwipeGame implements BaseGameComponent {

  private readonly messageDurationMs = Configuration.messageTimeout;

  @Input() payload: any;
  @Output() onGameComplete = new EventEmitter<any>();

  readonly durationOptions = [1, 5, 10];

  selectedDurationMinutes = signal(5);
  gameInProgress = false;
  isHost = false;

  roomName = signal('');
  roomMessage = signal('');
  batchMessage = signal('');

  private roomMessageTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private batchMessageTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private subscription = new Subscription();


  constructor(private websocket: WebsocketService) {


    this.subscription.add(
      this.websocket.batchStarted$.subscribe((payload: BatchStartedPayload | null) => {
        if (!payload) {
          return;
        }
        this.setTimedBatchMessage(`Partida iniciada por ${payload.host}. Mazo recibido (${payload.itemIds.length} cartas).`);
        this.gameInProgress = true;
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
          this.gameInProgress = false;
          this.setTimedBatchMessage('Partida finalizada. Puedes iniciar otro juego.');
        }
      })
    );
  }





  shouldShowRoomScores(): boolean {
    return false;
    //return this.isPlayingInRoom() && !this.isSoloGame() && (this.batchComplete || this.sharedGameFinished());
  }

  onDurationChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement)?.value);
    if (this.durationOptions.includes(value)) {
      this.selectedDurationMinutes.set(value);
    }
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
    this.gameInProgress = true;
    const itemIds = this.pickRandomItemIds();
    this.websocket.startBatch(this.roomName(), itemIds, duration);
  }

  private pickRandomItemIds(): string[] {
    const allIds = (profiles as { id: string | number }[])
      .map((item) => String(item.id))
      .filter((id) => id.length > 0);

    const shuffled = [...allIds].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 10);
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

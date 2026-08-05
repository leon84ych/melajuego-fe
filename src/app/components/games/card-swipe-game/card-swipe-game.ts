import { Component, EventEmitter, Input, Output, inject, input } from '@angular/core';
import { BaseGameComponent, GameCardSwipePayload, GameCardSwipeResult, PlayersListState } from '../../../data/DataInterfaces';
import { CardSet } from './card-set/card-set';
import { CardSwipeRoomScores } from './card-swipe-room-scores/card-swipe-room-scores';
import { CommonModule } from '@angular/common';
import { CardSwipeService } from '../../../services/games/card-swipe-game/card-swipe/card-swipe-service';
import { CardSetService } from '../../../services/games/card-swipe-game/card-set/card-set-service';

@Component({
  selector: 'app-card-swipe-game',
  imports: [CardSet, CardSwipeRoomScores, CommonModule],
  templateUrl: './card-swipe-game.html',
  styleUrls: ['./card-swipe-game.css'],
})
export class CardSwipeGame implements BaseGameComponent<GameCardSwipePayload, GameCardSwipeResult> {
  
  state = input.required<PlayersListState>();
  @Input() payload!: GameCardSwipePayload;
  @Output() onGameComplete = new EventEmitter<GameCardSwipeResult>();

  private readonly cardSwipeService = inject(CardSwipeService);
  private readonly cardSetService = inject(CardSetService);

  readonly durationOptions = this.cardSwipeService.durationOptions;
  readonly selectedDurationMinutes = this.cardSwipeService.selectedDurationMinutes;
  readonly roomName = this.cardSwipeService.roomName;
  readonly roomMessage = this.cardSwipeService.roomMessage;
  readonly batchMessage = this.cardSwipeService.batchMessage;
  readonly batchStarted = this.cardSwipeService.gameInProgress;

  get batchComplete(): boolean {
    return this.cardSetService.batchComplete;
  }

  isPlayingInRoom(): boolean {
    return this.cardSetService.isPlayingInRoom();
  }

  onDurationChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement)?.value);
    this.cardSwipeService.setSelectedDuration(value);
  }

  requestBatchStart(selectedDuration?: string | number) {
    this.cardSwipeService.requestBatchStart(selectedDuration, this.roomName());
  }

  isHost(): boolean {
    return this.cardSwipeService.isHost(this.state().roomHost);
  }

  nextBatch(): void {
    if (!this.cardSetService.isPlayingInRoom()) {
      this.cardSetService.nextBatch();
    }
  }

  restart(): void {
    if (!this.cardSetService.isPlayingInRoom()) {
      this.cardSetService.restart();
    }
  }
}

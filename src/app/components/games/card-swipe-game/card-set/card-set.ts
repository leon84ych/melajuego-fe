import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardSetService } from '../../../../services/games/card-swipe-game/card-set/card-set-service';
import { Card } from '../card/card';
import { CardSwipeScore } from '../card-swipe-score/card-swipe-score';
import { CardData } from '../../../../data/DataInterfaces';

@Component({
  selector: 'app-card-set',
  standalone: true,
  imports: [Card, CardSwipeScore, CommonModule],
  templateUrl: './card-set.html',
  styleUrls: ['./card-set.css'],
})
export class CardSet {
  private readonly cardSetService = inject(CardSetService);

  protected readonly title = this.cardSetService.title;
  readonly isSoloGame = this.cardSetService.isSoloGame;
  readonly showRoomPanel = this.cardSetService.showRoomPanel;
  readonly showCountdown = this.cardSetService.showCountdown;
  readonly sharedBatchReceived = this.cardSetService.sharedBatchReceived;
  readonly sharedGameFinished = this.cardSetService.sharedGameFinished;
  readonly batchSize = this.cardSetService.batchSize;
  readonly batchHistory = this.cardSetService.batchHistory;
  readonly batchStart = this.cardSetService.batchStart;
  readonly batchPosition = this.cardSetService.batchPosition;
  readonly batchScore = this.cardSetService.batchScore;
  readonly batchErrors = this.cardSetService.batchErrors;
  readonly timeRemainingSeconds = this.cardSetService.timeRemainingSeconds;
  readonly batchDurationMinutes = this.cardSetService.batchDurationMinutes;
  readonly batchRenderVersion = this.cardSetService.batchRenderVersion;

  get currentBatch() {
    return this.cardSetService.currentBatch;
  }

  get currentCard() {
    return this.cardSetService.currentCard;
  }

  get batchComplete() {
    return this.cardSetService.batchComplete;
  }

  get percentScore(): number {
    return this.cardSetService.percentScore;
  }

  get scoreColor() {
    return this.cardSetService.scoreColor;
  }

  get hasNextBatch() {
    return this.cardSetService.hasNextBatch;
  }

  get formattedTimeRemaining() {
    return this.cardSetService.formattedTimeRemaining;
  }

  get incorrectSwipes() {
    return this.cardSetService.incorrectSwipes;
  }

  get batchResults() {
    return this.cardSetService.batchResults();
  }

  trackCard = (_index: number, card: CardData) => {
    return this.cardSetService.trackCard(_index, card);
  };

  isPlayingInRoom(): boolean {
    return this.cardSetService.isPlayingInRoom();
  }

  isSharedSession(): boolean {
    return this.cardSetService.isSharedSession();
  }

  shouldWaitForSharedBatch(): boolean {
    return this.cardSetService.shouldWaitForSharedBatch();
  }

  isWaitingForOtherPlayers(): boolean {
    return this.cardSetService.waitingForOthers;
  }

  shouldShowRoomScores(): boolean {
    return this.cardSetService.showRoomScores;
  }

  shouldShowCards(): boolean {
    return this.cardSetService.shouldShowCards();
  }

  actionLabel(action: 'like' | 'dislike'): string {
    return this.cardSetService.actionLabel(action);
  }

  expectedLabel(cardId: string | number): string {
    return this.cardSetService.expectedLabel(cardId);
  }

  @Output() nextBatch = new EventEmitter<void>();
  @Output() restart = new EventEmitter<void>();

  handleDecision(event: { id: string | number; action: 'like' | 'dislike' }): void {
    this.cardSetService.handleDecision(event);
  }
}

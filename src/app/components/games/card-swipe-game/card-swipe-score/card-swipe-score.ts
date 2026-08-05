import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardSetService } from '../../../../services/games/card-swipe-game/card-set/card-set-service';
import { CardData, SwipeRecord } from '../../../../data/DataInterfaces';

@Component({
  selector: 'app-card-swipe-score',
  imports: [CommonModule],
  templateUrl: './card-swipe-score.html',
  styleUrl: './card-swipe-score.css',
})
export class CardSwipeScore {
  private readonly cardSetService = inject(CardSetService);
  readonly selectedProfileIndex = signal(0);

  @Input() percentScoreOverride?: number;
  @Input() batchScoreOverride?: number;
  @Input() totalCardsOverride?: number;
  @Input() batchErrorsOverride?: number;
  @Input() scoreColorOverride?: 'red' | 'yellow' | 'green';
  @Input() incorrectSwipesOverride?: SwipeRecord[];
  @Input() profileReviewItemsOverride?: Array<CardData & { result: 'success' | 'error' | 'pending' }>;
  @Input() actionLabelOverride?: (action: 'like' | 'dislike') => string;
  @Input() expectedLabelOverride?: (cardId: string | number) => string;
  @Input() showActions = true;

  @Output() nextBatch = new EventEmitter<void>();
  @Output() restart = new EventEmitter<void>();

  get percentScore(): number {
    return this.percentScoreOverride ?? this.cardSetService.percentScore;
  }

  get batchScore(): number {
    return this.batchScoreOverride ?? this.cardSetService.batchScore();
  }

  get totalCards(): number {
    return this.totalCardsOverride ?? this.cardSetService.currentBatch.length;
  }

  get batchErrors(): number {
    return this.batchErrorsOverride ?? this.cardSetService.batchErrors();
  }

  get scoreColor(): 'red' | 'yellow' | 'green' {
    return this.scoreColorOverride ?? this.cardSetService.scoreColor;
  }

  get incorrectSwipes(): SwipeRecord[] {
    return this.incorrectSwipesOverride ?? this.cardSetService.incorrectSwipes;
  }

  get profileReviewItems(): Array<CardData & { result: 'success' | 'error' | 'pending' }> {
    if (this.profileReviewItemsOverride && this.profileReviewItemsOverride.length > 0) {
      return this.profileReviewItemsOverride;
    }

    const batch = this.cardSetService.currentBatch;
    const results = this.cardSetService.batchResults();
    return batch.map((item, index) => ({
      ...item,
      result: results[index] ?? 'pending',
    }));
  }

  get selectedProfile(): (CardData & { result: 'success' | 'error' | 'pending' }) | null {
    const items = this.profileReviewItems;
    return items[this.selectedProfileIndex()] ?? items[0] ?? null;
  }

  actionLabel(action: 'like' | 'dislike'): string {
    return this.actionLabelOverride?.(action) ?? this.cardSetService.actionLabel(action);
  }

  getUserAction(cardId: string | number): 'like' | 'dislike' | undefined {
    const record = this.incorrectSwipes.find((item) => item.cardId === cardId);
    return record?.actionTaken;
  }

  expectedLabel(cardId: string | number): string {
    return this.expectedLabelOverride?.(cardId) ?? this.cardSetService.expectedLabel(cardId);
  }

  setSelectedProfile(index: number): void {
    const length = this.profileReviewItems.length;
    if (length === 0) {
      return;
    }

    const clamped = Math.max(0, Math.min(index, length - 1));
    this.selectedProfileIndex.set(clamped);
  }

  selectPreviousProfile(): void {
    this.setSelectedProfile(this.selectedProfileIndex() - 1);
  }

  selectNextProfile(): void {
    this.setSelectedProfile(this.selectedProfileIndex() + 1);
  }

  onNextBatch(): void {
    this.nextBatch.emit();
  }

  onRestart(): void {
    this.restart.emit();
  }
}

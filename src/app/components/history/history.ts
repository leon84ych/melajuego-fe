import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileService } from '../../services/ProfileService';
import { BatchSession, CardData, SwipeRecord } from '../../data/DataInterfaces';
import { CardSwipeScore } from '../games/card-swipe-game/card-swipe-score/card-swipe-score';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, CardSwipeScore],
  templateUrl: './history.html',
  styleUrls: ['./history.css'],
})
export class History {
  public batchHistory: BatchSession[] = [];
  readonly pageSize = 10;
  currentPage = 1;
  private profiles: CardData[] = [];
  private readonly profileService = inject(ProfileService);

  constructor() {
    this.loadHistoryFromStorage();
    void this.loadProfiles();
  }

  private loadHistoryFromStorage() {
    const storedData = localStorage.getItem('match_history');
    if (storedData) {
      this.batchHistory = JSON.parse(storedData);
    }
  }

  // Optional helper to let users wipe their historical stats
  clearAllHistory() {
    localStorage.removeItem('match_history');
    this.batchHistory = [];
    this.currentPage = 1;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.batchHistory.length / this.pageSize));
  }

  get paginatedHistory(): BatchSession[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.batchHistory.slice(start, end);
  }

  get canGoPrev(): boolean {
    return this.currentPage > 1;
  }

  get canGoNext(): boolean {
    return this.currentPage < this.totalPages;
  }

  goPrevPage(): void {
    if (this.canGoPrev) {
      this.currentPage -= 1;
    }
  }

  goNextPage(): void {
    if (this.canGoNext) {
      this.currentPage += 1;
    }
  }

  actionLabel(action: 'like' | 'dislike'): string {
    return action === 'like' ? 'Sí Apoyó' : 'No Apoyó';
  }

  expectedLabel(cardId: string | number): string {
    return String(cardId).toLowerCase().startsWith('one') ? 'Sí Apoyó' : 'No Apoyó';
  }

  getScoreColor(session: BatchSession): 'red' | 'yellow' | 'green' {
    const totalCards = session.correctCount + session.incorrectCount;
    if (totalCards === 0) {
      return 'yellow';
    }

    const percentScore = Math.round((session.correctCount / totalCards) * 100);
    if (percentScore < 30) {
      return 'red';
    }
    if (percentScore > 81) {
      return 'green';
    }
    return 'yellow';
  }

  getSessionReviewItems(session: BatchSession): Array<CardData & { result: 'success' | 'error' | 'pending' }> {
    const profilesById = new Map<string | number, CardData>(
      this.profiles.map((profile) => [profile.id, profile])
    );

    return [
      ...session.correctSwipes.map((item) => ({
        ...(profilesById.get(item.cardId) ?? { id: item.cardId, title: item.title, subtitle: item.subtitle, imageUrl: '' }),
        ...item,
        result: 'success' as const,
      })),
      ...session.incorrectSwipes.map((item) => ({
        ...(profilesById.get(item.cardId) ?? { id: item.cardId, title: item.title, subtitle: item.subtitle, imageUrl: '' }),
        ...item,
        result: 'error' as const,
      })),
    ];
  }

  private async loadProfiles(): Promise<void> {
    this.profiles = await this.profileService.getCombinedProfiles();
  }

  getPercentScore(session: BatchSession): number {
    const totalCards = session.correctCount + session.incorrectCount;
    if (totalCards === 0) {
      return 0;
    }

    return Math.round((session.correctCount / totalCards) * 100);
  }
}

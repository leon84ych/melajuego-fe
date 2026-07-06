import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BatchSession } from '../../data/DataInterfaces';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.html',
  styleUrls: ['./history.css'],
})
export class History {
  public batchHistory: BatchSession[] = [];
  readonly pageSize = 10;
  currentPage = 1;

  constructor() {
    this.loadHistoryFromStorage();
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
}

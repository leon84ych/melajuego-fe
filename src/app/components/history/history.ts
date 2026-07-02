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
  }
}

import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { RoomBatchScores } from '../../data/DataInterfaces';
import { WebsocketService } from '../../services/Websocket';

@Component({
  selector: 'app-scores',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scores.html',
  styleUrls: ['./scores.css'],
})
export class Scores implements OnInit, OnDestroy {
  roomBatchScores = signal<RoomBatchScores | null>(null);
  private subscription = new Subscription();

  constructor(private websocket: WebsocketService) {}

  ngOnInit() {
    this.subscription.add(
      this.websocket.roomBatchScores$.subscribe((scores) => {
        if (!scores) {
          return;
        }
        this.roomBatchScores.set(scores);
        localStorage.setItem(`room_batch_scores_${scores.roomCode}`, JSON.stringify(scores));
      })
    );

    this.loadStoredRoomBatchScores();
    const roomCode = this.getSavedRoomCode();
    if (roomCode) {
      this.websocket.requestRoomBatchScores(roomCode);
    }
  }

  private getSavedRoomCode(): string | null {
    const sessionJSON = sessionStorage.getItem('game_session') || localStorage.getItem('game_session');
    if (!sessionJSON) {
      return null;
    }

    try {
      const session = JSON.parse(sessionJSON) as { room?: string };
      return (session.room || '').trim() || null;
    } catch {
      return null;
    }
  }

  private loadStoredRoomBatchScores() {
    const roomCode = this.getSavedRoomCode();
    if (!roomCode) {
      return;
    }

    const stored = localStorage.getItem(`room_batch_scores_${roomCode}`);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as RoomBatchScores;
      this.roomBatchScores.set(parsed);
    } catch {
      // Ignore malformed storage
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}

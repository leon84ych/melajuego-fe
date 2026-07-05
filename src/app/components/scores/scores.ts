import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ParticipantBatchResult, RoomBatchScores } from '../../data/DataInterfaces';
import { WebsocketService } from '../../services/Websocket';

type ParticipantResultView = ParticipantBatchResult & {
  responseSeconds: number | null;
  responseDeltaSeconds: number | null;
};

@Component({
  selector: 'app-scores',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scores.html',
  styleUrls: ['./scores.css'],
})
export class Scores implements OnInit, OnDestroy {
  roomBatchScores = signal<RoomBatchScores | null>(null);
  private readonly roomBatchScoresStoragePrefix = 'room_batch_scores_';

  private parseTime(value?: string): number {
    return Date.parse(value ?? '');
  }

  private getElapsedSeconds(startTimeMs: number, endTimeISO?: string): number | null {
    if (!Number.isFinite(startTimeMs)) {
      return null;
    }

    const endTimeMs = this.parseTime(endTimeISO);
    if (!Number.isFinite(endTimeMs)) {
      return null;
    }

    return Math.max(0, Math.round((endTimeMs - startTimeMs) / 1000));
  }

  sortedParticipantResults = computed(() => {
    const scores = this.roomBatchScores();
    if (!scores) {
      return [];
    }

    const startTimeMs = this.parseTime(scores.startedAt || scores.updatedAt);
    const withTimes: ParticipantResultView[] = scores.participantResults.map((participant) => ({
      ...participant,
      responseSeconds: this.getElapsedSeconds(startTimeMs, participant.timestamp),
      responseDeltaSeconds: null,
    }));

    const firstResponseSeconds = withTimes
      .map((participant) => participant.responseSeconds)
      .filter((seconds): seconds is number => seconds !== null)
      .reduce((min, current) => Math.min(min, current), Number.POSITIVE_INFINITY);

    const hasFirstResponse = Number.isFinite(firstResponseSeconds);
    const enrichedResults = withTimes.map((participant) => ({
      ...participant,
      responseDeltaSeconds:
        hasFirstResponse && participant.responseSeconds !== null
          ? Math.max(0, participant.responseSeconds - firstResponseSeconds)
          : null,
    }));

    return [...enrichedResults].sort((a, b) => {
      if (b.percentScore !== a.percentScore) {
        return b.percentScore - a.percentScore;
      }

      if (b.correctCount !== a.correctCount) {
        return b.correctCount - a.correctCount;
      }

      const aTime = this.parseTime(a.timestamp);
      const bTime = this.parseTime(b.timestamp);

      if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) {
        return a.nickname.localeCompare(b.nickname, 'es');
      }
      if (!Number.isFinite(aTime)) {
        return 1;
      }
      if (!Number.isFinite(bTime)) {
        return -1;
      }

      if (aTime !== bTime) {
        return aTime - bTime;
      }

      return a.nickname.localeCompare(b.nickname, 'es');
    });
  });

  leadingParticipant = computed(() => {
    const sorted = this.sortedParticipantResults();
    return sorted.length > 0 ? sorted[0] : null;
  });

  private subscription = new Subscription();

  constructor(private websocket: WebsocketService) {}

  ngOnInit() {
    this.subscription.add(
      this.websocket.roomBatchScores$.subscribe((scores) => {
        if (!scores) {
          return;
        }
        this.roomBatchScores.set(scores);
        this.storeRoomBatchScores(scores);
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

    const stored = this.getLatestStoredRoomBatchScores(roomCode);
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

  private storeRoomBatchScores(scores: RoomBatchScores) {
    const timestamp = scores.updatedAt || new Date().toISOString();
    localStorage.setItem(
      `${this.roomBatchScoresStoragePrefix}${scores.roomCode}_${timestamp}`,
      JSON.stringify(scores)
    );
  }

  private getLatestStoredRoomBatchScores(roomCode: string): string | null {
    const prefix = `${this.roomBatchScoresStoragePrefix}${roomCode}_`;
    let latestKey: string | null = null;
    let latestTimestamp = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(prefix)) {
        continue;
      }

      const timestampText = key.slice(prefix.length);
      const timestamp = this.parseTime(timestampText);
      if (!Number.isFinite(timestamp) || timestamp <= latestTimestamp) {
        continue;
      }

      latestTimestamp = timestamp;
      latestKey = key;
    }

    if (latestKey) {
      return localStorage.getItem(latestKey);
    }

    return localStorage.getItem(`${this.roomBatchScoresStoragePrefix}${roomCode}`);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}

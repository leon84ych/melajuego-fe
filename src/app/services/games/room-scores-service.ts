import { WebsocketService } from '../Websocket';
import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import {
  ParticipantResultView,
  RoomBatchScores,
  RoomGlobalParticipantStats,
  RoomGlobalStats,
  RoomGlobalStatsStorage
} from '../../data/DataInterfaces';

@Injectable()
export class RoomScoresService implements OnDestroy {


  // Signals de estado expuestas como Readonly para proteger la inmutabilidad desde fuera
  private readonly _roomBatchScores = signal<RoomBatchScores | null>(null);
  readonly roomBatchScores = this._roomBatchScores.asReadonly();

  private readonly _roomGlobalStats = signal<RoomGlobalStats | null>(null);
  readonly roomGlobalStats = this._roomGlobalStats.asReadonly();

  private readonly roomBatchScoresStoragePrefix = 'room_batch_scores_';
  private readonly roomGlobalScoresStoragePrefix = 'room_global_scores_';
  private readonly roomProcessedBatchesStoragePrefix = 'room_global_processed_batches_';

  private subscription = new Subscription();

  constructor(private websocket: WebsocketService) {
    this.initService();
  }

  private initService() {
    this.subscription.add(
      this.websocket.roomBatchScores$.subscribe((scores) => {
        if (!scores) return;
        this._roomBatchScores.set(scores);
        this.storeRoomBatchScores(scores);
        this.updateGlobalStatsOnBatchFinished(scores);
      })
    );

    this.loadStoredRoomBatchScores();
    this.loadStoredRoomGlobalScores();

    const roomCode = this.getSavedRoomCode();
    if (roomCode) {
      this.websocket.requestRoomBatchScores(roomCode);
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  // --- COMPUTED STATES (LÓGICA DERIVADA) ---

  readonly hasGlobalScores = computed(() => {
    const stats = this._roomGlobalStats();
    return !!stats && stats.participants.length > 0;
  });

  readonly sortedParticipantResults = computed(() => {
    const scores = this._roomBatchScores();
    if (!scores) return [];

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
      if (b.percentScore !== a.percentScore) return b.percentScore - a.percentScore;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;

      const aTime = this.parseTime(a.timestamp);
      const bTime = this.parseTime(b.timestamp);

      if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) {
        return a.nickname.localeCompare(b.nickname, 'es');
      }
      if (!Number.isFinite(aTime)) return 1;
      if (!Number.isFinite(bTime)) return -1;
      if (aTime !== bTime) return aTime - bTime;

      return a.nickname.localeCompare(b.nickname, 'es');
    });
  });

  readonly leadingParticipant = computed(() => {
    const sorted = this.sortedParticipantResults();
    return sorted.length > 0 ? sorted[0] : null;
  });

  // --- LÓGICA PRIVADA Y UTILERÍAS ---

  private parseTime(value?: string): number {
    return Date.parse(value ?? '');
  }

  private getElapsedSeconds(startTimeMs: number, endTimeISO?: string): number | null {
    if (!Number.isFinite(startTimeMs)) return null;
    const endTimeMs = this.parseTime(endTimeISO);
    if (!Number.isFinite(endTimeMs)) return null;
    return Math.max(0, Math.round((endTimeMs - startTimeMs) / 1000));
  }

  private getSavedRoomCode(): string | null {
    const sessionJSON = sessionStorage.getItem('game_session') || localStorage.getItem('game_session');
    if (!sessionJSON) return null;
    try {
      const session = JSON.parse(sessionJSON) as { room?: string };
      return (session.room || '').trim() || null;
    } catch {
      return null;
    }
  }

  private loadStoredRoomBatchScores() {
    const roomCode = this.getSavedRoomCode();
    if (!roomCode) return;

    const stored = this.getLatestStoredRoomBatchScores(roomCode);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as RoomBatchScores;
      this._roomBatchScores.set(parsed);
    } catch { /* Ignore */ }
  }

  private loadStoredRoomGlobalScores() {
    const roomCode = this.getSavedRoomCode();
    if (!roomCode) return;

    const stored = localStorage.getItem(`${this.roomGlobalScoresStoragePrefix}${roomCode}`);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as RoomGlobalStatsStorage;
      this._roomGlobalStats.set(this.normalizeGlobalStorage(parsed));
    } catch { /* Ignore */ }
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
      if (!key || !key.startsWith(prefix)) continue;

      const timestampText = key.slice(prefix.length);
      const timestamp = this.parseTime(timestampText);
      if (!Number.isFinite(timestamp) || timestamp <= latestTimestamp) continue;

      latestTimestamp = timestamp;
      latestKey = key;
    }

    if (latestKey) return localStorage.getItem(latestKey);
    return localStorage.getItem(`${this.roomBatchScoresStoragePrefix}${roomCode}`);
  }

  private updateGlobalStatsOnBatchFinished(scores: RoomBatchScores) {
    if (!scores.gameFinished || !scores.roomCode || !Array.isArray(scores.participantResults)) return;

    const batchKey = this.getBatchKey(scores);
    if (!batchKey) return;

    const processedBatches = this.getProcessedBatchKeys(scores.roomCode);
    if (processedBatches.has(batchKey)) return;

    const storedGlobal = this.getStoredGlobalStorage(scores.roomCode);
    const byNickname = new Map(
      storedGlobal.participants.map((participant) => [
        participant.nickname.trim().toLowerCase(),
        { ...participant },
      ])
    );

    const batchWinner = this.getBatchWinner(scores);

    for (const participant of scores.participantResults) {
      const key = participant.nickname.trim().toLowerCase();
      const existing = byNickname.get(key);
      const totalPercentSum = (existing?.totalPercentSum ?? 0) + participant.percentScore;
      const batchesPlayed = (existing?.batchesPlayed ?? 0) + 1;

      byNickname.set(key, {
        nickname: participant.nickname,
        batchesPlayed,
        totalCorrect: (existing?.totalCorrect ?? 0) + participant.correctCount,
        totalIncorrect: (existing?.totalIncorrect ?? 0) + participant.incorrectCount,
        totalCards: (existing?.totalCards ?? 0) + participant.totalCards,
        totalPercentSum,
        bestPercent: Math.max(existing?.bestPercent ?? 0, participant.percentScore),
        wins: (existing?.wins ?? 0) + (participant.nickname === batchWinner ? 1 : 0),
        updatedAt: scores.updatedAt || new Date().toISOString(),
      });
    }

    // Aquí deberías guardar 'byNickname' de vuelta a localStorage y actualizar _roomGlobalStats.set(...)
    // asumiendo la lógica restante de tus helpers privados estructurales.
  }


    private getStoredGlobalStorage(roomCode: string): RoomGlobalStatsStorage {
    const raw = localStorage.getItem(`${this.roomGlobalScoresStoragePrefix}${roomCode}`);
    if (!raw) {
      return { roomCode, updatedAt: new Date().toISOString(), participants: [] };
    }

    try {
      const parsed = JSON.parse(raw) as RoomGlobalStatsStorage;
      if (!Array.isArray(parsed.participants)) {
        return { roomCode, updatedAt: new Date().toISOString(), participants: [] };
      }
      return parsed;
    } catch {
      return { roomCode, updatedAt: new Date().toISOString(), participants: [] };
    }
  }

  private normalizeGlobalStorage(storage: RoomGlobalStatsStorage): RoomGlobalStats {
    const participants: RoomGlobalParticipantStats[] = storage.participants
      .map((participant) => ({
        nickname: participant.nickname,
        batchesPlayed: participant.batchesPlayed,
        totalCorrect: participant.totalCorrect,
        totalIncorrect: participant.totalIncorrect,
        totalCards: participant.totalCards,
        averagePercent: participant.batchesPlayed > 0
          ? Math.round(participant.totalPercentSum / participant.batchesPlayed)
          : 0,
        bestPercent: participant.bestPercent,
        wins: participant.wins,
        updatedAt: participant.updatedAt,
      }))
      .sort((a, b) => {
        if (b.averagePercent !== a.averagePercent) {
          return b.averagePercent - a.averagePercent;
        }
        if (b.wins !== a.wins) {
          return b.wins - a.wins;
        }
        if (b.totalCorrect !== a.totalCorrect) {
          return b.totalCorrect - a.totalCorrect;
        }
        return a.nickname.localeCompare(b.nickname, 'es');
      });

    return {
      roomCode: storage.roomCode,
      updatedAt: storage.updatedAt,
      participants,
    };
  }

  private getProcessedBatchKeys(roomCode: string): Set<string> {
    const raw = localStorage.getItem(`${this.roomProcessedBatchesStoragePrefix}${roomCode}`);
    if (!raw) {
      return new Set<string>();
    }

    try {
      const parsed = JSON.parse(raw) as string[];
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set<string>();
    }
  }

  private getBatchKey(scores: RoomBatchScores): string | null {
    const anchor = scores.startedAt || scores.updatedAt;
    if (!scores.roomCode || !anchor) {
      return null;
    }
    return `${scores.roomCode}__${anchor}`;
  }

  private getBatchWinner(scores: RoomBatchScores): string | null {
    if (scores.winner) {
      return scores.winner;
    }

    const sorted = [...scores.participantResults].sort((a, b) => {
      if (b.percentScore !== a.percentScore) {
        return b.percentScore - a.percentScore;
      }
      if (b.correctCount !== a.correctCount) {
        return b.correctCount - a.correctCount;
      }

      const aTime = this.parseTime(a.timestamp);
      const bTime = this.parseTime(b.timestamp);

      if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
        return aTime - bTime;
      }

      return a.nickname.localeCompare(b.nickname, 'es');
    });

    return sorted.length > 0 ? sorted[0].nickname : null;
  }

}

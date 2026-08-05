import { WebsocketService } from '../../../Websocket';
import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import {
  ParticipantResultView,
  RoomBatchScores,
  RoomGeneralScore,
  RoomGlobalParticipantStats,
  RoomGlobalStats
} from '../../../../data/DataInterfaces';

@Injectable({
  providedIn: 'root',
})
export class CardSwipeRoomScoresService implements OnDestroy {


  // Signals de estado expuestas como Readonly para proteger la inmutabilidad desde fuera
  private readonly _roomBatchScores = signal<RoomBatchScores | null>(null);
  readonly roomBatchScores = this._roomBatchScores.asReadonly();

  private readonly _roomGeneralScore = signal<RoomGeneralScore | null>(null);
  readonly roomGeneralScore = this._roomGeneralScore.asReadonly();

  private readonly _roomGlobalStats = signal<RoomGlobalStats | null>(null);
  readonly roomGlobalStats = this._roomGlobalStats.asReadonly();

  private subscription = new Subscription();

  constructor(private websocket: WebsocketService) {
    this.initService();
  }

  private initService() {
    this.subscription.add(
      this.websocket.roomBatchScores$.subscribe((scores) => {
        if (!scores) return;
        this._roomBatchScores.set(scores);
        if (scores.room_general_score) {
          this._roomGeneralScore.set(scores.room_general_score);
          this._roomGlobalStats.set(this.normalizeGeneralScores(scores));
        } else {
          this._roomGlobalStats.set(this.normalizeParticipantResults(scores));
        }
      })
    );

    // no local storage loading for room scores; use only live server data
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  // --- COMPUTED STATES (LÓGICA DERIVADA) ---

  readonly hasGlobalScores = computed(() => {
    const stats = this._roomGlobalStats();
    return !!stats && stats.participants.length > 0;
  });

  readonly hasRoomGeneralScores = computed(() => {
    const scores = this._roomGeneralScore();
    return !!scores && Object.keys(scores).length > 0;
  });

  readonly sortedRoomGeneralScores = computed(() => {
    const scores = this._roomGeneralScore();
    if (!scores) return [];

    return Object.entries(scores)
      .map(([nickname, entry]) => ({
        nickname,
        batchCount: entry.batchCount,
        totalTimeMs: entry.totalTimeMs,
        totalBatchTimeMs: entry.totalBatchTimeMs,
        accumulatedScore: entry.accumulatedScore,
        roomGeneralScore: entry.room_general_score,
        cumulativeTimeRatio: entry.cumulativeTimeRatio,
      }))
      .sort((a, b) => {
        if (b.roomGeneralScore !== a.roomGeneralScore) {
          return b.roomGeneralScore - a.roomGeneralScore;
        }
        return a.nickname.localeCompare(b.nickname, 'es');
      });
  });

  readonly leadingRoomGeneralParticipant = computed(() => {
    const sorted = this.sortedRoomGeneralScores();
    return sorted.length > 0 ? sorted[0] : null;
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

  readonly sortedParticipantResultsWithGeneral = computed(() => {
    const sorted = this.sortedParticipantResults();
    const globalParticipants = this._roomGlobalStats()?.participants ?? [];
    const statsByNickname = new Map(
      globalParticipants.map((participant) => [participant.nickname.trim().toLowerCase(), participant])
    );

    return sorted.map((participant) => {
      const generalStats = statsByNickname.get(participant.nickname.trim().toLowerCase());
      return {
        ...participant,
        generalScore: generalStats?.room_general_score ?? participant.percentScore,
        generalBatchCount: generalStats?.batchCount ?? 0,
        generalTotalTimeMs: generalStats?.totalTimeMs ?? 0,
        generalTotalBatchTimeMs: generalStats?.totalBatchTimeMs ?? 0,
      };
    });
  });

  readonly globalParticipantResults = computed(() => {
    const stats = this._roomGlobalStats();
    return stats?.participants ?? [];
  });

  readonly leadingGlobalParticipant = computed(() => {
    const sorted = this.globalParticipantResults();
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

  private normalizeParticipantResults(scores: RoomBatchScores): RoomGlobalStats {
    const participants: RoomGlobalParticipantStats[] = scores.participantResults.map((participant) => ({
      nickname: participant.nickname,
      batchCount: 1,
      totalTimeMs: 0,
      totalBatchTimeMs: scores.durationMinutes ? scores.durationMinutes * 60 * 1000 : 0,
      accumulatedScore: participant.percentScore,
      room_general_score: participant.percentScore,
      cumulativeTimeRatio: 0,
      updatedAt: scores.updatedAt || new Date().toISOString(),
    }));

    return {
      roomCode: scores.roomCode,
      updatedAt: scores.updatedAt || new Date().toISOString(),
      participants,
    };
  }

  private normalizeGeneralScores(scores: RoomBatchScores): RoomGlobalStats {
    const participants: RoomGlobalParticipantStats[] = Object.entries(scores.room_general_score || {})
      .map(([nickname, entry]) => ({
        nickname,
        batchCount: entry.batchCount,
        totalTimeMs: entry.totalTimeMs,
        totalBatchTimeMs: entry.totalBatchTimeMs,
        accumulatedScore: entry.accumulatedScore,
        room_general_score: entry.room_general_score,
        cumulativeTimeRatio: entry.cumulativeTimeRatio,
        updatedAt: scores.updatedAt || new Date().toISOString(),
      }))
      .sort(this.compareGlobalParticipantStats);

    return {
      roomCode: scores.roomCode,
      updatedAt: scores.updatedAt || new Date().toISOString(),
      participants,
    };
  }

  private compareGlobalParticipantStats(
    a: Pick<RoomGlobalParticipantStats, 'room_general_score' | 'accumulatedScore' | 'nickname'>,
    b: Pick<RoomGlobalParticipantStats, 'room_general_score' | 'accumulatedScore' | 'nickname'>
  ): number {
    if (b.room_general_score !== a.room_general_score) {
      return b.room_general_score - a.room_general_score;
    }
    if (b.accumulatedScore !== a.accumulatedScore) {
      return b.accumulatedScore - a.accumulatedScore;
    }
    return a.nickname.localeCompare(b.nickname, 'es');
  }

}

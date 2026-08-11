import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ProfileService } from '../../../ProfileService';
import {
  BatchSession,
  BatchStartedPayload,
  CardData,
  ParticipantBatchResult,
  RoomBatchScores,
  RoomState,
  SwipeRecord,
} from '../../../../data/DataInterfaces';
import { WebsocketService } from '../../../Websocket';

@Injectable({
  providedIn: 'root',
})
export class CardSetService {
  readonly title = signal('Melajuego');
  readonly isSoloGame = signal(true);
  readonly showRoomPanel = signal(false);
  readonly showCountdown = signal(false);
  readonly sharedBatchReceived = signal(false);
  readonly sharedGameFinished = signal(false);
  readonly batchSize = 10;
  readonly batchHistory = signal<BatchSession[]>([]);
  readonly batchStart = signal(0);
  readonly batchPosition = signal(0);
  readonly batchScore = signal(0);
  readonly batchErrors = signal(0);
  readonly timeRemainingSeconds = signal(0);
  readonly batchDurationMinutes = signal(0);
  readonly batchRenderVersion = signal(0);
  readonly batchResults = signal<Array<'success' | 'error' | 'pending'>>([]);
  readonly loadingBatch = signal(false);

  private readonly currentBatchCorrect = signal<SwipeRecord[]>([]);
  private readonly currentBatchIncorrect = signal<SwipeRecord[]>([]);
  private readonly batchPersisted = signal(false);
  private readonly successSound = typeof Audio !== 'undefined' ? new Audio('sounds/success.mp3') : null;
  private readonly errorSound = typeof Audio !== 'undefined' ? new Audio('sounds/error_1.mp3') : null;
  private readonly websocketSubscription = new Subscription();
  private readonly itemsStack = signal<CardData[]>([]);
  private readonly profileService = inject(ProfileService);
  private loadedProfiles: CardData[] = [];
  private countdownIntervalId: ReturnType<typeof setInterval> | null = null;

  private readonly websocket = inject(WebsocketService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.batchResults.set(Array(this.batchSize).fill('pending'));
    this.loadHistoryFromStorage();
    void this.loadInitialProfiles();

    this.destroyRef.onDestroy(() => this.ngOnDestroy());

    this.websocketSubscription.add(
      this.websocket.batchStarted$.subscribe(async (payload: BatchStartedPayload | null) => {
        if (!payload) {
          this.stopCountdown();
          this.loadingBatch.set(false);
          return;
        }

        if (!payload.itemIds || !Array.isArray(payload.itemIds)) {
          this.loadingBatch.set(false);
          return;
        }

        this.sharedBatchReceived.set(true);
        this.sharedGameFinished.set(false);
        this.loadingBatch.set(true);
        try {
          await this.loadBatchFromItemIds(payload.itemIds, payload.durationMinutes);
        } finally {
          this.loadingBatch.set(false);
          if (this.currentBatch.length === 0) {
            this.sharedBatchReceived.set(false);
          }
        }
      })
    );

    this.websocketSubscription.add(
      this.websocket.roomState$.subscribe((state: RoomState) => {
        const connectedCount = state.connectedUsers?.length ?? 0;
        this.isSoloGame.set(connectedCount <= 1);

        const savedSession = this.getSavedSession();
        const sessionRoom = String(savedSession?.room || '').trim().toUpperCase();
        const sessionNickname = String(savedSession?.nickname || '').trim().toLowerCase();
        const stateRoom = String(state.roomCode || '').trim().toUpperCase();
        const connectedUsers = (state.connectedUsers ?? []).map((nick) => String(nick).trim().toLowerCase());

        const isConnectedToActiveRoom = !!(
          sessionRoom &&
          sessionNickname &&
          stateRoom &&
          sessionRoom === stateRoom &&
          connectedUsers.includes(sessionNickname)
        );

        this.showRoomPanel.set(isConnectedToActiveRoom);

        if (!isConnectedToActiveRoom) {
          this.sharedBatchReceived.set(false);
          this.sharedGameFinished.set(false);
          this.stopCountdown(true);
        }
      })
    );

    this.websocketSubscription.add(
      this.websocket.roomBatchScores$.subscribe((scores: RoomBatchScores) => {
        const savedSession = this.getSavedSession();
        const sessionRoom = String(savedSession?.room || '').trim().toUpperCase();
        const scoresRoom = String(scores?.roomCode || '').trim().toUpperCase();

        if (!sessionRoom || !scoresRoom || sessionRoom !== scoresRoom) {
          return;
        }

        if (scores.gameFinished) {
          this.completeBatchFromRoomFinish();
          this.sharedGameFinished.set(true);
          this.sharedBatchReceived.set(false);
          this.stopCountdown();
        }
      })
    );
  }

  get currentBatch(): CardData[] {
    return this.itemsStack().slice(this.batchStart(), this.batchStart() + this.batchSize);
  }

  get currentCard(): CardData {
    return this.currentBatch[this.batchPosition()];
  }

  get batchComplete(): boolean {
    return this.batchPosition() >= this.currentBatch.length;
  }

  get percentScore(): number {
    return this.currentBatch.length > 0
      ? Math.round((this.batchScore() / this.currentBatch.length) * 100)
      : 0;
  }

  get scoreColor(): 'red' | 'yellow' | 'green' {
    if (this.percentScore < 30) {
      return 'red';
    }
    if (this.percentScore > 81) {
      return 'green';
    }
    return 'yellow';
  }

  get hasNextBatch(): boolean {
    return this.batchStart() + this.batchSize < this.itemsStack().length;
  }

  get formattedTimeRemaining(): string {
    const minutes = Math.floor(this.timeRemainingSeconds() / 60);
    const seconds = this.timeRemainingSeconds() % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  get incorrectSwipes(): SwipeRecord[] {
    return this.currentBatchIncorrect();
  }

  get waitingForOthers(): boolean {
    return this.batchComplete && this.isPlayingInRoom() && !this.sharedGameFinished() && this.timeRemainingSeconds() > 0;
  }

  get showRoomScores(): boolean {
    return this.batchComplete && this.isPlayingInRoom() && (this.sharedGameFinished() || this.timeRemainingSeconds() <= 0);
  }

  trackCard = (_index: number, card: CardData): string => {
    return `${this.batchRenderVersion()}-${String(card.id)}`;
  };

  isPlayingInRoom(): boolean {
    return this.showRoomPanel();
  }

  isSharedSession(): boolean {
    const savedSession = this.getSavedSession();
    const room = String(savedSession?.room || '').trim();
    const nickname = String(savedSession?.nickname || '').trim();
    return room.length > 0 && nickname.length > 0;
  }

  shouldWaitForSharedBatch(): boolean {
    return this.isSharedSession() && !this.sharedBatchReceived() && !this.sharedGameFinished();
  }

  shouldShowCards(): boolean {
    if (this.loadingBatch()) {
      return false;
    }

    if (!this.isSharedSession()) {
      return !this.batchComplete;
    }

    return !this.batchComplete && !this.shouldWaitForSharedBatch() && !this.sharedGameFinished();
  }

  actionLabel(action: 'like' | 'dislike'): string {
    return action === 'like' ? 'Sí Apoyó' : 'No Apoyó';
  }

  expectedLabel(cardId: string | number): string {
    return String(cardId).toLowerCase().startsWith('one') ? 'Sí Apoyó' : 'No Apoyó';
  }

  restart(): void {
    this.stopCountdown(true);
    if (this.loadedProfiles.length > 0) {
      this.itemsStack.set(this.shuffle(this.loadedProfiles));
    }
    this.batchStart.set(0);
    this.resetBatch();
  }

  nextBatch(): void {
    this.stopCountdown(true);
    this.sharedGameFinished.set(false);

    if (this.hasNextBatch) {
      this.batchStart.set(this.batchStart() + this.batchSize);
    } else {
      if (this.loadedProfiles.length > 0) {
        this.itemsStack.set(this.shuffle(this.loadedProfiles));
      }
      this.batchStart.set(0);
    }

    this.resetBatch();
  }

  handleDecision(event: { id: string | number; action: 'like' | 'dislike' }): void {
    if (this.batchComplete || this.shouldWaitForSharedBatch() || this.sharedGameFinished()) {
      return;
    }

    const correct = this.isCorrectDecision(event.id, event.action);
    const currentCardData = this.currentBatch[this.batchPosition()];

    const record: SwipeRecord = {
      cardId: currentCardData.id,
      title: currentCardData.title,
      subtitle: currentCardData.subtitle,
      actionTaken: event.action,
    };

    if (correct) {
      this.playAudio(this.successSound);
      this.batchScore.set(this.batchScore() + 1);
      this.batchResults.update((results) => {
        const next = [...results];
        next[this.batchPosition()] = 'success';
        return next;
      });
      this.currentBatchCorrect.set([...this.currentBatchCorrect(), record]);
    } else {
      this.playAudio(this.errorSound);
      this.batchErrors.set(this.batchErrors() + 1);
      this.batchResults.update((results) => {
        const next = [...results];
        next[this.batchPosition()] = 'error';
        return next;
      });
      this.currentBatchIncorrect.set([...this.currentBatchIncorrect(), record]);
    }

    this.batchPosition.set(this.batchPosition() + 1);

    if (this.batchComplete) {
      if (!this.isPlayingInRoom() || this.sharedGameFinished()) {
        this.stopCountdown();
      }

      // Always persist and submit the local batch result immediately.
      // For room play, keep waiting for shared room scores until the room finishes
      // or the countdown expires.
      this.saveCurrentBatchToHistory(true);
    }
  }

  private completeBatchFromRoomFinish(): void {
    if (!this.isPlayingInRoom() || this.batchPersisted()) {
      return;
    }

    if (!this.batchComplete) {
      this.batchPosition.set(this.currentBatch.length);
    }

    this.saveCurrentBatchToHistory(true);
  }

  private getSavedSession(): { nickname?: string; room?: string } | null {
    const savedSession = sessionStorage.getItem('game_session') || localStorage.getItem('game_session');
    if (!savedSession) {
      return null;
    }

    try {
      return JSON.parse(savedSession) as { nickname?: string; room?: string };
    } catch {
      return null;
    }
  }

  private shuffle<T>(array: T[]): T[] {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private async loadBatchFromItemIds(itemIds: string[], durationMinutes?: number): Promise<void> {
    let allProfiles = await this.profileService.getCombinedProfiles();
    let itemsById = new Map<string, CardData>(allProfiles.map((profile) => [String(profile.id), profile]));

    let selected: CardData[] = itemIds
      .map((id) => itemsById.get(id))
      .filter((card): card is CardData => Boolean(card));

    let missingIds = itemIds.filter((id) => !itemsById.has(id));

    if (missingIds.length > 0) {
      console.warn('[Batch] Algunos IDs del mazo no fueron encontrados en el catálogo local. Fuerza recarga desde servidor.');
      const refreshedProfiles = await this.profileService.getCombinedProfiles({ forceRefresh: true });
      itemsById = new Map<string, CardData>(refreshedProfiles.map((profile) => [String(profile.id), profile]));
      selected = itemIds
        .map((id) => itemsById.get(id))
        .filter((card): card is CardData => Boolean(card));
      missingIds = itemIds.filter((id) => !itemsById.has(id));

      if (selected.length !== itemIds.length) {
        console.warn('[Batch] Algunos IDs siguen sin corresponder después de recarga remota:', missingIds);
      }
    }

    if (selected.length === 0) {
      console.error('[Batch] Batch ignored because no incoming IDs matched the server-loaded catalog.', {
        requestedIds: itemIds,
      });
      return;
    }

    this.itemsStack.set(selected);
    this.batchRenderVersion.update((version) => version + 1);
    this.batchStart.set(0);
    this.resetBatch();
    this.configureCountdown(durationMinutes);
  }

  private resetBatch(): void {
    this.batchPosition.set(0);
    this.batchScore.set(0);
    this.batchErrors.set(0);
    this.batchPersisted.set(false);
    this.batchResults.set(Array(this.batchSize).fill('pending'));
    this.currentBatchCorrect.set([]);
    this.currentBatchIncorrect.set([]);
  }

  private configureCountdown(durationMinutes?: number): void {
    this.stopCountdown(true);

    const parsedDuration = Number(durationMinutes ?? 0);
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      return;
    }

    this.batchDurationMinutes.set(parsedDuration);
    this.timeRemainingSeconds.set(Math.floor(parsedDuration * 60));
    this.startCountdown();
  }

  private startCountdown(): void {
    this.stopCountdown();
    if (this.timeRemainingSeconds() <= 0) {
      this.showCountdown.set(false);
      return;
    }

    this.showCountdown.set(true);

    this.countdownIntervalId = setInterval(() => {
      if (this.timeRemainingSeconds() <= 0) {
        return;
      }

      this.timeRemainingSeconds.set(this.timeRemainingSeconds() - 1);
      if (this.timeRemainingSeconds() <= 0) {
        this.timeRemainingSeconds.set(0);
        this.handleCountdownFinished();
      }
    }, 1000);
  }

  private stopCountdown(resetValues = false): void {
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }

    this.showCountdown.set(false);

    if (resetValues) {
      this.timeRemainingSeconds.set(0);
      this.batchDurationMinutes.set(0);
    }
  }

  private handleCountdownFinished(): void {
    this.stopCountdown();
    if (this.batchPersisted()) {
      return;
    }

    if (!this.batchComplete) {
      this.batchPosition.set(this.currentBatch.length);
    }

    this.saveCurrentBatchToHistory(true);
  }

  private playAudio(audio: HTMLAudioElement | null): void {
    if (!audio) {
      return;
    }

    audio.currentTime = 0;
    audio.play().catch((err) => console.warn('Audio playback prevented by browser:', err));
  }

  private saveCurrentBatchToHistory(shouldSubmitResult = true, preservePersisted = false): void {
    if (this.batchPersisted()) {
      return;
    }
    if (!preservePersisted) {
      this.batchPersisted.set(true);
    }

    const newSession: BatchSession = {
      id: `batch_${Date.now()}`,
      date: new Date().toLocaleString(),
      correctCount: this.batchScore(),
      incorrectCount: this.batchErrors(),
      correctSwipes: this.currentBatchCorrect(),
      incorrectSwipes: this.currentBatchIncorrect(),
    };

    this.batchHistory.update((history) => [newSession, ...history]);
    localStorage.setItem('match_history', JSON.stringify(this.batchHistory()));

    if (!shouldSubmitResult) {
      return;
    }

    const batchResult = this.buildBatchResultPayload();
    if (batchResult) {
      this.websocket.submitBatchResult(batchResult);
    }
  }

  private buildBatchResultPayload(): ParticipantBatchResult | null {
    const sessionJSON = sessionStorage.getItem('game_session') || localStorage.getItem('game_session');
    const fallbackNickname = this.websocket.nickname().trim();
    const fallbackRoomCode = this.websocket.roomName().trim();

    if (!sessionJSON && !fallbackNickname && !fallbackRoomCode) {
      console.warn('[Batch] No session or active room data available to send batch result.');
      return null;
    }

    try {
      const session = sessionJSON ? (JSON.parse(sessionJSON) as { nickname?: string; room?: string }) : null;
      const nickname = (session?.nickname || fallbackNickname).trim();
      const roomCode = (session?.room || fallbackRoomCode).trim();
      if (!nickname || !roomCode) {
        return null;
      }

      return {
        id: `batch_${Date.now()}`,
        roomCode,
        nickname,
        correctCount: this.batchScore(),
        incorrectCount: this.batchErrors(),
        percentScore: this.percentScore,
        totalCards: this.currentBatch.length,
        results: this.batchResults(),
        timestamp: new Date().toISOString(),
      };
    } catch {
      console.warn('[Batch] Error parsing saved session for batch result.');
      return null;
    }
  }

  private async loadInitialProfiles(): Promise<void> {
    const allProfiles = await this.profileService.getCombinedProfiles();
    this.loadedProfiles = allProfiles;
    if (allProfiles.length > 0) {
      this.itemsStack.set(this.shuffle(allProfiles));
    }
  }

  private loadHistoryFromStorage(): void {
    const storedData = localStorage.getItem('match_history');
    if (storedData) {
      this.batchHistory.set(JSON.parse(storedData));
    }
  }

  private isCorrectDecision(id: string | number, action: 'like' | 'dislike'): boolean {
    const key = String(id).toLowerCase();
    const isOne = key.startsWith('one');
    const isTwo = key.startsWith('two');

    return (isOne && action === 'like') || (isTwo && action === 'dislike');
  }

  ngOnDestroy(): void {
    this.stopCountdown();
    this.websocketSubscription.unsubscribe();
  }
}

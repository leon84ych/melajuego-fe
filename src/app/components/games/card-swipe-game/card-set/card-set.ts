import { ChangeDetectorRef, Component, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { BatchSession, BatchStartedPayload, CardData, ParticipantBatchResult, RoomBatchScores, RoomState, SwipeRecord } from '../../../../data/DataInterfaces';
import profiles from '../../../../data/Profiles.json';
import { Card } from '../card/card';
import { CommonModule } from '@angular/common';
import { WebsocketService } from '../../../../services/Websocket';


@Component({
  selector: 'app-card-set',
  standalone: true,
  imports: [Card, CommonModule],
  templateUrl: './card-set.html',
  styleUrls: ['./card-set.css'],
})
export class CardSet {
  protected readonly title = signal('Fuchile');
  isSoloGame = signal(true);
  showRoomPanel = signal(false);
  showCountdown = signal(false);
  sharedBatchReceived = signal(false);
  sharedGameFinished = signal(false);
  private batchRenderVersion = 0;
  private successSound = new Audio('sounds/success.mp3');
  private errorSound = new Audio('sounds/error_1.mp3');

  readonly batchSize = 10;
  private currentBatchCorrect: SwipeRecord[] = [];
  private currentBatchIncorrect: SwipeRecord[] = [];

  public batchHistory: BatchSession[] = [];

  batchStart = 0;
  batchPosition = 0;
  batchScore = 0;
  batchErrors = 0;
  timeRemainingSeconds = 0;
  batchDurationMinutes = 0;
  batchResults: Array<'success' | 'error' | 'pending'> = Array(this.batchSize).fill('pending');
  private countdownIntervalId: ReturnType<typeof setInterval> | null = null;
  private batchPersisted = false;
  private websocketSubscription = new Subscription();

  constructor(private websocket: WebsocketService, private cdr: ChangeDetectorRef) {
    this.loadHistoryFromStorage();
    this.websocketSubscription.add(
      this.websocket.batchStarted$.subscribe((payload: BatchStartedPayload | null) => {
        if (!payload) {
          this.stopCountdown();
          return;
        }

        if (!payload?.itemIds || !Array.isArray(payload.itemIds)) {
          return;
        }

        this.sharedBatchReceived.set(true);
        this.sharedGameFinished.set(false);
        this.loadBatchFromItemIds(payload.itemIds, payload.durationMinutes);
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

  private completeBatchFromRoomFinish(): void {
    if (!this.isPlayingInRoom() || this.batchPersisted) {
      return;
    }

    if (!this.batchComplete) {
      this.batchPosition = this.currentBatch.length;
    }

    this.saveCurrentBatchToHistory(false);
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

  private loadBatchFromItemIds(itemIds: string[], durationMinutes?: number) {
    const itemsById = new Map<string, CardData>(
      (profiles as CardData[]).map((profile) => [String(profile.id), profile])
    );

    const selected: CardData[] = itemIds
      .map((id) => itemsById.get(id))
      .filter((card): card is CardData => Boolean(card));

    const missingIds = itemIds.filter((id) => !itemsById.has(id));

    if (selected.length !== itemIds.length) {
      console.warn('[Batch] Algunos IDs del mazo no fueron encontrados en el catálogo local.');
      if (missingIds.length > 0) {
        console.warn('[Batch] IDs faltantes en el catálogo local:', missingIds);
      }
    }

    if (selected.length === 0) {
      console.error('[Batch] Batch ignored because no incoming IDs matched local catalog.', {
        requestedIds: itemIds,
      });
      return;
    }

    this.itemsStack = selected;
    this.batchRenderVersion++;
    this.batchStart = 0;
    this.resetBatch();
    this.configureCountdown(durationMinutes);
    this.cdr.detectChanges();
  }

  trackCard = (_index: number, card: CardData): string => {
    return `${this.batchRenderVersion}-${String(card.id)}`;
  };

  // 1. Array genérico con tus elementos a deslizar
  itemsStack: CardData[] = this.shuffle(profiles as CardData[]);

  get currentBatch(): CardData[] {
    return this.itemsStack.slice(this.batchStart, this.batchStart + this.batchSize);
  }

  get currentCard(): CardData {
    return this.currentBatch[this.batchPosition];
  }

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
    if (!this.isSharedSession()) {
      return !this.batchComplete;
    }

    return !this.batchComplete && !this.shouldWaitForSharedBatch() && !this.sharedGameFinished();
  }



  get batchComplete(): boolean {
    return this.batchPosition >= this.currentBatch.length;
  }

  get percentScore(): number {
    return this.currentBatch.length > 0
      ? Math.round((this.batchScore / this.currentBatch.length) * 100)
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
    return this.batchStart + this.batchSize < this.itemsStack.length;
  }

  get formattedTimeRemaining(): string {
    const minutes = Math.floor(this.timeRemainingSeconds / 60);
    const seconds = this.timeRemainingSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  get incorrectSwipes(): SwipeRecord[] {
    return this.currentBatchIncorrect;
  }

  actionLabel(action: 'like' | 'dislike'): string {
    return action === 'like' ? 'Sí Apoyó' : 'No Apoyó';
  }

  expectedLabel(cardId: string | number): string {
    return String(cardId).toLowerCase().startsWith('one') ? 'Sí Apoyó' : 'No Apoyó';
  }

  private isCorrectDecision(id: string | number, action: 'like' | 'dislike'): boolean {
    const key = String(id).toLowerCase();
    const isOne = key.startsWith('one');
    const isTwo = key.startsWith('two');

    return (isOne && action === 'like') || (isTwo && action === 'dislike');
  }

  restart() {
    this.stopCountdown(true);
    this.itemsStack = this.shuffle(profiles as CardData[]);
    this.batchStart = 0;
    this.resetBatch();
  }

  private resetBatch() {
    this.batchPosition = 0;
    this.batchScore = 0;
    this.batchErrors = 0;
    this.batchPersisted = false;
    this.batchResults = Array(this.batchSize).fill('pending');
    this.currentBatchCorrect = [];
    this.currentBatchIncorrect = [];
  }

  nextBatch() {
    this.stopCountdown(true);
    this.sharedGameFinished.set(false);
    if (this.hasNextBatch) {
      this.batchStart += this.batchSize;
    } else {
      this.itemsStack = this.shuffle(profiles as CardData[]);
      this.batchStart = 0;
    }
    this.resetBatch();
  }

  private configureCountdown(durationMinutes?: number): void {
    this.stopCountdown(true);

    const parsedDuration = Number(durationMinutes ?? 0);
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      return;
    }

    this.batchDurationMinutes = parsedDuration;
    this.timeRemainingSeconds = Math.floor(parsedDuration * 60);
    this.startCountdown();
  }

  private startCountdown(): void {
    this.stopCountdown();
    if (this.timeRemainingSeconds <= 0) {
      this.showCountdown.set(false);
      return;
    }

    this.showCountdown.set(true);

    this.countdownIntervalId = setInterval(() => {
      if (this.timeRemainingSeconds <= 0) {
        return;
      }

      this.timeRemainingSeconds -= 1;
      if (this.timeRemainingSeconds <= 0) {
        this.timeRemainingSeconds = 0;
        this.handleCountdownFinished();
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  private stopCountdown(resetValues = false): void {
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }

    this.showCountdown.set(false);

    if (resetValues) {
      this.timeRemainingSeconds = 0;
      this.batchDurationMinutes = 0;
    }
  }

  private handleCountdownFinished(): void {
    this.stopCountdown();
    if (this.batchPersisted) {
      return;
    }

    if (!this.batchComplete) {
      this.batchPosition = this.currentBatch.length;
    }

    this.saveCurrentBatchToHistory(true);
  }

  // 3. Método genérico para manejar la acción del swipe
  handleDecision(event: { id: string | number, action: 'like' | 'dislike' }) {
    if (this.batchComplete || this.shouldWaitForSharedBatch() || this.sharedGameFinished()) {
      return;
    }

    const correct = this.isCorrectDecision(event.id, event.action);
    const currentCardData = this.currentBatch[this.batchPosition];

    const record: SwipeRecord = {
      cardId: currentCardData.id,
      title: currentCardData.title,
      subtitle: currentCardData.subtitle,
      actionTaken: event.action
    };

    if (correct) {
      this.playAudio(this.successSound);
      this.batchScore++;
      this.batchResults[this.batchPosition] = 'success';
      this.currentBatchCorrect.push(record);
    } else {
      this.playAudio(this.errorSound);
      this.batchErrors++;
      this.batchResults[this.batchPosition] = 'error';
      this.currentBatchIncorrect.push(record);
    }

    this.batchPosition++;

    if (this.batchComplete) {
      this.stopCountdown();
      this.saveCurrentBatchToHistory(true);
    }
  }

  // Helper method to reset and play audio seamlessly on rapid clicks
  private playAudio(audio: HTMLAudioElement) {
    audio.currentTime = 0;
    audio.play().catch(err => console.warn('Audio playback prevented by browser:', err));
  }

  private saveCurrentBatchToHistory(shouldSubmitResult = true) {
    if (this.batchPersisted) {
      return;
    }
    this.batchPersisted = true;

    const newSession: BatchSession = {
      id: `batch_${Date.now()}`,
      date: new Date().toLocaleString(),
      correctCount: this.batchScore,
      incorrectCount: this.batchErrors,
      correctSwipes: this.currentBatchCorrect,
      incorrectSwipes: this.currentBatchIncorrect
    };

    // Add the new session to the top of our history list
    this.batchHistory.unshift(newSession);

    // Save to browser LocalStorage
    localStorage.setItem('match_history', JSON.stringify(this.batchHistory));

    if (!shouldSubmitResult) {
      return;
    }

    const batchResult = this.buildBatchResultPayload();
    if (batchResult) {
      this.websocket.submitBatchResult(batchResult);
      this.websocket.requestRoomBatchScores(batchResult.roomCode);
      localStorage.setItem(`room_batch_result_${batchResult.roomCode}_${batchResult.id}`, JSON.stringify(batchResult));
    }

  }


  private buildBatchResultPayload(): ParticipantBatchResult | null {
    const sessionJSON = sessionStorage.getItem('game_session') || localStorage.getItem('game_session');
    if (!sessionJSON) {
      console.warn('[Batch] No session stored to send batch result.');
      return null;
    }

    try {
      const session = JSON.parse(sessionJSON) as { nickname?: string; room?: string };
      const nickname = (session.nickname || '').trim();
      const roomCode = (session.room || '').trim();
      if (!nickname || !roomCode) {
        return null;
      }

      return {
        id: `batch_${Date.now()}`,
        roomCode,
        nickname,
        correctCount: this.batchScore,
        incorrectCount: this.batchErrors,
        percentScore: this.percentScore,
        totalCards: this.currentBatch.length,
        results: this.batchResults,
        timestamp: new Date().toISOString(),
      };
    } catch {
      console.warn('[Batch] Error parsing saved session for batch result.');
      return null;
    }
  }

  private loadHistoryFromStorage() {
    const storedData = localStorage.getItem('match_history');
    if (storedData) {
      this.batchHistory = JSON.parse(storedData);
    }
  }

  ngOnDestroy() {
    this.stopCountdown();
    this.websocketSubscription.unsubscribe();
  }

}

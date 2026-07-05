import { ChangeDetectorRef, Component, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { BatchSession, BatchStartedPayload, CardData, ParticipantBatchResult, RoomBatchScores, RoomState, SwipeRecord } from '../../data/DataInterfaces';
import profiles from '../../data/Profiles.json';
import { Card } from '../card/card';
import { Room } from '../room/room';
import { Scores } from '../scores/scores';
import { CommonModule } from '@angular/common';
import { WebsocketService } from '../../services/Websocket';


@Component({
  selector: 'app-batch',
  standalone: true,
  imports: [Card, Room, Scores, CommonModule],
  templateUrl: './batch.html',
  styleUrls: ['./batch.css'],
})
export class Batch {
  protected readonly title = signal('Fuchile');
  isSoloGame = signal(true);
  showRoomPanel = signal(false);
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
  batchResults: Array<'success' | 'error' | 'pending'> = Array(this.batchSize).fill('pending');
  private websocketSubscription = new Subscription();

  constructor(private websocket: WebsocketService, private cdr: ChangeDetectorRef) {
    this.loadHistoryFromStorage();
    this.websocketSubscription.add(
      this.websocket.batchStarted$.subscribe((payload: BatchStartedPayload | null) => {
        if (!payload?.itemIds || !Array.isArray(payload.itemIds)) {
          return;
        }

        this.sharedBatchReceived.set(true);
        this.sharedGameFinished.set(false);
        this.loadBatchFromItemIds(payload.itemIds);
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
          this.sharedGameFinished.set(true);
          this.sharedBatchReceived.set(false);
        }
      })
    );
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

  private loadBatchFromItemIds(itemIds: string[]) {
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

  shouldWaitForSharedBatch(): boolean {
    return this.isPlayingInRoom() && !this.sharedBatchReceived() && !this.sharedGameFinished();
  }

  shouldShowCards(): boolean {
    if (!this.isPlayingInRoom()) {
      return !this.batchComplete;
    }

    return !this.batchComplete && !this.shouldWaitForSharedBatch() && !this.sharedGameFinished();
  }

  shouldShowRoomScores(): boolean {
    return this.isPlayingInRoom() && !this.isSoloGame() && (this.batchComplete || this.sharedGameFinished());
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

  private isCorrectDecision(id: string | number, action: 'like' | 'dislike'): boolean {
    const key = String(id).toLowerCase();
    const isOne = key.startsWith('one');
    const isTwo = key.startsWith('two');

    return (isOne && action === 'like') || (isTwo && action === 'dislike');
  }

  restart() {
    this.itemsStack = this.shuffle(profiles as CardData[]);
    this.batchStart = 0;
    this.resetBatch();
  }

  private resetBatch() {
    this.batchPosition = 0;
    this.batchScore = 0;
    this.batchErrors = 0;
    this.batchResults = Array(this.batchSize).fill('pending');
    this.currentBatchCorrect = [];
    this.currentBatchIncorrect = [];
  }

  nextBatch() {
    this.sharedGameFinished.set(false);
    if (this.hasNextBatch) {
      this.batchStart += this.batchSize;
    } else {
      this.itemsStack = this.shuffle(profiles as CardData[]);
      this.batchStart = 0;
    }
    this.resetBatch();
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
      this.saveCurrentBatchToHistory();
    }
  }

  // Helper method to reset and play audio seamlessly on rapid clicks
  private playAudio(audio: HTMLAudioElement) {
    audio.currentTime = 0;
    audio.play().catch(err => console.warn('Audio playback prevented by browser:', err));
  }

  private saveCurrentBatchToHistory() {
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
    this.websocketSubscription.unsubscribe();
  }

}

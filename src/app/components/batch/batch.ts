import { Component, OnDestroy, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { BatchSession, CardData, SwipeRecord } from '../../data/DataInterfaces';
import profiles from '../../data/Profiles.json';
import { Card } from '../card/card';
import { Room } from '../room/room';
import { CommonModule } from '@angular/common';
import { WebsocketService, BatchStartedPayload } from '../../services/Websocket';


@Component({
  selector: 'app-batch',
  standalone: true,
  imports: [Card, Room, CommonModule],
  templateUrl: './batch.html',
  styleUrls: ['./batch.css'],
})
export class Batch {
  protected readonly title = signal('Fuchile');
  private successSound = new Audio('sounds/success.mp3');
  private errorSound = new Audio('sounds/error_1.mp3');

  readonly batchSize = 10;
  private currentBatchCorrect: SwipeRecord[] = [];
  private currentBatchIncorrect: SwipeRecord[] = [];

  public batchHistory: BatchSession[] = [];
  batchStartedMessage = signal('');

  batchStart = 0;
  batchPosition = 0;
  batchScore = 0;
  batchErrors = 0;
  batchResults: Array<'success' | 'error' | 'pending'> = Array(this.batchSize).fill('pending');
  private websocketSubscription = new Subscription();

  constructor(private websocket: WebsocketService) {
    this.loadHistoryFromStorage();
    this.websocketSubscription.add(
      this.websocket.batchStarted$.subscribe((payload: BatchStartedPayload) => {
        if (!payload?.itemIds || !Array.isArray(payload.itemIds)) {
          return;
        }
        this.batchStartedMessage.set(`Mazo recibido de ${payload.host}. Jugando con ${payload.itemIds.length} cartas.`);
        this.loadBatchFromItemIds(payload.itemIds);
      })
    );
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

    if (selected.length !== itemIds.length) {
      console.warn('[Batch] Algunos IDs del mazo no fueron encontrados en el catálogo local.');
    }

    if (selected.length === 0) {
      return;
    }

    this.itemsStack = selected;
    this.batchStart = 0;
    this.resetBatch();
  }

  // 1. Array genérico con tus elementos a deslizar
  itemsStack: CardData[] = this.shuffle(profiles as CardData[]);

  get currentBatch(): CardData[] {
    return this.itemsStack.slice(this.batchStart, this.batchStart + this.batchSize);
  }

  get currentCard(): CardData {
    return this.currentBatch[this.batchPosition];
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
    if (this.batchComplete) {
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

    console.log(`Item ${event.id} recibió un: ${event.action} — ${correct ? 'correcto' : 'incorrecto'}`);
    this.batchPosition++;

    if (this.batchComplete) {
      this.saveCurrentBatchToHistory();
    }
  }

  // Helper method to reset and play audio seamlessly on rapid clicks
  private playAudio(audio: HTMLAudioElement) {
    audio.currentTime = 0;
    audio.play().catch(err => console.log('Audio playback prevented by browser:', err));
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
    
    console.log('Batch successfully archived to LocalStorage!');
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

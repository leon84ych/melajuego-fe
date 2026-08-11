import { ChangeDetectorRef, Component, computed, inject, OnDestroy, OnInit, signal, Type } from '@angular/core';
import { WebsocketService } from '../../services/Websocket';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { BaseGameComponent, BaseGamePayload, BatchStartedPayload, GameItem } from '../../data/DataInterfaces';
import { PlayersList } from '../players-list/players-list';
import { CardSwipeGame } from '../games/card-swipe-game/card-swipe-game';
import { GameScores } from '../scores/game-scores/game-scores';
import { ScoresService } from '../../services/room-scores/scores-service';
import { PlayerListService } from '../../services/player-list/player-list-service';

@Component({
  selector: 'app-game-room',
  standalone: true,
  imports: [CommonModule, PlayersList, GameScores],
  templateUrl: './game-room.html',
  styleUrls: ['./game-room.css'],
})
export class GameRoom implements OnInit, OnDestroy {

  protected scoresService = inject(ScoresService);
  private playerListService = inject(PlayerListService);

  selectedGameId: string | null = null;
  activeGameTitle: string = '';

  playerListState = this.playerListService.playerListState;

  private gameRegistry: Record<string, Type<BaseGameComponent<any>>> = {
    'SWIPE': CardSwipeGame
    // 'ORDER': OrderGameComponent -> Lo agregas aquí cuando lo crees
  };

  availableGames: GameItem[] = [
    {
      id: 'cardSwipeIvan',
      title: 'Quienes jugaron por la vida?',
      description: 'Reconoce quienes apoyaron a Iván en la campaña presidencial. Un juego rápido de memoria y reconocimiento.',
      image: 'images/IvanCorazon.jpg',
      category: 'Deslizar Cartas',
      component: 'SWIPE',
      enabled: true
    },
    {
      id: 'cards_02',
      title: 'Cartas del Destino',
      description: 'Un juego rápido de estrategia y engaño para jugar en grupo.',
      image: 'CartasDelDestino.jpeg',
      category: 'Estrategia',
      component: 'SWIPE',
      enabled: false
    }
  ];

  private cdr = inject(ChangeDetectorRef);

  // Variables de estado de la sala
  currentGameComponent = signal<Type<BaseGameComponent<any>> | null>(null);
  currentGameType = signal<string | null>(null);
  currentGamePayload = signal<any>(null);

  gameComponentInputs = computed(() => {
    const payload = this.currentGamePayload();

    return {
      // Only pass 'state'. Provide a safe, empty object fallback if payload is currently null
      state: payload || { roomHost: '', itemIds: [] }
    };
  });

  private websocketSubscription = new Subscription();

  constructor(public websocket: WebsocketService) {
    //this.currentGameComponent = this.gameRegistry['SWIPE'];
  }

  ngOnInit() {
    this.websocketSubscription.add(
      this.websocket.baseGameStart$.subscribe((payload: BaseGamePayload | null) => {
        if (!payload || !payload.gameType || !this.gameRegistry[payload.gameType]) {
          return;
        }
        this.currentGameType.set(payload.gameType);
        this.currentGamePayload.set(payload.payload ?? null);
        this.currentGameComponent.set(this.gameRegistry[payload.gameType]); // Use .set()
      })
    );

    this.websocketSubscription.add(
      this.websocket.batchStarted$.subscribe(async (batchPayload: BatchStartedPayload | null) => {
        console.log('[GameRoom] batchStarted$ event received:', batchPayload);
        if (!batchPayload) {
          return;
        }
        console.log('[component]:', batchPayload.component);

        // FIX: Mutate state via reactive signal wrapper to notify change detection
        const targetComponent = this.gameRegistry[batchPayload.component] || null;
        this.currentGameComponent.set(targetComponent);
        this.currentGamePayload.set(batchPayload);

        console.log('Component initialized state matches:', !!targetComponent);
        this.cdr.detectChanges();
      })
    );
  }

  // 3. Manejar cuando el juego actual termina en el cliente
  handleGameFinished(result: any) {
    this.currentGameComponent.set(null); // Use .set()
  }

  // This handles hooking up the output events cleanly in TypeScript
  onComponentActivated(componentInstance: any) {
    // Check if the dynamic component implements your completion output
    if (componentInstance && 'onGameComplete' in componentInstance) {
      const gameComponent = componentInstance as BaseGameComponent;

      // Subscribe to the event emitter directly
      gameComponent.onGameComplete.subscribe((result: any) => {
        this.handleGameFinished(result);
      });
    }
  }


  ngOnDestroy() {
    this.websocketSubscription.unsubscribe();
  }

  selectGame(game: GameItem): void {
    console.log(`Game selected: ${game.title} (ID: ${game.id})`);
    this.selectedGameId = game.id;
    this.activeGameTitle = game.title;
    this.currentGameComponent.set(this.gameRegistry[game.component] || null); // Use .set()
  }

  exitCurrentGame(): void {
    this.selectedGameId = null;
    this.activeGameTitle = '';
    this.currentGameComponent.set(null); // Use .set()
  }


  isHost(): boolean {
    return this.playerListService.isHost();
  }
}
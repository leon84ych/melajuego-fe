import { Component, inject, OnDestroy, OnInit, signal, Type } from '@angular/core';
import { WebsocketService } from '../../services/Websocket';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { BaseGameComponent, BaseGamePayload, GameItem } from '../../data/DataInterfaces';
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

  private gameRegistry: Record<string, Type<BaseGameComponent<any, any>>> = {
    'SWIPE': CardSwipeGame
    // 'ORDER': OrderGameComponent -> Lo agregas aquí cuando lo crees
  };

  availableGames: GameItem[] = [
    {
      id: 'cardSwipeIvan',
      title: 'Sabes quienes apoyaron a Iván?',
      description: 'Reconoce quienes apoyaron a Iván en la campaña presidencial. Un juego rápido de memoria y reconocimiento.',
      icon: '🧠',
      category: 'Quiz / Party',
      component: 'SWIPE'
    },
    {
      id: 'cards_02',
      title: 'Cartas del Destino',
      description: 'Un juego rápido de estrategia y engaño para jugar en grupo.',
      icon: '🃏',
      category: 'Estrategia',
      component: 'SWIPE'
    }
  ];

  // Variables de estado de la sala
  currentGameComponent: Type<BaseGameComponent<any, any>> | null = null;
  currentGameType: any = null;
  currentGamePayload: any = null;

  private websocketSubscription = new Subscription();

  constructor(public websocket: WebsocketService) {
    this.currentGameComponent = this.gameRegistry['SWIPE'];
  }

  ngOnInit() {
    this.websocketSubscription.add(
      this.websocket.baseGameStart$.subscribe((payload: BaseGamePayload | null) => {
        if (!payload) {
          return;
        }
        if (!payload.gameType || !this.gameRegistry[payload.gameType]) {
          return;
        }
        this.currentGameType.set(payload?.gameType ?? null);
        this.currentGamePayload.set(payload?.payload ?? null);
        this.currentGameComponent = this.gameRegistry[this.currentGameType()] || null;
      })
    );

    //this.checkPlayers();
  }

  // 3. Manejar cuando el juego actual termina en el cliente
  handleGameFinished(result: any) {
    //this.socketService.emit('client_finished_round', result);
    this.currentGameComponent = null; // Limpia la pantalla o muestra un loader de espera
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
    this.selectedGameId = game.id;
    this.activeGameTitle = game.title;
    //currentGame se setea desde el BE
    //this.currentGameComponent = game.component;

    // Set up initial configuration details for this particular item payload
    this.currentGamePayload = { gameSessionId: game.id, startedAt: Date.now() };
  }

  exitCurrentGame(): void {
    this.selectedGameId = null;
    this.activeGameTitle = '';
    this.currentGameComponent = null;
  }


  isHost(): boolean {
    return this.playerListService.isHost();
  }
}
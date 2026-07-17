import { Component, OnDestroy, OnInit, signal, Type } from '@angular/core';
import { CardSwipeGame } from '../games/card-swipe-game/card-swipe-game';
import { WebsocketService } from '../../services/Websocket';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { BaseGameComponent, BaseGamePayload, PlayersListState, RoomState } from '../../data/DataInterfaces';
import { PlayersList } from '../playersList/playersList';

@Component({
  selector: 'app-game-room',
  imports: [CardSwipeGame, CommonModule, PlayersList],
  templateUrl: './game-room.html',
  styleUrls: ['./game-room.css'],
})
export class GameRoom implements OnInit, OnDestroy {

  private gameRegistry: Record<string, Type<BaseGameComponent<any, any>>> = {
    'SWIPE': CardSwipeGame
    // 'ORDER': OrderGameComponent -> Lo agregas aquí cuando lo crees
  };

  // Variables de estado de la sala
  currentGameComponent: Type<BaseGameComponent<any, any>> | null = null;
  currentGameType: any = null;
  currentGamePayload: any = null;

  private websocketSubscription = new Subscription();

  playerListState = signal<PlayersListState>({
    roomName: '',
    nickname: '',
    currentNickname: '',
    connectedUsers: [],
    roomHost: '',
    totalUsers: 0
  });

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

    this.websocketSubscription.add(
      this.websocket.roomState$.subscribe((state: RoomState) => {
        this.playerListState.update((currentState) => ({
          ...currentState,
          roomName: state.roomCode || currentState.roomName, // Mantiene el anterior si roomCode es False
          roomHost: state.host,
          connectedUsers: state.connectedUsers ?? [],
          totalUsers: state.totalUsers ?? (state.connectedUsers?.length ?? 0)
        }));
      })
    );

    this.checkPlayers();
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

checkPlayers() {
  const roomCode = this.websocket.roomName().trim();
  if (!roomCode) return;

  console.log('Checking players in room:', roomCode);
  this.websocket.requestRoomUsers(roomCode);
}

  ngOnDestroy() {
    this.websocketSubscription.unsubscribe();
  }

  resetComponentState() {
    this.playerListState.set({
      roomName: '',
      nickname: '',
      currentNickname: '',
      connectedUsers: [],
      roomHost: '',
      totalUsers: 0
    });
  }
}
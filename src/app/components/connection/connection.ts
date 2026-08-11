import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/Websocket';
import { ConnectionStatus, GameSession } from '../../data/DataInterfaces';



@Component({
  selector: 'app-connection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './connection.html',
  styleUrls: ['./connection.css'],
})
export class Connection implements OnInit, OnDestroy {

  private errorSub!: Subscription;
  availableRooms = signal<{ roomCode: string; playerCount: number; host?: string }[]>([]);
  totalUsersConnected = signal<number>(0);

  nickname = '';
  room = '';

  statusMessage = '';
  connected = signal(false);
  connectionStatus: ConnectionStatus = {
    status: 'idle',
    message: 'Esperando conexión con el servidor...',
  };

  private subscription = new Subscription();

  constructor(public websocket: WebsocketService) {
    this.subscription.add(
      this.websocket.connectionStatusChanges$.subscribe((status) => {
        console.log('[Configure] socket status update', status);
        this.connectionStatus = status;
        this.statusMessage = status.message;
      })
    );

    this.subscription.add(
      this.websocket.availableRooms$.subscribe((list) => {
        console.log('[Configure] available rooms update', list);
        this.availableRooms.set(Array.isArray(list) ? list : []);
      })
    );

    this.subscription.add(
      this.websocket.totalUsersConnected$.subscribe((count) => {
        console.log('[Configure] total users connected update', count);
        this.totalUsersConnected.set(count);
      })
    );
  }

  ngOnInit() {
    if (this.websocket.isInRoom()) {
      this.room = this.websocket.roomName();
      this.nickname = this.websocket.nickname();
    }
    this.requestRooms();
  }

  socketStatusUpdate(state: { status: string, message: string }) {
    console.log('[Configure] socket status update', state);
  }

  onRoomChange(value: string) {
    this.room = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private isRoomCodeValid(code: string): boolean {
    const roomCodeRegex = /^[A-Z0-9]{1,10}$/;
    return roomCodeRegex.test(code);
  }

  onNicknameChange(value: string) {
    // Reemplaza todo lo que NO sea letras, números o @
    this.nickname = value.replace(/[^a-zA-Z0-9@ ]/g, '');
  }

  private isNicknameValid(name: string): boolean {
    const nicknameRegex = /^[a-zA-Z0-9@ ]{1,15}$/;
    return nicknameRegex.test(name);
  }

  requestRooms() {
    this.websocket.requestAvailableRooms();
  }

  selectRoom(roomCode: string) {
    this.room = (roomCode || '').trim().toUpperCase();
    this.statusMessage = `Sala seleccionada: ${this.room}`;
  }



  saveSession() {
    console.log('[Configure] saveSession', { nickname: this.nickname, room: this.room });

    const cleanNickname = this.nickname.trim();
    const cleanRoom = this.room.trim();

    if (!cleanNickname || !cleanRoom) {
      this.connectionStatus = {
        status: 'error',
        message: 'Completa Nick y Sala antes de guardar.',
      };
      return;
    }

    if (!this.isRoomCodeValid(cleanRoom)) {
      this.connectionStatus = {
        status: 'error',
        message: 'La sala debe tener máximo 10 caracteres (solo letras mayúsculas y números).',
      };
      return;
    }

    if (!this.isNicknameValid(cleanNickname)) {
      this.connectionStatus = {
        status: 'error',
        message: 'El Nick solo permite letras, números, @ y hasta 15 caracteres (sin espacios).',
      };
      return;
    }

    const session: GameSession = {
      nickname: cleanNickname,
      room: cleanRoom,
    };

    const serialized = JSON.stringify(session);
    sessionStorage.setItem('game_session', serialized);
    localStorage.setItem('game_session', serialized);
    this.connectionStatus = {
      status: 'connecting',
      message: 'Sesión guardada. Conectando a la sala…',
    };
    this.joinRoom();
  }

  async joinRoom() {
    console.log('[Configure] joinRoom', { room: this.room, nickname: this.nickname });
    if (!this.room.trim()) {
      this.connectionStatus = { status: 'error', message: 'La sala es obligatoria.' };
      return;
    }
    try {
      // El servicio se encargará de guardar los estados globales si el backend responde OK
      await this.websocket.joinRoom(this.room.trim(), this.nickname.trim());
      this.connectionStatus = { status: 'connected', message: '¡Conectado!' };
    } catch (error: any) {
      this.connectionStatus = { status: 'error', message: error || 'Error al unirse.' };
    }
  }

  leaveRoom() {
    console.log('[Configure] leaveRoom requested');

    // 1. Tell the service to kill the socket pipeline
    this.websocket.disconnect();

    // 2. Wipe memory tokens so auto-login doesn't capture it again
    this.clearSession();

    // 3. Reset interface layout flags back to default state
    this.connectionStatus = {
      status: 'idle',
      message: 'Te has desconectado de la sala.',
    };
    this.connected.set(false);
    // Refresh available rooms after disconnect so UI reflects server state
    this.requestRooms();
  }

  private clearSession() {
    sessionStorage.removeItem('game_session');
    localStorage.removeItem('game_session');
    this.room = '';
    this.nickname = '';
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    if (this.errorSub) {
      this.errorSub.unsubscribe();
    }
  }
}

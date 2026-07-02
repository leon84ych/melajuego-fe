import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ConnectionStatus, WebsocketService } from '../../services/Websocket';

interface GameSession {
  nickname: string;
  room: string;
}

@Component({
  selector: 'app-configure',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './configure.html',
  styleUrls: ['./configure.css'],
})
export class Configure implements OnDestroy {
  nickname = '';
  room = '';
  statusMessage = '';
  connected = false;
  connectionStatus: ConnectionStatus = {
    status: 'idle',
    message: 'Pendiente de conexión...',
  };

  private subscription = new Subscription();

  constructor(private websocket: WebsocketService) {
    this.loadSession();
    this.subscription.add(
      this.websocket.connectionStatusChanges$.subscribe((status) => {
        console.log('[Configure] socket status update', status);
        this.connectionStatus = status;
        this.statusMessage = status.message;
        this.connected = status.status === 'connected' || status.status === 'connecting';
      })
    );
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
    this.nickname = value.replace(/[^a-zA-Z0-9@]/g, '');
  }

  private isNicknameValid(name: string): boolean {
    const nicknameRegex = /^[a-zA-Z0-9@]{1,15}$/;
    return nicknameRegex.test(name);
  }

  private loadSession() {
    const saved = sessionStorage.getItem('game_session') || localStorage.getItem('game_session');
    if (!saved) {
      return;
    }

    try {
      const session = JSON.parse(saved) as GameSession;
      this.nickname = session.nickname ?? '';
      const cleanRoom = (session.room ?? '').trim().toUpperCase();
      if (this.isRoomCodeValid(cleanRoom)) {
        this.room = cleanRoom;
        this.joinRoom();
      } else {
        console.warn('[Configure] Sesión guardada corrupta o inválida eliminada por seguridad.');
        this.clearSession();
      }
      this.joinRoom();
    } catch {
      // ignore malformed session
    }
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

  joinRoom() {
    console.log('[Configure] joinRoom', { room: this.room, nickname: this.nickname });
    if (!this.room.trim()) {
      this.connectionStatus = {
        status: 'error',
        message: 'La sala es obligatoria para conectarse.',
      };
      return;
    }

    this.websocket.joinRoom(this.room.trim(), this.nickname.trim());
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
    this.connected = false;
  }

  private clearSession() {
    sessionStorage.removeItem('game_session');
    localStorage.removeItem('game_session');
    this.room = '';
    this.nickname = '';
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}

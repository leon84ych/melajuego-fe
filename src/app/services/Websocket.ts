import { Injectable, NgZone } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';

export interface RoomState {
    roomName: string;
    connectedUsers: string[];
    message?: string;
    totalUsers?: number;
    newUser?: string;
}

export interface ConnectionStatus {
    status: 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected';
    message: string;
}

@Injectable({
    providedIn: 'root'
})
export class WebsocketService {
    private socket: Socket;
    private zone: NgZone;

    // Usamos un Subject de RxJS para que los componentes se suscriban a las acciones del rival
    public opponentSwipe$ = new Subject<any>();
    public roomState$ = new BehaviorSubject<RoomState>({
        roomName: '',
        connectedUsers: [],
    });
    private connectionStatus$ = new BehaviorSubject<ConnectionStatus>({
        status: 'idle',
        message: 'Pendiente de conexión...',
    });

    public connectionStatusChanges$ = this.connectionStatus$.asObservable();

    constructor(zone: NgZone) {
        this.zone = zone;
        // En local usas localhost, en producción la URL de tu servidor en la nube
        this.socket = io('https://fuchile-be.fly.dev', {
            autoConnect: false,
            auth: {
                token: "BBjwBRieBjINCAIQABiABBjwBRieBjINCAMQABiABBjwBRieBjINCAQQABiABBjwBRieBjIN"
            }
        });

        this.socket.on('connect', () => {
            console.log('[WebsocketService] socket connected', { id: this.socket.id });
            this.zone.run(() => {
                this.connectionStatus$.next({
                    status: 'connected',
                    message: 'Conexión establecida con el servidor.',
                });
            });
        });

        this.socket.on('disconnect', (reason) => {
            console.log('[WebsocketService] socket disconnected', { reason });
            this.zone.run(() => {
                this.connectionStatus$.next({
                    status: 'disconnected',
                    message: `Desconectado del servidor: ${reason}`,
                });
            });
        });

        this.socket.on('connect_error', (error) => {
            console.error('[WebsocketService] connect_error', error);
            this.zone.run(() => {
                this.connectionStatus$.next({
                    status: 'error',
                    message: `Error de conexión: ${error?.message || error}`,
                });
            });
        });

        // Escuchar eventos del servidor
        this.socket.on('receive_swipe', (data) => {
            console.log('[WebsocketService] receive_swipe', data);
            this.zone.run(() => {
                this.opponentSwipe$.next(data);
            });
        });

        this.socket.on('room_info', (data) => {
            console.log('[WebsocketService] room_info', data);
            this.zone.run(() => {
                this.roomState$.next({
                    roomName: data.roomName ?? data.roomCode ?? data.room ?? '',
                    connectedUsers: data.connectedUsers ?? data.users ?? data.nicknames ?? data.participants ?? [],
                });
            });
        });

        this.socket.on('room_users', (data) => {
            console.log('[WebsocketService] room_users', data);
            this.zone.run(() => {
                this.roomState$.next({
                    roomName: data.roomName ?? data.roomCode ?? data.room ?? '',
                    connectedUsers: data.connectedUsers ?? data.users ?? data.nicknames ?? data.participants ?? [],
                });
            });
        });

        this.socket.on('room_updated', (data: {
            roomCode: string,
            connectedUsers: string[],
            totalUsers: number,
            message: string,
            newUser?: string,
        }) => {
            console.log('[WebsocketService] room_updated received:', data);
            this.zone.run(() => {
                this.connectionStatus$.next({
                    status: 'connected',
                    message: data.message,
                });

                // Map the reactive state exactly to what the server dictated
                this.roomState$.next({
                    roomName: data.roomCode,
                    connectedUsers: data.connectedUsers,
                    totalUsers: data.totalUsers,
                });
            });
        });
    }

    joinRoom(roomCode: string, nickname?: string) {
        console.log('[WebsocketService] joinRoom requested', { roomCode, nickname });

        this.connectionStatus$.next({
            status: 'connecting',
            message: 'Conectando a la sala…',
        });

        if (!this.socket.connected) {
            console.log('[WebsocketService] socket not connected, calling connect()');
            this.socket.connect();
        }

        // Enviamos los datos al backend
        this.socket.emit('join_room', {
            roomCode,
            nickname: nickname || 'anonymous',
        });
        console.log('[WebsocketService] emit join_room', { roomCode, nickname });
    }

    emitSwipe(roomCode: string, cardId: string | number, action: 'like' | 'dislike') {
        this.socket.emit('send_swipe', { roomCode, cardId, action });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.connectionStatus$.next({
                status: 'idle',
                message: 'Pendiente de conexión...',
            });
        }
    }
}

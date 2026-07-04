import { Injectable, NgZone } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ParticipantBatchResult, RoomBatchScores } from '../data/DataInterfaces';
import { environment } from '../../environments/environment';

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

export interface BatchStartedPayload {
    host: string;
    itemIds: string[];
}

export interface AvailableRoom {
    roomCode: string;
    playerCount: number;
    host?: string;
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

    public batchStarted$ = new Subject<BatchStartedPayload>();
    public roomBatchScores$ = new Subject<RoomBatchScores>();

    // Available rooms list pushed from server on demand
    public availableRooms$ = new Subject<AvailableRoom[]>();

    private errorStatus$ = new Subject<{ message: string }>();

    constructor(zone: NgZone) {
        this.zone = zone;
        // En local usas localhost, en producción la URL de tu servidor en la nube
        this.socket = io(environment.socketUrl, {
            autoConnect: false,
            auth: {
                token: "BBjwBRieBjINCAIQABiABBjwBRieBjINCAMQABiABBjwBRieBjINCAQQABiABBjwBRieBjIN"
            }
        });

        this.socket.on('error_response', (data: { message: string }) => {
            console.error('[WebsocketService] Server error received:', data);
            this.zone.run(() => {
                this.errorStatus$.next(data);
            });
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

        // Mensajes de error específicos enviados por el servidor (validaciones, seguridad, etc.)
        this.socket.on('error_message', (msg: string) => {
            console.warn('[WebsocketService] error_message from server', msg);
            this.zone.run(() => {
                this.connectionStatus$.next({
                    status: 'error',
                    message: typeof msg === 'string' ? msg : 'Error del servidor',
                });
                this.errorStatus$.next({ message: typeof msg === 'string' ? msg : 'Error del servidor' });
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
                // Refresh available rooms list for this client so UI shows latest counts
                try {
                    this.socket.emit('get_available_rooms');
                } catch (e) {
                    console.warn('[WebsocketService] failed to request updated available rooms', e);
                }
            });
        });

        this.socket.on('batch_started', (data: BatchStartedPayload) => {
            console.log('[WebsocketService] batch_started', data);
            this.zone.run(() => {
                if (data && data.itemIds && Array.isArray(data.itemIds)) {
                    this.batchStarted$.next({
                        host: data.host,
                        itemIds: data.itemIds,
                    });
                }
            });
        });

        this.socket.on('room_batch_scores', (data: any) => {
            console.log('[WebsocketService] room_batch_scores', data);
            this.zone.run(() => {
                if (!data || !data.roomCode || !Array.isArray(data.participantResults)) {
                    return;
                }
                this.roomBatchScores$.next({
                    roomCode: data.roomCode,
                    participantResults: data.participantResults,
                    winner: data.winner,
                    updatedAt: data.updatedAt || new Date().toISOString(),
                });
            });
        });

        // Lista de salas solicitada por el cliente
        this.socket.on('available_rooms_list', (data: AvailableRoom[]) => {
            console.log('[WebsocketService] available_rooms_list', data);
            this.zone.run(() => {
                if (Array.isArray(data)) {
                    this.availableRooms$.next(data);
                }
            });
        });
    }

    // Expose errors as an observable for your components
    getErrorStatus(): Observable<{ message: string }> {
        return this.errorStatus$.asObservable();
    }

    joinRoom(roomCode: string, nickname: string) {
        console.log('[WebsocketService] joinRoom requested', { roomCode, nickname });

        this.connectionStatus$.next({
            status: 'connecting',
            message: 'Conectando a la sala…',
        });

        if (!this.socket.connected) {
            console.log('[WebsocketService] socket not connected, calling connect()');
            this.socket.connect();

            // ⚡ SOLUCIÓN: Esperar a que se conecte antes de emitir el evento
            this.socket.once('connect', () => {
                this.emitJoinRoom(roomCode, nickname);
            });
        } else {
            // Si ya estaba conectado, emitimos de inmediato
            this.emitJoinRoom(roomCode, nickname);
        }

        // Nota: la emisión se realiza en `emitJoinRoom` o tras la conexión.
    }

    private emitJoinRoom(roomCode: string, nickname: string) {
        console.log('[WebsocketService] emit join_room', { roomCode, nickname });
        this.socket.emit('join_room', { roomCode, nickname });
    }

    startBatch(roomCode: string, itemIds: string[]) {
        console.log('[WebsocketService] startBatch requested', { roomCode, itemIds });
        this.socket.emit('start_batch', { roomCode, itemIds });
    }

    submitBatchResult(result: ParticipantBatchResult) {
        console.log('[WebsocketService] submitBatchResult requested', result);
        this.socket.emit('submit_batch_result', result);
    }

    requestRoomBatchScores(roomCode: string) {
        console.log('[WebsocketService] requestRoomBatchScores requested', { roomCode });
        this.socket.emit('get_room_batch_scores', { roomCode });
    }

    requestAvailableRooms() {
        console.log('[WebsocketService] requestAvailableRooms');
        if (this.socket.connected) {
            this.socket.emit('get_available_rooms');
            return;
        }

        // If not connected yet, connect and emit once connected
        try {
            this.socket.connect();
            this.socket.once('connect', () => {
                try {
                    this.socket.emit('get_available_rooms');
                } catch (e) {
                    console.warn('[WebsocketService] failed to emit get_available_rooms after connect', e);
                }
            });
        } catch (e) {
            console.warn('[WebsocketService] failed to request available rooms (connect failed)', e);
        }
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

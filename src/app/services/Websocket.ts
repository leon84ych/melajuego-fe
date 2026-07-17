import { computed, Injectable, NgZone, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, ReplaySubject, Subject } from 'rxjs';
import { AvailableRoom, BaseGamePayload, BatchStartedPayload, ConnectionStatus, ParticipantBatchResult, RoomBatchScores, RoomState } from '../data/DataInterfaces';
import { environment } from '../../environments/environment';



@Injectable({
    providedIn: 'root'
})
export class WebsocketService {

    private socket: Socket;
    private zone: NgZone;

    // 1. Estados reactivos globales
    roomName = signal<string>('');
    nickname = signal<string>('');

    // Señal computada para saber en cualquier componente si está en una sala válida
    isInRoom = computed(() => !!this.roomName().trim() && !!this.nickname().trim());


    public roomState$ = new BehaviorSubject<RoomState>({
        roomCode: '',
        host: '',
        connectedUsers: [],
        totalUsers: 0,
        gameActive: false
    });


    private connectionStatus$ = new BehaviorSubject<ConnectionStatus>({
        status: 'idle',
        message: 'Esperando conexión con el servidor...',
    });

    public connectionStatusChanges$ = this.connectionStatus$.asObservable();

    public baseGameStart$ = new BehaviorSubject<BaseGamePayload<any> | null>({
        gameType: '',      // Ej: 'card-swipe', 'quiz'
        roomCode: '',
        gameHost: '',
        startedAt: '',
        durationMinutes: undefined,
        payload: null,
    });

    public batchStarted$ = new ReplaySubject<BatchStartedPayload | null>(1);

    public roomBatchScores$ = new Subject<RoomBatchScores>();

    // Available rooms list pushed from server on demand
    public availableRooms$ = new Subject<AvailableRoom[]>();

    // Total users connected to the server
    public totalUsersConnected$ = new Subject<number>();

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


        // 2. AUTO-RECONEXIÓN CENTRALIZADA (Solo ocurre UNA VEZ al nacer la app)
        const stored = sessionStorage.getItem('game_session') || localStorage.getItem('game_session');
        if (stored) {
            try {
                const session = JSON.parse(stored) as { room?: string; nickname?: string };
                if (session.room && session.nickname) {
                    console.log('[WebsocketService] Sesión recuperada globalmente. Conectando por red...');

                    // Actualizamos los estados globales de inmediato
                    this.roomName.set(session.room);
                    this.nickname.set(session.nickname);

                    // Disparamos la conexión física por red de forma silenciosa
                    this.refreshRoomState(session.room, session.nickname);
                }
            } catch {
                this.clearSession();
            }
        }

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
                    message: 'Servidor en línea, puede conectarse a una sala.',
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
                    message: `Error al conectar al servidor: ${error?.message || error}`,
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

        this.socket.on('room_info', (data) => {
            console.log('[WebsocketService] room_info', data);
            this.zone.run(() => {
                this.roomState$.next({
                    roomCode: data.roomCode ?? '',
                    connectedUsers: data.connectedUsers ?? data.users ?? data.nicknames ?? data.participants ?? [],
                    host: data.host ?? '',
                });
            });
        });

        this.socket.on('room_users', (data) => {
            console.log('[WebsocketService] room_users', data);
            this.zone.run(() => {
                this.roomState$.next({
                    roomCode: data.roomCode ?? '',
                    connectedUsers: data.connectedUsers ?? [],
                    host: data.host ?? '',
                    totalUsers: data.totalUsers ?? 0,
                    message: data.message ?? ''
                });
            });
        });


        // En tu escucha de Socket.io, alimentas tu BehaviorSubject existente:
        this.socket.on('room_updated', (state: RoomState) => {
            console.log('[WebsocketService] room_updated recibido:', state);
            this.roomState$.next(state);
        });


        // 3. Escuchar las actualizaciones globales que envíe el servidor para mantener los estados limpios
        this.socket.on('room_updated', (state: any) => {
            // Si por alguna razón el servidor nos actualiza los metadatos, los sincronizamos aquí
            if (state.roomCode) this.roomName.set(state.roomCode);
        });

        this.socket.on('open_game', (data: BaseGamePayload<any>) => {
            console.log('[WebsocketService] open_game', data);
            this.zone.run(() => {
                this.baseGameStart$.next({
                    gameType: data.gameType,
                    roomCode: data.roomCode ?? '',
                    gameHost: data.gameHost ?? '',
                    startedAt: data.startedAt ?? '',
                    durationMinutes: data.durationMinutes ?? undefined,
                    payload: data.payload,
                });
            });
        });

        this.socket.on('batch_started', (data: BatchStartedPayload) => {
            console.log('[WebsocketService] batch_started', data);
            this.zone.run(() => {
                if (data && data.itemIds && Array.isArray(data.itemIds)) {
                    this.batchStarted$.next({
                        host: data.host,
                        itemIds: data.itemIds,
                        startedAt: data.startedAt,
                        durationMinutes: data.durationMinutes,
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

                if (data.gameFinished) {
                    this.batchStarted$.next(null);
                }

                this.roomBatchScores$.next({
                    roomCode: data.roomCode,
                    participantResults: data.participantResults,
                    winner: data.winner,
                    startedAt: data.startedAt,
                    gameFinished: data.gameFinished,
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

        // Lista de salas solicitada por el cliente
        this.socket.on('total_users_connected', (total: number) => {
            console.log('[WebsocketService] total_users_connected', total);
            this.zone.run(() => {
                this.totalUsersConnected$.next(total);
            });
        });
    }

    // Expose errors as an observable for your components
    getErrorStatus(): Observable<{ message: string }> {
        return this.errorStatus$.asObservable();
    }

    joinRoom(roomCode: string, nickname: string): Promise<any> {
        console.log('[WebsocketService] joinRoom requested', { roomCode, nickname });

        this.connectionStatus$.next({
            status: 'connecting',
            message: 'Conectando a la sala…',
        });
        return new Promise((resolve, reject) => {

            if (!this.socket.connected) {
                console.log('[WebsocketService] socket not connected, calling connect()');
                this.socket.connect();

                // ⚡ SOLUCIÓN: Esperar a que se conecte antes de emitir el evento
                this.socket.once('connect', () => {
                    this.emitJoinRoom(roomCode, nickname, resolve, reject);
                });
            } else {
                // Si ya estaba conectado, emitimos de inmediato
                this.emitJoinRoom(roomCode, nickname, resolve, reject);
            }
        });
    }

    private emitJoinRoom(roomCode: string, nickname: string, resolve: Function, reject: Function) {
        console.log('[WebsocketService] room_join', { roomCode, nickname });

        this.socket.emit('room_join', { roomCode, nickname }, (response: any) => {
            if (response.success) {
                console.log('¡Entré con éxito a la sala!', response.roomCode);
                // Guardamos el estado global reactivo al entrar exitosamente
                this.roomName.set(roomCode);
                this.nickname.set(nickname);

                // Guardamos en el disco de sesión física
                sessionStorage.setItem('game_session', JSON.stringify({ room: roomCode, nickname }));
                resolve(response); // Éxito: resuelve la promesa
            } else {
                console.error('Error al entrar:', response.error);
                reject(response.error); // Fallo: rechaza la promesa con el mensaje de error
            }
        });
    }




    refreshRoomState(roomCode: string, nickname: string) {
        if (!roomCode.trim() || !nickname.trim()) {
            return;
        }

        if (this.socket.connected) {
            this.emitJoinRoom(roomCode, nickname, () => { }, () => { });
            return;
        }

        try {
            this.socket.connect();
            this.socket.once('connect', () => {
                this.emitJoinRoom(roomCode, nickname, () => { }, () => { });
            });
        } catch (e) {
            console.warn('[WebsocketService] failed to refresh room state', e);
        }
    }

    startBatch(roomCode: string, itemIds: string[], durationMinutes: number) {
        console.log('[WebsocketService] startBatch requested', { roomCode, itemIds, durationMinutes });
        this.socket.emit('start_batch', { roomCode, itemIds, durationMinutes });
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

    requestRoomUsers(roomCode: string): void {
        if (!this.socket.connected) return;
        console.log('[WebsocketService] Solicitando actualización de usuarios para:', roomCode);
        this.socket.emit('get_room_users', { roomCode });
    }

    emitSwipe(roomCode: string, cardId: string | number, action: 'like' | 'dislike') {
        this.socket.emit('send_swipe', { roomCode, cardId, action });
    }

    disconnect() {
        console.log('[WebsocketService] disconnecting socket');
        if (this.socket) {
            this.socket.disconnect();
            this.connectionStatus$.next({
                status: 'idle',
                message: 'Esperando conexión con el servidor...',
            });
            this.clearSession();
        }
    }

    clearSession() {
        this.roomName.set('');
        this.nickname.set('');
        sessionStorage.removeItem('game_session');
        localStorage.removeItem('game_session');
    }
}

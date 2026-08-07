import { WebsocketService } from '../Websocket';
import { Injectable, OnDestroy, computed, signal, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { PlayersListState, RoomState } from '../../data/DataInterfaces';

@Injectable({
    providedIn: 'root',
})
export class PlayerListService implements OnDestroy {
    private websocket = inject(WebsocketService);
    private subscription = new Subscription();
    private nickname = '';

    private readonly _playerListState = signal<PlayersListState>({
        roomName: '',
        nickname: '',
        currentNickname: '',
        connectedUsers: [],
        roomHost: '',
        totalUsers: 0
    });
    readonly playerListState = this._playerListState.asReadonly();

    constructor() {
        this.evaluateSession(); // 🔥 Core Fix: Run this immediately during initialization
        this.initService();
    }

    private initService() {
        this.subscription.add(
            this.websocket.roomState$.subscribe((roomState) => {
                if (!roomState) return;
                this._playerListState.set(this.normalizePlayersListState(roomState));
            })
        );
    }

    private normalizePlayersListState(roomState: RoomState): PlayersListState {
        return {
            roomName: roomState.roomCode,
            nickname: this.nickname,
            currentNickname: this.nickname, // 🔥 Core Fix: Populate this so sortedUsers() can read it
            connectedUsers: roomState.connectedUsers || [],
            roomHost: roomState.host,
            totalUsers: roomState.totalUsers || 0
        };
    }

    public isHost(): boolean {
        return this.nickname.trim().toLowerCase() === this._playerListState().roomHost.trim().toLowerCase();
    }

    private evaluateSession() {
        const savedSession = sessionStorage.getItem('game_session') || localStorage.getItem('game_session');
        if (!savedSession) return;
        
        try {
            const session = JSON.parse(savedSession) as { nickname?: string; room?: string };
            this.nickname = (session.nickname || '').trim();
        } catch (e) {
            console.error('Error parsing session in PlayerListService', e);
        }
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }
}

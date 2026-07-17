import { EventEmitter } from "@angular/core";


export interface CardData {
  id: string | number;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  description?: string;
  tags?: string[];
}


export interface SwipeRecord {
  cardId: string | number;
  title: string;
  subtitle?: string;
  actionTaken: 'like' | 'dislike';
}

export interface BatchSession {
  id: string;          // Unique ID (e.g., timestamp)
  date: string;        // Readable date for the UI
  correctCount: number;
  incorrectCount: number;
  correctSwipes: SwipeRecord[];   // Full profile references for summary
  incorrectSwipes: SwipeRecord[]; // Full profile references for review
}

export interface ParticipantBatchResult {
  id: string;
  roomCode: string;
  nickname: string;
  correctCount: number;
  incorrectCount: number;
  percentScore: number;
  totalCards: number;
  results: Array<'success' | 'error' | 'pending'>;
  timestamp: string;
}

export interface RoomBatchScores {
  roomCode: string;
  participantResults: ParticipantBatchResult[];
  winner?: string;
  startedAt?: string;
  gameFinished?: boolean;
  updatedAt: string;
}


export interface RoomState {
  roomCode: string;
  connectedUsers: string[];
  host: string;
  totalUsers?: number;
  gameActive?: boolean;
  message?: string;
}

export interface ConnectionStatus {
  status: 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected';
  message: string;
}

export interface BatchStartedPayload {
  host: string;
  itemIds: string[];
  startedAt?: string;
  durationMinutes?: number;
}

export interface AvailableRoom {
  roomCode: string;
  playerCount: number;
  host?: string;
}

export interface SocialLinks {
  github?: string;
  instagram?: string;
  'tik-tok'?: string;
  twitter?: string;
}

export interface CreditEntry {
  name: string;
  nickname: string;
  role: string;
  socials: SocialLinks;
}


export interface GameSession {
  nickname: string;
  room: string;
}

export interface ParticipantResultView extends ParticipantBatchResult {
  responseSeconds: number | null;
  responseDeltaSeconds: number | null;
}

export interface RoomGlobalParticipantStats {
  nickname: string;
  batchesPlayed: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalCards: number;
  averagePercent: number;
  bestPercent: number;
  wins: number;
  updatedAt: string;
};

export interface RoomGlobalStats {
  roomCode: string;
  updatedAt: string;
  participants: RoomGlobalParticipantStats[];
};

export interface RoomGlobalStatsStorage {
  roomCode: string;
  updatedAt: string;
  participants: Array<
    Omit<RoomGlobalParticipantStats, 'averagePercent'> & {
      totalPercentSum: number;
    }
  >;
};

export interface BaseGameComponent<T = any, R = any> {
  payload: T;                         // Datos específicos ya limpios
  onGameComplete: EventEmitter<R>;    // Evento tipado con el resultado del juego
}

export interface BaseGamePayload<T = any> {
  gameType: string;      // Ej: 'card-swipe', 'quiz'
  roomCode: string;
  gameHost: string;
  startedAt: string;
  durationMinutes?: number;
  payload: T;            // Datos específicos del juego que vienen del socket
}

export interface GameCardSwipePayload {
  question: string;
  options: string[];
}

export interface GameCardSwipeResult {
  score: number;
  timeSpent: number;
}

// export interface PlayerListState_ {
//   roomName: string;
//   nickname: string;
//   currentNickname: string;
//   connectedUsers: string[];
//   roomHost: string;
//   totalUsers: number;
// }

export interface PlayersListState {  // 👈 Asegúrate de que tenga la "s"
  roomName: string;
  nickname: string;
  currentNickname: string;
  connectedUsers: string[];
  roomHost: string;
  totalUsers: number;
}
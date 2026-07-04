

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
  updatedAt: string;
}
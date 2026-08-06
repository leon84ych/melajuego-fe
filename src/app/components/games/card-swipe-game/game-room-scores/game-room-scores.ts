import { Component } from '@angular/core';
import { CommonModule, DatePipe, SlicePipe } from '@angular/common';
import { CardSwipeRoomScoresService } from '../../../../services/games/card-swipe-game/card-swipe-room-scores/card-swipe-room-scores-service';

@Component({
  selector: 'app-game-room-scores',
  standalone: true,
  imports: [CommonModule, SlicePipe, DatePipe],
  templateUrl: './game-room-scores.html',
  styleUrls: ['./game-room-scores.css'],
})
export class GameRoomScores {
  constructor(protected scoresService: CardSwipeRoomScoresService) {}
}

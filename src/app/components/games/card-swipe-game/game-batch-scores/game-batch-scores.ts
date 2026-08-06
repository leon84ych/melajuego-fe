import { Component } from '@angular/core';
import { CommonModule, DatePipe, SlicePipe } from '@angular/common';
import { CardSwipeRoomScoresService } from '../../../../services/games/card-swipe-game/card-swipe-room-scores/card-swipe-room-scores-service';

@Component({
  selector: 'app-game-batch-scores',
  standalone: true,
  imports: [CommonModule, SlicePipe, DatePipe],
  templateUrl: './game-batch-scores.html',
  styleUrls: ['./game-batch-scores.css'],
})
export class GameBatchScores {
  constructor(protected scoresService: CardSwipeRoomScoresService) {}
}

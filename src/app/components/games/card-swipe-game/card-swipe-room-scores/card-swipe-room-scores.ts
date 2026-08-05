import { Component } from '@angular/core';
import { CommonModule, DatePipe, SlicePipe } from '@angular/common';
import { CardSwipeRoomScoresService } from '../../../../services/games/card-swipe-game/card-swipe-room-scores/card-swipe-room-scores-service';

@Component({
  selector: 'app-card-swipe-room-scores',
  standalone: true,
  imports: [CommonModule, SlicePipe, DatePipe],
  templateUrl: './card-swipe-room-scores.html',
  styleUrls: ['./card-swipe-room-scores.css'],
})
export class CardSwipeRoomScores {
  constructor(protected scoresService: CardSwipeRoomScoresService) {}
}

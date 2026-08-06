import { Component } from '@angular/core';
import { CommonModule, DatePipe, SlicePipe } from '@angular/common';
import { ScoresService } from '../../../services/room-scores/scores-service';

@Component({
  selector: 'app-game-batch-scores',
  standalone: true,
  imports: [CommonModule, SlicePipe, DatePipe],
  templateUrl: './game-batch-scores.html',
  styleUrls: ['./game-batch-scores.css'],
})
export class GameBatchScores {
  constructor(protected scoresService: ScoresService) {}
}

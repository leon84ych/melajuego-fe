import { Component, inject } from '@angular/core';
import { GameBatchScores } from '../game-batch-scores/game-batch-scores';
import { GameRoomScores } from '../game-room-scores/game-room-scores';
import { CommonModule } from '@angular/common';
import { ScoresService } from '../../../services/room-scores/scores-service';

@Component({
  selector: 'app-game-scores',
  imports: [CommonModule, GameBatchScores, GameRoomScores],
  templateUrl: './game-scores.html',
  styleUrl: './game-scores.css',
})
export class GameScores {

  protected scoresService = inject(ScoresService);
}

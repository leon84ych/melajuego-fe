import { Component } from '@angular/core';
import { CommonModule, DatePipe, SlicePipe } from '@angular/common';
import { RoomScoresService } from '../../services/games/room-scores-service';


@Component({
  selector: 'app-room-scores',
  standalone: true,
  imports: [CommonModule, SlicePipe, DatePipe],
  providers: [RoomScoresService],
  templateUrl: './room-scores.html',
  styleUrls: ['./room-scores.css'],
})
export class RoomScores{

  constructor(protected scoresService: RoomScoresService) { }

}

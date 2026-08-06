import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayersListState } from '../../data/DataInterfaces';
import { ScoresService } from '../../services/room-scores/scores-service';

interface DisplayUser {
  nickname: string;
  isHost: boolean;
  rank?: number;
  score?: number;
  timeLabel?: string;
}

@Component({
  selector: 'app-players-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './playersList.html',
  styleUrls: ['./playersList.css'],
})
export class PlayersList {

  constructor(protected scoresService: ScoresService) {}

  state = input.required<PlayersListState>();

  sortedUsers = computed(() => {
    const current = String(this.state().currentNickname).trim().toLowerCase();
    const users = this.state().connectedUsers;

    if (!current || users.length === 0) {
      return users;
    }

    const leadingUsers = users.filter((nick: string) => String(nick).trim().toLowerCase() === current);
    const remainingUsers = users.filter((nick: string) => String(nick).trim().toLowerCase() !== current);

    return [...leadingUsers, ...remainingUsers];
  });

  displayUsers = computed<DisplayUser[]>(() => {
    const users = this.state().connectedUsers ?? [];
    const batchScores = this.scoresService.roomBatchScores();
    const finished = Boolean(batchScores?.gameFinished);

    if (!finished) {
      return users.map((nickname) => ({
        nickname,
        isHost: this.isHost(nickname),
      }));
    }

    const sortedResults = this.scoresService.sortedParticipantResults();
    if (sortedResults.length === 0) {
      return users.map((nickname) => ({
        nickname,
        isHost: this.isHost(nickname),
      }));
    }

    const ranked = sortedResults.map((participant, index) => ({
      nickname: participant.nickname,
      isHost: this.isHost(participant.nickname),
      rank: index + 1,
      score: participant.percentScore,
      timeLabel: participant.responseSeconds !== null ? `${participant.responseSeconds}s` : '—',
    }));

    const rankedNicknames = new Set(sortedResults.map((participant) => String(participant.nickname).trim().toLowerCase()));
    const remaining = users
      .filter((nickname) => !rankedNicknames.has(String(nickname).trim().toLowerCase()))
      .map((nickname) => ({
        nickname,
        isHost: this.isHost(nickname),
      }));

    return [...ranked, ...remaining];
  });

  isCurrentUser(nick: string): boolean {
    return String(nick).trim().toLowerCase() === String(this.state().currentNickname).trim().toLowerCase();
  }

  isHost(nick: string): boolean {
    return String(nick).trim().toLowerCase() === String(this.state().roomHost).trim().toLowerCase();
  }

}

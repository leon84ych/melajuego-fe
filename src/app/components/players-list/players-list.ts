import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayersListState } from '../../data/DataInterfaces';

@Component({
  selector: 'app-players-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './players-list.html',
  styleUrls: ['./players-list.css'],
})
export class PlayersList {
  // Decoupled input binding keeps this component reusable
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

  isCurrentUser(nick: string): boolean {
    return String(nick).trim().toLowerCase() === String(this.state().currentNickname).trim().toLowerCase();
  }

  isHost(nick: string): boolean {
    return String(nick).trim().toLowerCase() === String(this.state().roomHost).trim().toLowerCase();
  }
}

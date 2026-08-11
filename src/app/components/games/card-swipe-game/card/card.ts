import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardData } from '../../../../data/DataInterfaces';
import { CdkDragEnd, DragDropModule } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './card.html',
  styleUrls: ['./card.css'],
})
export class Card {

  @Input({ required: true }) data!: CardData;
  @Output() onSwipe = new EventEmitter<{ id: string | number, action: 'like' | 'dislike' }>();

  // 3. Detecta cuándo el usuario suelta el mouse tras arrastrar
  onDragEnded(event: CdkDragEnd) {
    const offset = event.source.getFreeDragPosition().x;
    const swipeThreshold = 120; // Píxeles necesarios para confirmar la acción

    if (offset > swipeThreshold) {
      this.vote('like');
    } else if (offset < -swipeThreshold) {
      this.vote('dislike');
    } else {
      // Si no arrastró lo suficiente, la tarjeta regresa al centro de forma fluida
      event.source.reset();
    }
  }

  vote(action: 'like' | 'dislike') {
    this.onSwipe.emit({ id: this.data.id, action });
  }

}

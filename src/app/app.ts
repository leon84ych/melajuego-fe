import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Batch } from './components/batch/batch';
import { History } from './components/history/history';
import { Credits } from './components/credits/credits';
import { Configure } from './components/configure/configure';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, Batch, History, Credits, Configure],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./app.css'],
})
export class App {
  view = 'play' as 'play' | 'history' | 'configure' | 'credits';

  setView(value: 'play' | 'history' | 'configure' | 'credits') {
    this.view = value;
  }
}

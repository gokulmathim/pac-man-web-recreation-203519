import { Component } from '@angular/core';
import { PacmanBoardComponent } from './pacman/pacman-board.component';

@Component({
  selector: 'app-root',
  imports: [PacmanBoardComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {}

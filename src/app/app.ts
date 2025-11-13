import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CornerAlertBellComponent } from './shared/navbar/corner-alert-bell.component'; // 👈 IMPORTA EL COMPONENTE

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CornerAlertBellComponent, 
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('fitcompany-angular');
}

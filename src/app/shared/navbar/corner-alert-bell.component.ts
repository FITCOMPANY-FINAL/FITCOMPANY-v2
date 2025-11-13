import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertsService, AlertItem } from '../services/alerts.service';

@Component({
  selector: 'app-corner-alert-bell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- No render si no hay alertas -->
    <ng-container *ngIf="alerts() && alerts()!.length > 0">
      <button
        title="Alertas de inventario"
        (click)="toggle()"
        class="fixed top-4 right-4 z-50 bg-surface-800 text-red-400 border border-red-500/40 hover:border-red-500 transition px-3 py-2 rounded-full shadow"
      >
        <span class="mr-2 text-xl leading-none">🚨</span>
        <span class="text-xs bg-red-500 text-black font-bold px-2 py-[2px] rounded">
          {{ (alerts() || []).length }}
        </span>
      </button>

      <div *ngIf="open()" class="fixed top-14 right-4 z-50 w-[360px] max-h-[70vh] overflow-y-auto bg-surface-900 text-white border border-red-500/40 rounded-lg shadow-xl">
        <div class="flex items-center justify-between px-4 py-3 border-b border-red-500/30 sticky top-0 bg-surface-900">
          <div class="font-semibold text-red-300">Alertas</div>
        </div>

        <ul class="divide-y divide-white/10">
          <li *ngFor="let a of alerts()" class="px-4 py-3">
            <div class="text-sm text-red-200 font-semibold">{{ a.title }}</div>
            <div class="text-sm opacity-90">{{ a.message }}</div>

            <div class="mt-1 text-xs text-white/70">
              <ng-container *ngIf="a.code === 'STOCK_ABOVE_MAX'">
                max: {{ a.meta.max }} — actual:
                <span class="text-red-300 font-semibold">{{ a.meta.actual }}</span>
              </ng-container>

              <ng-container *ngIf="a.code === 'STOCK_BELOW_MIN'">
                min: {{ a.meta.min }} — actual:
                <span class="text-red-300 font-semibold">{{ a.meta.actual }}</span>
              </ng-container>
            </div>
          </li>
        </ul>
      </div>
    </ng-container>
  `,
})
export class CornerAlertBellComponent {
  private alertsSrv = inject(AlertsService);

  // signals para UI simple
  open = signal(false);
  alerts = signal<AlertItem[] | null>(null);

  constructor() {
    this.alertsSrv.alerts$.subscribe((arr) => this.alerts.set(arr || []));
  }

  toggle() { this.open.update((v) => !v); }
}

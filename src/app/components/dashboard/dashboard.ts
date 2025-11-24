import { Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { Sidebar } from './sidebar/sidebar';
import { RouterOutlet, Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { CornerAlertBellComponent } from '../../shared/navbar/corner-alert-bell.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [Sidebar, RouterOutlet, CornerAlertBellComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      history.pushState(null, '', this.router.url); 
    }
  }

  ngOnDestroy(): void {
  }
  @HostListener('window:popstate', ['$event'])
  onPopState(_ev: PopStateEvent) {
    if (this.auth.isAuthenticated()) {
      history.pushState(null, '', this.router.url);
    }
  }
}

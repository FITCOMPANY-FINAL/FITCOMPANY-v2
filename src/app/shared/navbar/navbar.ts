import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ViewportScroller, NgIf } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, NgIf],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class Navbar {
  public router = inject(Router);
  private scroller = inject(ViewportScroller);

  goTo(fragment: 'planes' | 'servicios' | 'contacto') {
    if (this.router.url === '/' || this.router.url.startsWith('/#')) {
      setTimeout(() => this.scroller.scrollToAnchor(fragment), 0);
    } else {
      this.router.navigate([''], { fragment });
    }
  }
}

import { Component, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../shared/services/auth.service';

interface MenuItem {
  label: string;
  icon: string;
  link: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [LucideAngularModule, RouterLink, CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar {
  private auth = inject(AuthService);
  private router = inject(Router);

  // Menú
  menu: MenuItem[] = [
    { label: 'Overview',               icon: 'LayoutDashboard',   link: 'overview' },
    { label: 'Usuarios',               icon: 'User',              link: 'usuarios' },
    { label: 'Compras',                icon: 'ShoppingCart',      link: 'compras' },
    { label: 'Ventas',                 icon: 'ShoppingBasket',    link: 'ventas' },
    { label: 'Categorías',             icon: 'ChartBarStacked',   link: 'categorias' },
    { label: 'Roles',                  icon: 'UserCog',           link: 'roles' },
    { label: 'Productos',              icon: 'Box',               link: 'productos' },
    { label: 'Perfiles',               icon: 'IdCard',            link: 'perfiles' },
    { label: 'Unidades de Medida',     icon: 'Ruler',             link: 'unidades-medidas' },
    { label: 'Permisos',               icon: 'ShieldCheck',       link: 'permisos' },
    { label: 'Tipos de Identificacion',icon: 'Fingerprint',       link: 'tipos-identificaciones' }
  ];

  // --- Modal de confirmación de logout ---
  logoutConfirmOpen = false;

  openLogoutConfirm() {
    this.logoutConfirmOpen = true;
  }

  closeLogoutConfirm() {
    this.logoutConfirmOpen = false;
  }

  doLogoutConfirmado() {
    this.logoutConfirmOpen = false;

    // Limpia sesión
    this.auth.clearSession();

    // Navega al login y evita volver con Adelante
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  // (legacy) si en algún lado quedó (click)="logout()", mantenemos compat.
  logout() {
    this.openLogoutConfirm();
  }
}

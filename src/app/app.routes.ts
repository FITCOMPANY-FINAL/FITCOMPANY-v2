import { Routes } from '@angular/router';
import { Dashboard } from './components/dashboard/dashboard';
import { authGuard } from './shared/guards/auth.guard';
import { loginGuard } from './shared/guards/login.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./components/home/home').then((m) => m.Home) },

  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () => import('./components/login/login').then((m) => m.Login),
  },

  {
    path: 'dashboard',
    canActivate: [authGuard],
    component: Dashboard,
    children: [
      {
        path: 'overview',
        loadComponent: () =>
          import('./components/dashboard/pages/overview/overview').then((m) => m.Overview),
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./components/dashboard/pages/usuarios/usuarios').then((m) => m.Usuarios),
      },
      {
        path: 'compras',
        loadComponent: () =>
          import('./components/dashboard/pages/compras/compras').then((m) => m.Compras),
      },
      {
        path: 'ventas',
        loadComponent: () =>
          import('./components/dashboard/pages/ventas/ventas').then((m) => m.Ventas),
      },
      {
        path: 'categorias',
        loadComponent: () =>
          import('./components/dashboard/pages/categorias/categorias').then((m) => m.Categorias),
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('./components/dashboard/pages/roles/roles').then((m) => m.Roles),
      },
      {
        path: 'productos',
        loadComponent: () =>
          import('./components/dashboard/pages/productos/productos').then((m) => m.Productos),
      },
      {
        path: 'unidades-medidas',
        loadComponent: () =>
          import('./components/dashboard/pages/unidades-medidas/unidades-medidas').then(
            (m) => m.UnidadesMedidas,
          ),
      },
      {
        path: 'permisos',
        loadComponent: () =>
          import('./components/dashboard/pages/permisos/permisos').then((m) => m.Permisos),
      },
      {
        path: 'tipos-identificaciones',
        loadComponent: () =>
          import('./components/dashboard/pages/tipos-identificaciones/tipos-identificaciones').then(
            (m) => m.TiposIdentificaciones,
          ),
      },
      {
        path: 'reporte-ventas',
        loadComponent: () =>
          import('./components/dashboard/pages/reporte-ventas/reporte-ventas').then(
            (m) => m.ReporteVentas,
          ),
      },
      {
        path: 'reporte-compras',
        loadComponent: () =>
          import('./components/dashboard/pages/reporte-compras/reporte-compras').then(
            (m) => m.ReporteCompras,
          ),
      },
      {
        path: 'reporte-inventario',
        loadComponent: () =>
          import('./components/dashboard/pages/reporte-inventario/reporte-inventario').then(
            (m) => m.ReporteInventario,
          ),
      },
      {
        path: 'metodos-pago',
        loadComponent: () =>
          import('./components/dashboard/pages/metodos-pago/metodos-pago').then(
            (m) => m.MetodosPago,
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
    ],
  },

  { path: '**', redirectTo: 'login' },
];

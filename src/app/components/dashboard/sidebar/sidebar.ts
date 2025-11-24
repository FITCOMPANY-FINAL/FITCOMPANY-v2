import { Component, inject, OnInit } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../shared/services/auth.service';
import { TokenPayload } from '../../../shared/models/usuario.model';

interface MenuItem {
  id: string; // ID único para identificar el item
  label: string;
  icon: string;
  link: string | null; // null si es padre (no tiene link)
  hijos?: MenuItem[]; // Hijos del menú
}

// Mapeo de URLs a iconos
const ICON_MAP: { [key: string]: string } = {
  '/dashboard/overview': 'LayoutDashboard',
  '/dashboard/usuarios': 'User',
  '/dashboard/compras': 'ShoppingCart',
  '/dashboard/ventas': 'ShoppingBasket',
  '/dashboard/categorias': 'Tag',
  '/dashboard/roles': 'Key',
  '/dashboard/productos': 'Apple',
  '/dashboard/unidades-medidas': 'Ruler',
  '/dashboard/unidades-medida': 'Ruler',
  '/dashboard/permisos': 'ShieldCheck',
  '/dashboard/tipos-identificaciones': 'Fingerprint',
  '/dashboard/tipos-identificacion': 'Fingerprint',
  '/dashboard/reportes/ventas': 'BarChart',
  '/dashboard/reportes/compras': 'LineChart',
  '/dashboard/reportes/inventario': 'Box',
};

// Mapeo de títulos de padres a iconos específicos
const PADRE_ICON_MAP: { [key: string]: string } = {
  'Seguridad': 'Lock',
  'Inventario': 'Warehouse',
  'Operaciones': 'Settings',
  'Reportes': 'FileText',
  'Gestión de Usuarios': 'Users',
};

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [LucideAngularModule, RouterLink, CommonModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  // Menú dinámico basado en formularios del JWT
  menu: MenuItem[] = [];

  // Estado de expansión de los elementos padre (key: id del item)
  expandedItems: Set<string> = new Set<string>();

  // Información del usuario
  usuario: {
    nombre: string;
    rol: string;
    correo: string;
  } | null = null;

  ngOnInit(): void {
    this.loadMenuFromToken();
    this.loadUserInfo();
  }

  private loadMenuFromToken() {
    let formularios = this.auth.getFormulariosFromToken();

    // Filtrar y eliminar "Formularios" del menú
    formularios = formularios.filter((f) => f.titulo !== 'Formularios');

    // Agregar Dashboard al inicio como un item sin hijos
    const dashboardItem: MenuItem = {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'LayoutDashboard',
      link: '/dashboard/overview',
      hijos: [],
    };

    // Separar padres e hijos
    const padres = formularios.filter((f) => f.es_padre).sort((a, b) => a.orden - b.orden);
    
    // Filtrar hijos y eliminar duplicados por URL o título
    const hijos = formularios
      .filter((f) => !f.es_padre && f.url)
      .filter((f, index, self) => 
        index === self.findIndex((h) => 
          (h.url && f.url && h.url === f.url) || 
          (h.titulo === f.titulo && h.padre === f.padre)
        )
      );

    // Construir estructura jerárquica
    const menuItems = padres
      .map((padre) => {
        // Obtener hijos de este padre
        const hijosDelPadre = hijos
          .filter((h) => h.padre === padre.id)
          .map((h) => {
            // Extraer la ruta del URL (ej: "/dashboard/ventas" -> "ventas")
            let urlPath = h.url?.replace('/dashboard/', '') || '';
            
            // Limpiar posibles barras al inicio o final
            urlPath = urlPath.trim().replace(/^\/+|\/+$/g, '');

            // Normalizar rutas que pueden tener variaciones
            // Unidades de medida
            if (urlPath === 'unidades-medida' || urlPath.includes('unidad-medida')) {
              urlPath = 'unidades-medidas';
            }
            
            // Tipos de identificación - la URL viene como "tipos-identificaciones" (correcta)
            if (urlPath === 'tipos-identificacion' || 
                urlPath === 'tipos-identificaciones' ||
                urlPath.includes('tipo-identificacion')) {
              urlPath = 'tipos-identificaciones';
            }
            
            // Normalizar rutas de reportes - las URLs vienen como "reportes/ventas", "reportes/compras", "reportes/inventario"
            if (urlPath === 'reportes/ventas' || 
                urlPath === 'reporte-ventas' ||
                (urlPath.includes('reporte') && urlPath.includes('venta'))) {
              urlPath = 'reporte-ventas';
            } else if (urlPath === 'reportes/compras' || 
                urlPath === 'reporte-compras' ||
                (urlPath.includes('reporte') && urlPath.includes('compra'))) {
              urlPath = 'reporte-compras';
            } else if (urlPath === 'reportes/inventario' || 
                urlPath === 'reporte-inventario' ||
                (urlPath.includes('reporte') && urlPath.includes('inventario'))) {
              urlPath = 'reporte-inventario';
            }

            // Debug: mostrar URL original y normalizada para casos problemáticos
            if (h.url && (h.url.includes('identificacion') || h.url.includes('reporte'))) {
              console.log(`🔍 Normalizando: "${h.url}" -> urlPath: "${urlPath}" -> link: "/dashboard/${urlPath}"`);
            }

            const finalLink = urlPath ? `/dashboard/${urlPath}` : null;
            
            return {
              id: `hijo-${h.id || h.titulo}`,
              label: h.titulo,
              icon: this.getIconForUrl(h.url || ''),
              link: finalLink,
            };
          })
          // Eliminar duplicados por link o label
          .filter((item, index, self) => 
            index === self.findIndex((h) => h.link === item.link || h.label === item.label)
          )
          .sort((a, b) => a.label.localeCompare(b.label)); // Ordenar hijos alfabéticamente

        // Solo incluir el padre si tiene hijos
        if (hijosDelPadre.length === 0) {
          return null;
        }

        const padreId = `padre-${padre.id || padre.titulo}`;
        
        // Inicializar como expandido por defecto
        this.expandedItems.add(padreId);

        return {
          id: padreId,
          label: padre.titulo,
          icon: this.getIconForPadre(padre.titulo),
          link: null, // Los padres no tienen link
          hijos: hijosDelPadre,
        };
      })
      .filter((item) => item !== null) as MenuItem[];

    // Agregar Dashboard al inicio del menú
    this.menu = [dashboardItem, ...menuItems];

    console.log('📋 Menú cargado desde JWT:', this.menu.length, 'items en el menú');
  }

  private getIconForPadre(titulo: string): string {
    // Buscar icono específico para el padre
    if (PADRE_ICON_MAP[titulo]) {
      return PADRE_ICON_MAP[titulo];
    }
    // Icono por defecto para padres
    return 'Box';
  }

  private getIconForUrl(url: string): string {
    // Buscar icono en el mapa
    if (ICON_MAP[url]) {
      return ICON_MAP[url];
    }

    // Iconos por defecto según palabras clave
    if (url.includes('overview')) return 'LayoutDashboard';
    if (url.includes('usuario')) return 'User';
    if (url.includes('compra')) return 'ShoppingCart';
    if (url.includes('venta')) return 'ShoppingBasket';
    if (url.includes('categoria')) return 'Tag';
    if (url.includes('rol')) return 'Key';
    if (url.includes('producto')) return 'Apple';
    if (url.includes('unidad') || url.includes('medida')) return 'Ruler';
    if (url.includes('permiso')) return 'ShieldCheck';
    if (url.includes('identificacion') || url.includes('tipo')) return 'Fingerprint';

    return 'Box'; // Icono por defecto (usando uno que sabemos que está disponible)
  }

  private loadUserInfo() {
    const user = this.auth.getUserFromToken();
    if (user) {
      const nombre =
        `${user.nombres || user.nombre || ''} ${user.apellido1 || ''} ${user.apellido2 || ''}`.trim();
      const rol = user.nombre_rol || user.rol || 'Sin rol';
      const correo = user.email || user.correo || 'Sin correo';

      this.usuario = { nombre, rol, correo };
    }
  }

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

  // Toggle de expansión/colapso de elementos padre
  toggleExpanded(itemId: string, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    if (this.expandedItems.has(itemId)) {
      this.expandedItems.delete(itemId);
    } else {
      this.expandedItems.add(itemId);
    }
  }

  // Verificar si un elemento está expandido
  isExpanded(itemId: string): boolean {
    return this.expandedItems.has(itemId);
  }
}


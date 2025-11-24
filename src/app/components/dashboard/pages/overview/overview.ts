import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ComprasService } from '../../../../shared/services/compras.service';
import { VentasService } from '../../../../shared/services/ventas.service';
import { ProductosService } from '../../../../shared/services/productos.service';
import { Router } from '@angular/router';

interface Actividad {
  tipo: 'compra' | 'venta';
  descripcion: string;
  fecha: string;
  icono: string;
}

interface Modulo {
  label: string;
  icono: string;
  ruta: string;
  color: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
}

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class Overview implements OnInit {
  private comprasSrv = inject(ComprasService);
  private ventasSrv = inject(VentasService);
  private productosSrv = inject(ProductosService);
  private router = inject(Router);

  // Estado y rol
  esAdmin = false;
  nombreUsuario = '';
  cargando = true;

  // Estadísticas - Solo números, sin dinero
  totalProductos = 0;
  totalCompras = 0;
  totalVentas = 0;
  comprasHoy = 0;
  ventasHoy = 0;

  // Actividades recientes
  actividades: Actividad[] = [];

  // Módulos disponibles según permisos
  modulosDisponibles: Modulo[] = [];

  // Mapeo de formularios a módulos
  private modulosMap: { [key: string]: Modulo } = {
    compras: {
      label: 'Compras',
      icono: '🛒',
      ruta: '/dashboard/compras',
      color: 'brand',
      borderColor: 'border-brand-500/30',
      bgColor: 'bg-brand-500/5',
      textColor: 'text-brand-300',
    },
    ventas: {
      label: 'Ventas',
      icono: '💰',
      ruta: '/dashboard/ventas',
      color: 'emerald',
      borderColor: 'border-emerald-500/30',
      bgColor: 'bg-emerald-500/5',
      textColor: 'text-emerald-300',
    },
    productos: {
      label: 'Productos',
      icono: '📦',
      ruta: '/dashboard/productos',
      color: 'blue',
      borderColor: 'border-blue-500/30',
      bgColor: 'bg-blue-500/5',
      textColor: 'text-blue-300',
    },
    categorias: {
      label: 'Categorías',
      icono: '🏷️',
      ruta: '/dashboard/categorias',
      color: 'purple',
      borderColor: 'border-purple-500/30',
      bgColor: 'bg-purple-500/5',
      textColor: 'text-purple-300',
    },
    usuarios: {
      label: 'Usuarios',
      icono: '👥',
      ruta: '/dashboard/usuarios',
      color: 'pink',
      borderColor: 'border-pink-500/30',
      bgColor: 'bg-pink-500/5',
      textColor: 'text-pink-300',
    },
    roles: {
      label: 'Roles',
      icono: '🔐',
      ruta: '/dashboard/roles',
      color: 'red',
      borderColor: 'border-red-500/30',
      bgColor: 'bg-red-500/5',
      textColor: 'text-red-300',
    },
  };

  ngOnInit(): void {
    this.detectarRol();
    this.cargarModulosDisponibles();
    this.cargarDatos();
  }

  /**
   * Carga los módulos disponibles según los permisos en el JWT
   */
  private cargarModulosDisponibles(): void {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        this.modulosDisponibles = [];
        return;
      }

      const partes = token.split('.');
      if (partes.length !== 3) {
        this.modulosDisponibles = [];
        return;
      }

      const payload = JSON.parse(atob(partes[1]));

      // Obtener formularios del JWT
      const formularios = payload.formularios || [];

      // Filtrar y mapear formularios a módulos
      const modulosTemp: Modulo[] = [];

      formularios.forEach((formulario: any) => {
        // Intentar obtener nombre del formulario
        const nombre = (formulario.titulo_formulario || formulario.titulo || formulario.label || '')
          .toLowerCase()
          .trim();

        // Buscar en el mapa de módulos
        for (const [clave, modulo] of Object.entries(this.modulosMap)) {
          if (nombre.includes(clave) || nombre === clave) {
            // Evitar duplicados
            if (!modulosTemp.find((m) => m.ruta === modulo.ruta)) {
              modulosTemp.push(modulo);
            }
            break;
          }
        }
      });

      // Limitar a máximo 4 módulos
      this.modulosDisponibles = modulosTemp.slice(0, 4);

      // Debug
      console.log(
        'Formularios encontrados:',
        formularios.map((f: any) => f.titulo_formulario),
      );
      console.log(
        'Módulos disponibles:',
        this.modulosDisponibles.map((m) => m.label),
      );
    } catch (error) {
      console.error('Error cargando módulos disponibles:', error);
      this.modulosDisponibles = [];
    }
  }

  /**
   * Detecta si el usuario es admin leyendo el JWT token
   */
  private detectarRol(): void {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        this.esAdmin = false;
        this.nombreUsuario = 'Usuario';
        return;
      }

      // Decodificar JWT (es un string base64.base64.base64)
      const partes = token.split('.');
      if (partes.length !== 3) {
        this.esAdmin = false;
        this.nombreUsuario = 'Usuario';
        return;
      }

      const payload = JSON.parse(atob(partes[1]));

      // Obtener nombre del usuario
      this.nombreUsuario = payload.nombre_usuario || payload.user || 'Usuario';

      // Detectar si es admin (buscar en rol o id_rol)
      this.esAdmin = payload.rol === 'admin' || payload.id_rol === 1;
    } catch (error) {
      console.error('Error decodificando token:', error);
      this.esAdmin = false;
      this.nombreUsuario = 'Usuario';
    }
  }

  /**
   * Carga todos los datos necesarios
   */
  private cargarDatos(): void {
    this.cargando = true;

    // Cargar productos
    this.productosSrv.listar().subscribe({
      next: (productos) => {
        this.totalProductos = productos?.length || 0;
      },
      error: (err) => {
        console.error('Error cargando productos:', err);
        this.totalProductos = 0;
      },
    });

    // Cargar compras
    this.comprasSrv.listar().subscribe({
      next: (compras: any[]) => {
        this.totalCompras = compras?.length || 0;
        this.comprasHoy = this.contarTransaccionesHoy(compras, 'fecha_compra');
        this.agregarActividadesCompras(compras);
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando compras:', err);
        this.totalCompras = 0;
        this.cargando = false;
      },
    });

    // Cargar ventas
    this.ventasSrv.listar().subscribe({
      next: (ventas: any[]) => {
        this.totalVentas = ventas?.length || 0;
        this.ventasHoy = this.contarTransaccionesHoy(ventas, 'fecha');
        this.agregarActividadesVentas(ventas);
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando ventas:', err);
        this.totalVentas = 0;
        this.cargando = false;
      },
    });
  }

  /**
   * Cuenta transacciones que ocurrieron hoy
   */
  private contarTransaccionesHoy(registros: any[], campoFecha: string): number {
    if (!registros || registros.length === 0) return 0;

    const hoy = new Date().toDateString();
    return registros.filter((r) => {
      try {
        const fecha = r[campoFecha];
        return new Date(fecha).toDateString() === hoy;
      } catch {
        return false;
      }
    }).length;
  }

  /**
   * Agrega actividades de compras al listado
   */
  private agregarActividadesCompras(compras: any[]): void {
    if (!compras || compras.length === 0) return;

    compras.slice(0, 3).forEach((c) => {
      this.actividades.push({
        tipo: 'compra',
        descripcion: `Se registró una compra (ID: ${c.id_compra})`,
        fecha: this.formatearFecha(c.fecha_compra),
        icono: '🛒',
      });
    });

    this.ordenarActividades();
  }

  /**
   * Agrega actividades de ventas al listado
   */
  private agregarActividadesVentas(ventas: any[]): void {
    if (!ventas || ventas.length === 0) return;

    ventas.slice(0, 3).forEach((v) => {
      this.actividades.push({
        tipo: 'venta',
        descripcion: `Se registró una venta (ID: ${v.id_venta})`,
        fecha: this.formatearFecha(v.fecha),
        icono: '💰',
      });
    });

    this.ordenarActividades();
  }

  /**
   * Ordena actividades por fecha (más reciente primero)
   */
  private ordenarActividades(): void {
    this.actividades.sort((a, b) => {
      try {
        const fechaA = new Date(a.fecha).getTime();
        const fechaB = new Date(b.fecha).getTime();
        return fechaB - fechaA;
      } catch {
        return 0;
      }
    });
  }

  /**
   * Formatea una fecha al formato DD/MM/YYYY HH:MM
   */
  private formatearFecha(fecha?: string): string {
    if (!fecha) return '';

    try {
      const d = new Date(fecha);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    } catch {
      return fecha;
    }
  }

  // ========== Acciones de navegación ==========

  navegarAModulo(ruta: string): void {
    this.router.navigate([ruta]);
  }
}

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';

interface Actividad {
  tipo: 'compra' | 'venta' | 'producto' | 'compra_eliminada' | 'venta_eliminada' | 'producto_eliminado';
  descripcion: string;
  fecha: string; // Fecha formateada para mostrar
  fechaOriginal: string; // Fecha original para ordenar
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
export class Overview implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private API = environment.apiBaseUrl;

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
    
    // Escuchar eventos de actualización desde otros componentes
    window.addEventListener('dashboard:refresh', () => {
      this.cargarDatos();
    });
  }

  ngOnDestroy(): void {
    // Limpiar listener
    window.removeEventListener('dashboard:refresh', () => {
      this.cargarDatos();
    });
  }

  /**
   * Carga los módulos disponibles según los permisos en el JWT
   */
  private cargarModulosDisponibles(): void {
    try {
      const token = localStorage.getItem('fit_token');
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
      const token = localStorage.getItem('fit_token');
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

      // Construir nombre completo del usuario
      const nombres = payload.nombres || '';
      const apellido1 = payload.apellido1 || '';
      const apellido2 = payload.apellido2 || '';
      
      if (nombres || apellido1) {
        this.nombreUsuario = [nombres, apellido1, apellido2].filter(Boolean).join(' ').trim();
      } else {
        this.nombreUsuario = payload.nombre_usuario || payload.user || 'Usuario';
      }

      // Detectar si es admin (buscar en rol o id_rol)
      // Forzar versión simple del dashboard (no admin)
      this.esAdmin = false; // Siempre mostrar versión simple
    } catch (error) {
      console.error('Error decodificando token:', error);
      this.esAdmin = false;
      this.nombreUsuario = 'Usuario';
    }
  }

  /**
   * Carga todos los datos necesarios desde el endpoint del dashboard
   */
  private cargarDatos(): void {
    this.cargando = true;

    // Cargar datos del dashboard desde el backend
    this.http.get<any>(`${this.API}/reportes/dashboard`).subscribe({
      next: (data) => {
        // Datos del dashboard
        this.totalProductos = data.inventario?.total_productos || 0;
        this.comprasHoy = data.resumen_hoy?.compras?.cantidad || 0;
        this.ventasHoy = data.resumen_hoy?.ventas?.cantidad || 0;
        this.totalCompras = data.resumen_mes?.compras?.cantidad || 0;
        this.totalVentas = data.resumen_mes?.ventas?.cantidad || 0;

        // Cargar actividades recientes desde compras y ventas
        this.cargarActividadesRecientes();
        
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando dashboard:', err);
        this.totalProductos = 0;
        this.comprasHoy = 0;
        this.ventasHoy = 0;
        this.totalCompras = 0;
        this.totalVentas = 0;
        this.cargando = false;
      },
    });
  }

  /**
   * Carga las actividades recientes desde compras, ventas y productos
   */
  private cargarActividadesRecientes(): void {
    this.actividades = []; // Limpiar actividades anteriores
    
    // Cargar compras recientes (activas)
    this.http.get<any[]>(`${this.API}/compras`).subscribe({
      next: (compras) => {
        if (compras && compras.length > 0) {
          const comprasOrdenadas = compras
            .sort((a, b) => {
              const fechaA = new Date(a.fecha_compra || 0).getTime();
              const fechaB = new Date(b.fecha_compra || 0).getTime();
              return fechaB - fechaA;
            })
            .slice(0, 5);
            
          comprasOrdenadas.forEach((c) => {
            this.actividades.push({
              tipo: 'compra',
              descripcion: `Se registró una compra (ID: ${c.id_compra})`,
              fecha: this.formatearFecha(c.fecha_compra),
              fechaOriginal: c.fecha_compra,
              icono: '🛒',
            });
          });
        }
        this.ordenarActividades();
      },
      error: (err) => {
        console.error('Error cargando compras para actividades:', err);
      },
    });

    // Cargar ventas recientes (activas y eliminadas)
    this.http.get<any[]>(`${this.API}/ventas?incluir_eliminadas=true`).subscribe({
      next: (ventas) => {
        if (ventas && ventas.length > 0) {
          ventas.forEach((v) => {
            const fechaVenta = v.fecha || v.fecha_venta;
            const fechaEliminacion = v.eliminado_en;
            
            if (v.activo === false && fechaEliminacion) {
              // Venta eliminada
              this.actividades.push({
                tipo: 'venta_eliminada',
                descripcion: `Se eliminó una venta (ID: ${v.id_venta})`,
                fecha: this.formatearFecha(fechaEliminacion),
                fechaOriginal: fechaEliminacion,
                icono: '🗑️',
              });
            } else if (v.activo !== false) {
              // Venta activa
              this.actividades.push({
                tipo: 'venta',
                descripcion: `Se registró una venta (ID: ${v.id_venta})`,
                fecha: this.formatearFecha(fechaVenta),
                fechaOriginal: fechaVenta,
                icono: '💰',
              });
            }
          });
        }
        this.ordenarActividades();
      },
      error: (err) => {
        console.error('Error cargando ventas para actividades:', err);
      },
    });

    // Cargar productos recientes (creados)
    this.http.get<any[]>(`${this.API}/productos`).subscribe({
      next: (productos) => {
        if (productos && productos.length > 0) {
          // Ordenar por fecha de creación más reciente
          const productosOrdenados = productos
            .filter((p) => p.creado_en) // Solo productos con fecha de creación
            .sort((a, b) => {
              const fechaA = new Date(a.creado_en || 0).getTime();
              const fechaB = new Date(b.creado_en || 0).getTime();
              return fechaB - fechaA;
            })
            .slice(0, 3); // Solo los 3 más recientes
              
          productosOrdenados.forEach((p) => {
            this.actividades.push({
              tipo: 'producto',
              descripcion: `Se registró un producto: ${p.nombre_producto}`,
              fecha: this.formatearFecha(p.creado_en),
              fechaOriginal: p.creado_en,
              icono: '📦',
            });
          });
        }
        this.ordenarActividades();
      },
      error: (err) => {
        console.error('Error cargando productos para actividades:', err);
      },
    });
  }


  /**
   * Ordena actividades por fecha (más reciente primero)
   */
  private ordenarActividades(): void {
    this.actividades.sort((a, b) => {
      try {
        const fechaA = new Date(a.fechaOriginal || a.fecha).getTime();
        const fechaB = new Date(b.fechaOriginal || b.fecha).getTime();
        return fechaB - fechaA; // Más reciente primero
      } catch {
        return 0;
      }
    });
    // Limitar a las 10 más recientes (se mostrarán 5 en la UI)
    this.actividades = this.actividades.slice(0, 10);
  }

  /**
   * Formatea una fecha al formato DD/MM/YYYY HH:MM:SS de forma profesional
   */
  private formatearFecha(fecha?: string): string {
    if (!fecha) return '';

    try {
      const d = new Date(fecha);
      
      // Validar que la fecha sea válida
      if (isNaN(d.getTime())) {
        return fecha;
      }
      
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      
      return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
    } catch {
      return fecha;
    }
  }

  /**
   * Método público para refrescar los datos del dashboard
   * Se puede llamar desde otros componentes cuando hay cambios
   */
  refrescarDatos(): void {
    this.cargarDatos();
  }

  // ========== Acciones de navegación ==========

  navegarAModulo(ruta: string): void {
    this.router.navigate([ruta]);
  }
}

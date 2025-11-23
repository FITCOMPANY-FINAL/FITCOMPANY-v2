import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ComprasService } from '../../../../shared/services/compras.service';
import { VentasService } from '../../../../shared/services/ventas.service';
import { ProductosService } from '../../../../shared/services/productos.service';
import { Router } from '@angular/router';

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

  // Estadísticas
  totalProductos = 0;
  totalCompras = 0;
  totalVentas = 0;
  ventasHoy = 0;
  comprasHoy = 0;
  ingresosMes = 0;

  // Actividades recientes
  actividades: Array<{
    tipo: string;
    descripcion: string;
    fecha: string;
    icono: string;
  }> = [];

  ngOnInit(): void {
    this.cargarEstadisticas();
  }

  private cargarEstadisticas(): void {
    // Cargar productos
    this.productosSrv.listar().subscribe({
      next: (productos) => {
        this.totalProductos = productos?.length || 0;
      },
      error: () => {
        this.totalProductos = 0;
      },
    });

    // Cargar compras
    this.comprasSrv.listar().subscribe({
      next: (compras: any) => {
        this.totalCompras = compras?.length || 0;
        this.comprasHoy = this.contarHoy(compras || []);
        (compras || []).slice(0, 3).forEach((c: any) => {
          this.actividades.push({
            tipo: 'compra',
            descripcion: `Se registró una compra (ID: ${c.id_compra})`,
            fecha: this.formatearFecha(c.fecha_compra),
            icono: '🛒',
          });
        });
      },
      error: () => {
        this.totalCompras = 0;
      },
    });

    // Cargar ventas
    this.ventasSrv.listar().subscribe({
      next: (ventas: any) => {
        this.totalVentas = ventas?.length || 0;
        this.ventasHoy = this.contarHoy(ventas || []);
        this.ingresosMes = this.calcularIngresos(ventas || []);
        (ventas || []).slice(0, 3).forEach((v: any) => {
          this.actividades.push({
            tipo: 'venta',
            descripcion: `Se registró una venta (ID: ${v.id_venta})`,
            fecha: this.formatearFecha(v.fecha),
            icono: '💰',
          });
        });
        // Ordenar por fecha más reciente primero
        this.actividades.sort((a, b) => {
          try {
            const fechaA = new Date(a.fecha).getTime();
            const fechaB = new Date(b.fecha).getTime();
            return fechaB - fechaA;
          } catch {
            return 0;
          }
        });
      },
      error: () => {
        this.totalVentas = 0;
      },
    });
  }

  private contarHoy(registros: any[]): number {
    const hoy = new Date().toDateString();
    return (
      registros?.filter((r) => {
        try {
          const fecha = r.fecha_compra || r.fecha;
          return new Date(fecha).toDateString() === hoy;
        } catch {
          return false;
        }
      }).length || 0
    );
  }

  private calcularIngresos(ventas: any[]): number {
    const mesActual = new Date().getMonth();
    const añoActual = new Date().getFullYear();

    return (
      ventas
        ?.filter((v) => {
          try {
            const fecha = new Date(v.fecha);
            return fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual;
          } catch {
            return false;
          }
        })
        .reduce((sum, v) => sum + (Number(v.total) || 0), 0) || 0
    );
  }

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

  // Acciones rápidas
  irACompras(): void {
    this.router.navigate(['/dashboard/compras']);
  }

  irAVentas(): void {
    this.router.navigate(['/dashboard/ventas']);
  }

  irAProductos(): void {
    this.router.navigate(['/dashboard/productos']);
  }
}

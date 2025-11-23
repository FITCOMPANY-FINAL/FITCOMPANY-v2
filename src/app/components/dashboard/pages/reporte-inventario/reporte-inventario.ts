import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportesService, DashboardResponse } from '../../../../shared/services/reportes.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-reporte-inventario',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reporte-inventario.html',
  styleUrl: './reporte-inventario.scss',
})
export class ReporteInventario implements OnInit {
  private reportesSrv = inject(ReportesService);

  loading = false;
  errorMsg = '';
  datos: DashboardResponse | null = null;

  ngOnInit(): void {
    this.cargarReporte();
  }

  cargarReporte(): void {
    this.loading = true;
    this.errorMsg = '';
    this.datos = null;

    this.reportesSrv.dashboard().subscribe({
      next: (data) => {
        this.datos = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar reporte:', err);
        this.errorMsg = err.error?.message || 'Error al cargar el reporte de inventario';
        this.loading = false;
      },
    });
  }

  formatearFecha(fecha: string): string {
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

  formatearFechaCorta(fecha: string): string {
    try {
      const d = new Date(fecha);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch {
      return fecha;
    }
  }

  // Exportar a Excel
  exportarAExcel(): void {
    if (!this.datos) {
      this.errorMsg = 'No hay datos para exportar';
      return;
    }

    const workbook = XLSX.utils.book_new();

    // Hoja 1: Resumen General
    const resumenData = [
      ['REPORTE DE INVENTARIO Y DASHBOARD'],
      [''],
      ['Fecha de Generación:', this.formatearFecha(this.datos.fecha_generacion)],
      [''],
      ['RESUMEN DE HOY'],
      ['Ventas de Hoy:', this.datos.resumen_hoy.ventas.cantidad, this.datos.resumen_hoy.ventas.total],
      ['Compras de Hoy:', this.datos.resumen_hoy.compras.cantidad, this.datos.resumen_hoy.compras.total],
      [''],
      ['RESUMEN DEL MES'],
      ['Ventas del Mes:', this.datos.resumen_mes.ventas.cantidad, this.datos.resumen_mes.ventas.total],
      ['Compras del Mes:', this.datos.resumen_mes.compras.cantidad, this.datos.resumen_mes.compras.total],
      ['Ganancia Neta:', '', this.datos.resumen_mes.ganancia_neta],
    ];
    const resumenSheet = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(workbook, resumenSheet, 'Resumen');

    // Hoja 2: Estado del Inventario
    const inventarioData = [
      ['ESTADO DEL INVENTARIO'],
      [''],
      ['Total Productos:', this.datos.inventario.total_productos],
      ['Productos por Encima del Stock Máximo:', this.datos.inventario.productos_sobre_maximo],
      ['Productos Bajo del Stock Mínimo:', this.datos.inventario.productos_bajo_minimo],
      ['Valor Total Inventario:', this.datos.inventario.valor_total],
      [''],
    ];

    // Agregar productos por encima del stock máximo si hay
    if (this.datos.inventario.productos_sobre_maximo_lista.length > 0) {
      inventarioData.push(['PRODUCTOS POR ENCIMA DEL STOCK MÁXIMO']);
      inventarioData.push(['Producto', 'Stock Actual', 'Stock Máximo', 'Exceso']);
      inventarioData.push(
        ...this.datos.inventario.productos_sobre_maximo_lista.map(p => [
          p.nombre,
          p.stock_actual,
          p.stock_maximo,
          p.exceso,
        ])
      );
      inventarioData.push(['']);
    }

    // Agregar productos bajo del stock mínimo si hay
    if (this.datos.inventario.productos_bajo_minimo_lista.length > 0) {
      inventarioData.push(['PRODUCTOS BAJO DEL STOCK MÍNIMO']);
      inventarioData.push(['Producto', 'Stock Actual', 'Stock Mínimo', 'Faltante']);
      inventarioData.push(
        ...this.datos.inventario.productos_bajo_minimo_lista.map(p => [
          p.nombre,
          p.stock_actual,
          p.stock_minimo,
          p.faltante,
        ])
      );
    }
    const inventarioSheet = XLSX.utils.aoa_to_sheet(inventarioData);
    XLSX.utils.book_append_sheet(workbook, inventarioSheet, 'Inventario');

    // Hoja 3: Cartera
    const carteraData = [
      ['CARTERA (VENTAS FIADAS)'],
      [''],
      ['Ventas Pendientes:', this.datos.cartera.ventas_pendientes],
      ['Total por Cobrar:', this.datos.cartera.total_por_cobrar],
    ];
    const carteraSheet = XLSX.utils.aoa_to_sheet(carteraData);
    XLSX.utils.book_append_sheet(workbook, carteraSheet, 'Cartera');

    // Hoja 4: Top 5 Productos
    const topProductosData = [
      ['TOP 5 PRODUCTOS MÁS VENDIDOS DEL MES'],
      [''],
      ['Producto', 'Unidades', 'Total'],
      ...this.datos.top_5_productos.map(p => [
        p.nombre,
        p.unidades,
        p.total,
      ]),
    ];
    const topProductosSheet = XLSX.utils.aoa_to_sheet(topProductosData);
    XLSX.utils.book_append_sheet(workbook, topProductosSheet, 'Top Productos');

    // Hoja 5: Producto Más Rentable
    const rentableData = [
      ['PRODUCTO MÁS RENTABLE DEL MES'],
      [''],
    ];
    if (this.datos.producto_mas_rentable) {
      rentableData.push(
        ['Producto:', this.datos.producto_mas_rentable.nombre],
        ['Ganancia Total:', String(this.datos.producto_mas_rentable.ganancia)],
      );
    } else {
      rentableData.push(['No hay datos disponibles']);
    }
    const rentableSheet = XLSX.utils.aoa_to_sheet(rentableData);
    XLSX.utils.book_append_sheet(workbook, rentableSheet, 'Producto Rentable');

    // Generar nombre del archivo
    const fecha = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const nombreArchivo = `Reporte_Inventario_${fecha}.xlsx`;

    // Descargar
    XLSX.writeFile(workbook, nombreArchivo);
  }
}


import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ReportesService, ReporteVentasResponse } from '../../../../shared/services/reportes.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-reporte-ventas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './reporte-ventas.html',
  styleUrl: './reporte-ventas.scss',
})
export class ReporteVentas implements OnInit {
  private fb = inject(FormBuilder);
  private reportesSrv = inject(ReportesService);

  loading = false;
  errorMsg = '';
  errorFecha = '';
  datos: ReporteVentasResponse | null = null;
  
  // Filtro para ventas por día
  vistaVentasPorDia: 'todas' | 'con-ventas' = 'con-ventas';

  form: FormGroup = this.fb.group({
    periodo: ['mensual'],
    fecha_inicio: [null],
    fecha_fin: [null],
  });

  periodos = [
    { value: 'hoy', label: 'Hoy' },
    { value: 'semanal', label: 'Últimos 7 días' },
    { value: 'mensual', label: 'Mes actual' },
    { value: 'anual', label: 'Año actual' },
    { value: 'personalizado', label: 'Rango personalizado' },
  ];

  ngOnInit(): void {
    this.cargarReporte();
  }

  formatearFecha(fecha: string): string {
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

  onPeriodoChange(): void {
    const periodo = this.form.get('periodo')?.value;
    if (periodo === 'personalizado') {
      this.form.get('fecha_inicio')?.setValidators([Validators.required]);
      this.form.get('fecha_fin')?.setValidators([Validators.required, this.validarFechaFin.bind(this)]);
    } else {
      this.form.get('fecha_inicio')?.clearValidators();
      this.form.get('fecha_fin')?.clearValidators();
      this.form.get('fecha_inicio')?.setValue(null);
      this.form.get('fecha_fin')?.setValue(null);
      this.errorFecha = '';
    }
    this.form.get('fecha_inicio')?.updateValueAndValidity();
    this.form.get('fecha_fin')?.updateValueAndValidity();
  }

  validarFechaFin(control: AbstractControl): ValidationErrors | null {
    const fechaFin = control.value;
    const fechaInicio = this.form.get('fecha_inicio')?.value;

    if (!fechaFin || !fechaInicio) {
      return null;
    }

    const fechaFinDate = new Date(fechaFin);
    const fechaInicioDate = new Date(fechaInicio);

    if (fechaFinDate < fechaInicioDate) {
      return { fechaAnterior: true };
    }

    return null;
  }

  onFechaChange(): void {
    const fechaInicio = this.form.get('fecha_inicio')?.value;
    const fechaFin = this.form.get('fecha_fin')?.value;

    if (fechaInicio && fechaFin) {
      const fechaInicioDate = new Date(fechaInicio);
      const fechaFinDate = new Date(fechaFin);

      if (fechaFinDate < fechaInicioDate) {
        this.errorFecha = 'La fecha fin no puede ser anterior a la fecha inicio';
        this.form.get('fecha_fin')?.setErrors({ fechaAnterior: true });
      } else {
        this.errorFecha = '';
        this.form.get('fecha_fin')?.setErrors(null);
        this.form.get('fecha_fin')?.updateValueAndValidity();
      }
    } else {
      this.errorFecha = '';
    }
  }

  cargarReporte(): void {
    // Validar fechas antes de cargar
    if (this.form.get('periodo')?.value === 'personalizado') {
      const fechaInicio = this.form.get('fecha_inicio')?.value;
      const fechaFin = this.form.get('fecha_fin')?.value;

      if (!fechaInicio || !fechaFin) {
        this.errorFecha = 'Debe seleccionar ambas fechas';
        return;
      }

      const fechaInicioDate = new Date(fechaInicio);
      const fechaFinDate = new Date(fechaFin);

      if (fechaFinDate < fechaInicioDate) {
        this.errorFecha = 'La fecha fin no puede ser anterior a la fecha inicio';
        return;
      }
    }

    this.errorFecha = '';
    this.loading = true;
    this.errorMsg = '';
    this.datos = null;

    const formValue = this.form.value;
    const params: any = {};

    if (formValue.periodo && formValue.periodo !== 'personalizado') {
      params.periodo = formValue.periodo;
    } else if (formValue.fecha_inicio && formValue.fecha_fin) {
      params.fecha_inicio = formValue.fecha_inicio;
      params.fecha_fin = formValue.fecha_fin;
    }

    this.reportesSrv.reporteVentas(params).subscribe({
      next: (data) => {
        this.datos = data;
        this.loading = false;
        this.errorMsg = '';
      },
      error: (err) => {
        console.error('Error al cargar reporte de ventas:', err);
        console.error('Detalles del error:', {
          status: err.status,
          statusText: err.statusText,
          error: err.error,
          message: err.message
        });
        this.errorMsg = err.error?.message || err.message || 'Error al generar reporte de ventas.';
        this.loading = false;
        this.datos = null;
      },
    });
  }

  // Filtrar ventas por día según la vista seleccionada
  get ventasPorDiaFiltradas() {
    if (!this.datos) return [];
    
    if (this.vistaVentasPorDia === 'con-ventas') {
      return this.datos.por_dia.filter(dia => dia.cantidad > 0 || dia.total > 0);
    }
    
    return this.datos.por_dia;
  }

  // Exportar a Excel
  exportarAExcel(): void {
    if (!this.datos) {
      this.errorMsg = 'No hay datos para exportar';
      return;
    }

    const workbook = XLSX.utils.book_new();

    // Hoja 1: Resumen
    const resumenData = [
      ['REPORTE DE VENTAS'],
      [''],
      ['Período:', this.datos.periodo.tipo],
      ['Fecha Inicio:', this.formatearFecha(this.datos.periodo.fecha_inicio)],
      ['Fecha Fin:', this.formatearFecha(this.datos.periodo.fecha_fin)],
      ['Días:', this.datos.periodo.dias],
      [''],
      ['RESUMEN GENERAL'],
      ['Total Ventas:', this.datos.resumen.total_ventas],
      ['Cantidad de Ventas:', this.datos.resumen.cantidad_ventas],
      ['Venta Promedio:', this.datos.resumen.venta_promedio],
      [''],
      ['VENTAS CONTADO'],
      ['Cantidad:', this.datos.resumen.ventas_contado],
      ['Total:', this.datos.resumen.total_contado],
      [''],
      ['VENTAS FIADAS'],
      ['Cantidad:', this.datos.resumen.ventas_fiadas],
      ['Total:', this.datos.resumen.total_fiado],
    ];
    const resumenSheet = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(workbook, resumenSheet, 'Resumen');

    // Hoja 2: Ventas por día (solo con ventas)
    const ventasPorDiaData = [
      ['Fecha', 'Cantidad', 'Total'],
      ...this.ventasPorDiaFiltradas.map(dia => [
        this.formatearFecha(dia.fecha),
        dia.cantidad,
        dia.total,
      ]),
    ];
    const ventasPorDiaSheet = XLSX.utils.aoa_to_sheet(ventasPorDiaData);
    XLSX.utils.book_append_sheet(workbook, ventasPorDiaSheet, 'Ventas por Día');

    // Hoja 3: Productos más vendidos
    const productosData = [
      ['Producto', 'Unidades', 'Total'],
      ...this.datos.productos_mas_vendidos.map(p => [
        p.nombre,
        p.unidades,
        p.total,
      ]),
    ];
    const productosSheet = XLSX.utils.aoa_to_sheet(productosData);
    XLSX.utils.book_append_sheet(workbook, productosSheet, 'Productos Más Vendidos');

    // Hoja 4: Ventas por vendedor
    const vendedoresData = [
      ['Vendedor', 'Cantidad Ventas', 'Total Vendido'],
      ...this.datos.vendedores.map(v => [
        v.nombre,
        v.ventas,
        v.total,
      ]),
    ];
    const vendedoresSheet = XLSX.utils.aoa_to_sheet(vendedoresData);
    XLSX.utils.book_append_sheet(workbook, vendedoresSheet, 'Ventas por Vendedor');

    // Hoja 5: Cartera (si hay deudas pendientes)
    if (this.datos.cartera && this.datos.cartera.cantidad_ventas_pendientes > 0) {
      const carteraData = [
        ['CARTERA - DEUDAS PENDIENTES'],
        [''],
        ['Total por Cobrar:', this.datos.cartera.total_por_cobrar],
        ['Cantidad de Ventas Pendientes:', this.datos.cartera.cantidad_ventas_pendientes],
        [''],
        ['Folio', 'Fecha', 'Cliente', 'Total Venta', 'Pagado', 'Saldo Pendiente', 'Vendedor'],
        ...this.datos.cartera.ventas_pendientes.map(v => [
          v.folio || 'N/A',
          this.formatearFecha(v.fecha),
          v.cliente || 'Sin cliente',
          v.total,
          v.pagado,
          v.saldo_pendiente,
          v.vendedor,
        ]),
      ];
      const carteraSheet = XLSX.utils.aoa_to_sheet(carteraData);
      XLSX.utils.book_append_sheet(workbook, carteraSheet, 'Cartera');
    }

    // Generar nombre del archivo
    const fechaInicio = this.datos.periodo.fecha_inicio.replace(/-/g, '');
    const fechaFin = this.datos.periodo.fecha_fin.replace(/-/g, '');
    const nombreArchivo = `Reporte_Ventas_${fechaInicio}_${fechaFin}.xlsx`;

    // Descargar
    XLSX.writeFile(workbook, nombreArchivo);
  }
}


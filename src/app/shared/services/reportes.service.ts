import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface ReporteVentasResponse {
  ok: boolean;
  periodo: {
    tipo: string;
    fecha_inicio: string;
    fecha_fin: string;
    dias: number;
  };
  resumen: {
    total_ventas: number;
    cantidad_ventas: number;
    venta_promedio: number;
    ventas_contado: number;
    ventas_fiadas: number;
    total_contado: number;
    total_fiado: number;
  };
  por_dia: Array<{
    fecha: string;
    cantidad: number;
    total: number;
  }>;
  productos_mas_vendidos: Array<{
    id_producto: number;
    nombre: string;
    unidades: number;
    total: number;
  }>;
  vendedores: Array<{
    nombre: string;
    ventas: number;
    total: number;
  }>;
}

export interface ReporteComprasResponse {
  ok: boolean;
  periodo: {
    tipo: string;
    fecha_inicio: string;
    fecha_fin: string;
    dias: number;
  };
  resumen: {
    total_compras: number;
    cantidad_compras: number;
    compra_promedio: number;
  };
  por_dia: Array<{
    fecha: string;
    cantidad: number;
    total: number;
  }>;
  productos_mas_comprados: Array<{
    id_producto: number;
    nombre: string;
    unidades: number;
    total: number;
  }>;
  usuarios: Array<{
    nombre: string;
    compras: number;
    total: number;
  }>;
}

export interface DashboardResponse {
  ok: boolean;
  fecha_generacion: string;
  resumen_hoy: {
    ventas: {
      cantidad: number;
      total: number;
    };
    compras: {
      cantidad: number;
      total: number;
    };
  };
  resumen_mes: {
    ventas: {
      cantidad: number;
      total: number;
    };
    compras: {
      cantidad: number;
      total: number;
    };
    ganancia_neta: number;
  };
  inventario: {
    total_productos: number;
    productos_sobre_maximo: number;
    productos_bajo_minimo: number;
    valor_total: number;
    productos_sobre_maximo_lista: Array<{
      id_producto: number;
      nombre: string;
      stock_actual: number;
      stock_maximo: number;
      exceso: number;
    }>;
    productos_bajo_minimo_lista: Array<{
      id_producto: number;
      nombre: string;
      stock_actual: number;
      stock_minimo: number;
      faltante: number;
    }>;
  };
  cartera: {
    ventas_pendientes: number;
    total_por_cobrar: number;
  };
  top_5_productos: Array<{
    nombre: string;
    unidades: number;
    total: number;
  }>;
  producto_mas_rentable: {
    nombre: string;
    ganancia: number;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/reportes`;

  reporteVentas(params: {
    periodo?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
  }): Observable<ReporteVentasResponse> {
    let httpParams = new HttpParams();
    if (params.periodo) httpParams = httpParams.set('periodo', params.periodo);
    if (params.fecha_inicio) httpParams = httpParams.set('fecha_inicio', params.fecha_inicio);
    if (params.fecha_fin) httpParams = httpParams.set('fecha_fin', params.fecha_fin);

    return this.http.get<ReporteVentasResponse>(`${this.base}/ventas`, { params: httpParams });
  }

  reporteCompras(params: {
    periodo?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
  }): Observable<ReporteComprasResponse> {
    let httpParams = new HttpParams();
    if (params.periodo) httpParams = httpParams.set('periodo', params.periodo);
    if (params.fecha_inicio) httpParams = httpParams.set('fecha_inicio', params.fecha_inicio);
    if (params.fecha_fin) httpParams = httpParams.set('fecha_fin', params.fecha_fin);

    return this.http.get<ReporteComprasResponse>(`${this.base}/compras`, { params: httpParams });
  }

  dashboard(): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(`${this.base}/dashboard`);
  }
}


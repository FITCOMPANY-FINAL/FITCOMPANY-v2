import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { Venta, VentaDetalleItem } from '../models/venta.model';
import { AbonosResponse } from '../models/abono.model';

@Injectable({ providedIn: 'root' })
export class VentasService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/ventas`;

  listar(): Observable<Venta[]> {
    return this.http.get<Venta[]>(this.base);
  }

  detalle(id: number): Observable<{ productos: VentaDetalleItem[] }> {
    return this.http.get<{ productos: VentaDetalleItem[] }>(`${this.base}/${id}`);
  }

  crear(body: {
    productos: Array<{ id_producto: number; cantidad: number; precio_unitario: number }>;
    pagos?: Array<{ id_metodo_pago: number; monto: number; observaciones?: string | null }>;
    cliente_desc?: string | null;
    fecha_venta?: string; // YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss
    observaciones?: string | null;
  }): Observable<{ venta?: any; message?: string; warnings?: any[] }> {
    return this.http.post<{ venta?: any; message?: string; warnings?: any[] }>(this.base, body);
  }

  eliminar(
    id: number,
    motivo?: string | null,
  ): Observable<{ message?: string; warnings?: any[]; violations?: any[]; code?: string }> {
    const params = new URLSearchParams();
    if (motivo && motivo.trim()) {
      params.append('motivo', motivo.trim());
    }
    const url = `${this.base}/${id}${params.toString() ? '?' + params.toString() : ''}`;
    return this.http.delete<{
      message?: string;
      warnings?: any[];
      violations?: any[];
      code?: string;
    }>(url);
  }

  // ═══════════════════════════════════════════════════════════
  // 💰 ABONOS
  // ═══════════════════════════════════════════════════════════

  obtenerAbonos(idVenta: number): Observable<AbonosResponse> {
    return this.http.get<AbonosResponse>(`${this.base}/${idVenta}/abonos`);
  }

  registrarAbono(
    idVenta: number,
    body: {
      id_metodo_pago: number;
      monto: number;
      observaciones?: string | null;
    },
  ): Observable<{
    message?: string;
    abono: any;
    venta: any;
  }> {
    return this.http.post<{ message?: string; abono: any; venta: any }>(
      `${this.base}/${idVenta}/abonos`,
      body,
    );
  }
}

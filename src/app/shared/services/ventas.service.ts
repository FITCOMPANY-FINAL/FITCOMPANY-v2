import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { Venta, VentaDetalleItem } from '../models/venta.model';

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
  }): Observable<{ id_venta?: number; message?: string; warnings?: any[] }> {
    return this.http.post<{ id_venta?: number; message?: string; warnings?: any[] }>(this.base, body);
  }

  actualizar(id: number, body: {
    productos: Array<{ id_producto: number; cantidad: number; precio_unitario: number }>;
  }): Observable<{ message?: string; warnings?: any[] }> {
    return this.http.put<{ message?: string; warnings?: any[] }>(`${this.base}/${id}`, body);
  }

  eliminar(id: number): Observable<{ message?: string; warnings?: any[]; violations?: any[]; code?: string }> {
    return this.http.delete<{ message?: string; warnings?: any[]; violations?: any[]; code?: string }>(`${this.base}/${id}`);
  }
}

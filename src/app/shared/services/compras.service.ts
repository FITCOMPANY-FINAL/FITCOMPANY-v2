import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { Compra } from '../models/compra.model';

@Injectable({ providedIn: 'root' })
export class ComprasService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/compras`;

  listar(): Observable<Compra[]> {
    return this.http.get<Compra[]>(this.base);
  }

  crear(body: {
    detalles: Array<{ id_producto: number; cantidad: number; precio_unitario: number }>;
    fecha_compra?: string; // YYYY-MM-DD (opcional, usa fecha actual si no se envía)
    observaciones?: string | null;
  }): Observable<{ compra?: any; message?: string; warnings?: any[] }> {
    return this.http.post<{ compra?: any; message?: string; warnings?: any[] }>(this.base, body);
  }

  obtenerPorId(id: number): Observable<{ detalles: any[]; [key: string]: any }> {
    return this.http.get<{ detalles: any[]; [key: string]: any }>(`${this.base}/${id}`);
  }

  actualizar(id: number, body: {
    detalles: Array<{ id_producto: number; cantidad: number; precio_unitario: number }>;
    fecha_compra?: string;
    observaciones?: string | null;
  }): Observable<{ compra?: any; message?: string; warnings?: any[] }> {
    return this.http.put<{ compra?: any; message?: string; warnings?: any[] }>(`${this.base}/${id}`, body);
  }

  eliminar(id: number): Observable<{ message?: string }> {
    return this.http.delete<{ message?: string }>(`${this.base}/${id}`);
  }
}

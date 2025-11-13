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
    cantidad: number;
    costo_unitario: number;
    producto_id: number;
    fecha_compra: string; // YYYY-MM-DD
  }): Observable<{ id_compra?: number; message?: string; warnings?: any[] }> {
    return this.http.post<{ id_compra?: number; message?: string; warnings?: any[] }>(this.base, body);
  }

  actualizar(id: number, body: {
    cantidad: number;
    costo_unitario: number;
    producto_id: number;
    fecha_compra: string;
  }): Observable<{ message?: string; warnings?: any[] }> {
    return this.http.put<{ message?: string; warnings?: any[] }>(`${this.base}/${id}`, body);
  }

  eliminar(id: number): Observable<{ message?: string }> {
    return this.http.delete<{ message?: string }>(`${this.base}/${id}`);
  }
}

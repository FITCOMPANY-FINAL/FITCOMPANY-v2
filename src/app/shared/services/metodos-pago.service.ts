import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface MetodoPago {
  id_metodo_pago: number;
  nombre_metodo_pago: string;
  descripcion_metodo_pago?: string | null;
  activo: boolean;
  creado_en?: string;
}

@Injectable({ providedIn: 'root' })
export class MetodosPagoService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/metodos-pago`;

  listar(): Observable<MetodoPago[]> {
    return this.http.get<MetodoPago[]>(this.base);
  }

  crear(body: Partial<MetodoPago>) {
    return this.http.post<{ message: string }>(this.base, body);
  }

  actualizar(id_metodo_pago: number, body: Partial<MetodoPago>) {
    return this.http.put<{ message: string }>(`${this.base}/${id_metodo_pago}`, body);
  }

  eliminar(id_metodo_pago: number) {
    return this.http.delete<{ message: string }>(`${this.base}/${id_metodo_pago}`);
  }
}

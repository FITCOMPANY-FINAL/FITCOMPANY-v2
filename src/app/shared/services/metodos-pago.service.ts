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
}


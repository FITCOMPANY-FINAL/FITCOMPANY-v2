import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface Formulario {
  id_formulario: number;
  titulo_formulario: string;
  url_formulario?: string;
  padre_id?: number | null;
  is_padre?: boolean;
  orden_formulario?: number;
}

@Injectable({ providedIn: 'root' })
export class FormulariosService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/formularios`;

  listar(): Observable<Formulario[]> {
    return this.http.get<Formulario[]>(this.base);
  }
}


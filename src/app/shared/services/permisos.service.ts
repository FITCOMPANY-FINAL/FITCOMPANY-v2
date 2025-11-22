import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface Permiso {
  id_rol: number;
  nombre_rol: string;
  id_formulario: number;
  titulo_formulario: string;
  is_padre?: boolean;
  padre_id?: number | null;
}

export interface FormularioAsignado {
  id_formulario: number;
  titulo_formulario: string;
  url_formulario?: string;
  padre_id?: number | null;
  is_padre?: boolean;
  orden_formulario?: number;
}

@Injectable({ providedIn: 'root' })
export class PermisosService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/permisos`;

  /**
   * Lista todos los permisos (todos los roles con sus formularios asignados)
   */
  listarTodos(): Observable<Permiso[]> {
    return this.http.get<Permiso[]>(this.base);
  }

  /**
   * Obtiene todos los formularios asignados a un rol específico
   */
  obtenerPorRol(idRol: number): Observable<FormularioAsignado[]> {
    return this.http.get<FormularioAsignado[]>(`${this.base}/rol/${idRol}`);
  }

  /**
   * Asigna un formulario a un rol
   */
  asignar(body: { id_rol: number; id_formulario: number }): Observable<{ message: string; asignadoTambien?: string | null }> {
    return this.http.post<{ message: string; asignadoTambien?: string | null }>(this.base, body);
  }

  /**
   * Asigna múltiples formularios a un rol de una vez
   */
  asignarBulk(body: { id_rol: number; id_formularios: number[] }): Observable<{ message: string; asignados: number; yaExistian: number; padresAsignados: number }> {
    return this.http.post<{ message: string; asignados: number; yaExistian: number; padresAsignados: number }>(`${this.base}/bulk`, body);
  }

  /**
   * Quita un formulario de un rol
   */
  quitar(idRol: number, idFormulario: number): Observable<{ message: string; hijosEliminados?: number | null }> {
    return this.http.delete<{ message: string; hijosEliminados?: number | null }>(`${this.base}/rol/${idRol}/formulario/${idFormulario}`);
  }

  /**
   * Elimina TODOS los permisos de un rol
   */
  eliminarTodosDeRol(idRol: number): Observable<{ message: string; total: number }> {
    return this.http.delete<{ message: string; total: number }>(`${this.base}/rol/${idRol}`);
  }
}


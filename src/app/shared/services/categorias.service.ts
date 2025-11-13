import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Categoria } from '../models/categoria.model';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CategoriasService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/categorias`;

  listar(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(this.base);
  }

  crear(body: Partial<Categoria>) {
    return this.http.post<{ message: string }>(this.base, body);
  }

  actualizar(id_categoria: number, body: Partial<Categoria>) {
    return this.http.put<{ message: string }>(`${this.base}/${id_categoria}`, body);
  }

  eliminar(id_categoria: number) {
    return this.http.delete<{ message: string }>(`${this.base}/${id_categoria}`);
  }
}

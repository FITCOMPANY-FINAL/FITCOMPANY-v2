import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

type Rol = {
  id_rol: number;
  nombre_rol: string;
  descripcion_rol?: string | null;
  estado?: 'A' | 'I';
};

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './roles.html',
  styleUrl: './roles.scss'
})
export class Roles implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private API = environment.apiBaseUrl;

  // límites (como tu React)
  NOMBRE_MAX = 50;
  DESC_MAX   = 200;
  private PATRON = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;

  // estado UI
  loadingList = false;
  saving = false;
  okMsg = '';
  errorMsg = '';
  errorMsgInline = '';

  // datos
  rows: Rol[] = [];

  // edición
  editando = false;
  private editId: number | null = null;

  // confirm
  confirmOpen = false;
  private pendingDeleteId: number | null = null;

  // form
  form = this.fb.nonNullable.group({
    nombre_rol: ['', [Validators.required, Validators.maxLength(this.NOMBRE_MAX)]],
    descripcion_rol: ['', [Validators.maxLength(this.DESC_MAX)]],
  });

  ngOnInit(): void {
    this.loadData();
  }

  // mensajes
  private autoHide(ms = 4000) {
    window.setTimeout(() => { this.okMsg = ''; this.errorMsg = ''; this.errorMsgInline = ''; }, ms);
  }
  private showOk(m: string) { this.okMsg = m; this.errorMsg = ''; this.errorMsgInline=''; this.autoHide(); }
  private showError(m: string) { this.errorMsg = m; this.okMsg = ''; this.errorMsgInline=''; this.autoHide(); }
  private showInline(m: string) { this.errorMsgInline = m; this.errorMsg = ''; this.okMsg=''; this.autoHide(); }

  // util: canónico para proteger "administrador"
  private toCanonical(s: string) {
    return (s ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g, '').trim();
  }
  isProtected(r: Rol) {
    return this.toCanonical(r?.nombre_rol || '') === 'administrador';
  }

  // carga
  loadData() {
    this.loadingList = true;
    this.http.get<Rol[]>(`${this.API}/roles`).subscribe({
      next: (rows) => { 
        this.rows = rows || []; 
        this.loadingList = false; 
      },
      error: (e) => { 
        console.error('Error al cargar roles:', e);
        this.rows = []; 
        this.loadingList = false;
        this.showError('Error al cargar los roles.');
      }
    });
  }

  // submit
  submit() {
    if (this.saving) return;

    const nombre = (this.form.value.nombre_rol || '').trim().replace(/\s+/g, ' ');
    const desc   = (this.form.value.descripcion_rol || '').trim().replace(/\s+/g, ' ');

    if (!nombre) {
      this.showInline('El nombre es obligatorio.');
      return;
    }
    if (!this.PATRON.test(nombre)) {
      this.showInline('El nombre solo puede contener letras, espacios, guiones y puntos.');
      return;
    }
    if (nombre.length > this.NOMBRE_MAX) {
      this.showInline(`El nombre admite máximo ${this.NOMBRE_MAX} caracteres.`);
      return;
    }
    if (desc.length > this.DESC_MAX) {
      this.showInline(`La descripción admite máximo ${this.DESC_MAX} caracteres.`);
      return;
    }

    this.saving = true;
    this.errorMsgInline = ''; // Limpiar errores anteriores
    this.errorMsg = ''; // Limpiar errores generales

    const body = { nombre_rol: nombre, descripcion_rol: desc || '' };

    const req$ = (this.editando && this.editId != null)
      ? this.http.put<{ message?: string }>(`${this.API}/roles/${this.editId}`, body)
      : this.http.post<{ message?: string }>(`${this.API}/roles`, body);

    req$.subscribe({
      next: (res) => {
        this.saving = false;
        this.showOk(res?.message || (this.editando ? 'Rol actualizado.' : 'Rol creado.'));
        this.loadData();
        this.resetForm();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (e) => {
        this.saving = false; // Asegurar que se resetee el estado
        const errorMessage = e?.error?.message || 'Error al guardar el rol.';
        // Si es un error de validación, mostrarlo inline
        if (e?.status === 400 || e?.status === 409) {
          this.showInline(errorMessage);
        } else {
          this.showError(errorMessage);
        }
      }
    });
  }

  editar(r: Rol) {
    if (this.isProtected(r)) return;
    this.editando = true;
    this.editId = r.id_rol ?? null;

    this.form.patchValue({
      nombre_rol: r.nombre_rol ?? '',
      descripcion_rol: r.descripcion_rol ?? '',
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion() {
    this.resetForm();
  }

  confirmarEliminar(id: number) {
    this.pendingDeleteId = id ?? null;
    this.confirmOpen = true;
  }
  closeConfirm() {
    this.confirmOpen = false;
    this.pendingDeleteId = null;
  }
  doEliminarConfirmado() {
    if (this.pendingDeleteId == null) { this.closeConfirm(); return; }
    const id = this.pendingDeleteId;
    this.closeConfirm();

    // proteger si fuese "administrador"
    const r = this.rows.find(x => x.id_rol === id);
    if (r && this.isProtected(r)) return;

    this.http.delete<{ message?: string; code?: string; requiresDeactivation?: boolean; usuarios?: number }>(`${this.API}/roles/${id}`).subscribe({
      next: (res) => {
        this.showOk(res?.message || 'Rol eliminado correctamente.');
        this.loadData();
      },
      error: (e) => {
        // Manejo de 409 si el rol está en uso
        if (e?.status === 409) {
          const usuarios = Number(e.error.usuarios ?? 0);
          if (usuarios > 0) {
            this.showError(`No se puede eliminar el rol porque está siendo usado por ${usuarios} usuario(s).`);
          } else {
            this.showError(e?.error?.message || 'No se pudo eliminar el rol.');
          }
        } else {
          this.showError(e?.error?.message || 'No se pudo eliminar el rol.');
        }
        this.loadData();
      }
    });
  }

  // utils
  private resetForm() {
    this.editando = false;
    this.editId = null;
    this.form.reset({
      nombre_rol: '',
      descripcion_rol: ''
    });
  }
}

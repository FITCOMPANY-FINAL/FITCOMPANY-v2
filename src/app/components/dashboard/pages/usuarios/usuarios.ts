// src/app/components/dashboard/pages/usuarios/usuarios.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

type Usuario = {
  tipo_identificacion: string;     // texto
  identificacion: string;          // texto
  nombre: string;
  apellido1: string;
  apellido2?: string | null;
  correo: string;
  perfil_id: number;               // número
  perfil_rol: number;              // número
  contrasennia?: string | null;    // solo al crear / si cambia
  // opcionales para tabla
  rol_nombre?: string;
  perfil_nombre?: string;
};

type Rol    = { id_rol: number; nombre_rol: string };
type Perfil = { id: number; rol: number; nombre: string; nombre_rol?: string };
type TipoId = { id: string | number; descripcion: string };

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss'
})
export class Usuarios implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private API = 'http://localhost:3000/api';

  // --- datos tabla y combos ---
  rows: Usuario[] = [];
  roles: Rol[] = [];
  perfiles: Perfil[] = [];
  tiposId: TipoId[] = [];

  // --- UI state ---
  loadingList = false;
  saving = false;
  okMsg = '';
  errorMsg = '';
  errorMsgInline = '';

  // --- edición ---
  editando = false;
  private editingPK: { tipo: string; id: string } | null = null;

  // --- confirm delete ---
  confirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  private pendingDelete: { tipo: string; id: string } | null = null;

  // patrones (mismos que en React)
  private PATRON_NOMBRE = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;
  private PATRON_IDENT  = /^[A-Za-z0-9.\-]+$/;
  private PATRON_EMAIL  = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

  // --- form ---
  form = this.fb.nonNullable.group({
    tipo_identificacion: ['', [Validators.required]],
    identificacion:      ['', [Validators.required, Validators.pattern(this.PATRON_IDENT)]],
    nombre:              ['', [Validators.required, Validators.pattern(this.PATRON_NOMBRE)]],
    apellido1:           ['', [Validators.required, Validators.pattern(this.PATRON_NOMBRE)]],
    apellido2:           ['', [Validators.pattern(this.PATRON_NOMBRE)]],
    correo:              ['', [Validators.required, Validators.pattern(this.PATRON_EMAIL)]],
    contrasennia:        [''], // requerida solo cuando no se edita (se valida en submit)
    perfil_rol:          ['', [Validators.required]],
    perfil_id:           ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.loadCombos();
    this.loadData();
  }

  // ---------------- Mensajes ----------------
  private autoHide(ms = 4000) {
    window.setTimeout(() => { this.okMsg = ''; this.errorMsg = ''; this.errorMsgInline = ''; }, ms);
  }
  private showOk(m: string)     { this.okMsg = m; this.errorMsg = ''; this.errorMsgInline = ''; this.autoHide(); }
  private showError(m: string)  { this.errorMsg = m; this.okMsg = ''; this.errorMsgInline = ''; this.autoHide(); }
  private showInline(m: string) { this.errorMsgInline = m; this.okMsg = ''; this.errorMsg = ''; this.autoHide(); }

  // ---------------- Cargas ----------------
  loadCombos() {
    this.http.get<Rol[]>(`${this.API}/roles`).subscribe({
      next: (rows) => this.roles = rows || [],
      error: () => this.roles = []
    });
    this.http.get<Perfil[]>(`${this.API}/perfiles`).subscribe({
      next: (rows) => this.perfiles = rows || [],
      error: () => this.perfiles = []
    });
    this.http.get<TipoId[]>(`${this.API}/tipos-identificacion`).subscribe({
      next: (rows) => this.tiposId = rows || [],
      error: () => this.tiposId = []
    });
  }

  loadData() {
    this.loadingList = true;
    this.http.get<Usuario[]>(`${this.API}/usuarios`).subscribe({
      next: (rows) => { this.rows = rows || []; this.loadingList = false; },
      error: () => { this.rows = []; this.loadingList = false; }
    });
  }

  // ---------------- Helpers ----------------
  private S(v: unknown) { return String(v ?? '').trim(); }

  // ---------------- CRUD ----------------
  submit() {
    if (this.saving) return;

    // espejo de validaciones de React
    const f = {
      tipo_identificacion: this.S(this.form.value.tipo_identificacion),
      identificacion:      this.S(this.form.value.identificacion),
      nombre:              this.S(this.form.value.nombre).replace(/\s+/g, ' '),
      apellido1:           this.S(this.form.value.apellido1).replace(/\s+/g, ' '),
      apellido2:           this.S(this.form.value.apellido2).replace(/\s+/g, ' '),
      correo:              this.S(this.form.value.correo).toLowerCase(),
      contrasennia:        this.form.value.contrasennia ?? '',
      perfil_id:           Number(this.form.value.perfil_id),
      perfil_rol:          Number(this.form.value.perfil_rol),
    };

    // validaciones adicionales
    if (!f.tipo_identificacion) return this.showInline('El tipo de identificación es obligatorio.');
    if (!f.identificacion)      return this.showInline('La identificación es obligatoria.');
    if (!this.PATRON_IDENT.test(f.identificacion)) return this.showInline('La identificación solo admite letras, números, puntos o guiones.');
    if (!f.nombre || !this.PATRON_NOMBRE.test(f.nombre)) return this.showInline('El nombre solo puede contener letras, espacios, guiones y puntos.');
    if (!f.apellido1 || !this.PATRON_NOMBRE.test(f.apellido1)) return this.showInline('El apellido 1 solo puede contener letras, espacios, guiones y puntos.');
    if (f.apellido2 && !this.PATRON_NOMBRE.test(f.apellido2)) return this.showInline('El apellido 2 solo puede contener letras, espacios, guiones y puntos.');
    if (!f.correo || !this.PATRON_EMAIL.test(f.correo)) return this.showInline('Formato de correo inválido.');
    if (!this.editando && (!f.contrasennia || String(f.contrasennia).length < 3))
      return this.showInline('La contraseña debe tener al menos 3 caracteres.');
    if (!f.perfil_rol) return this.showInline('Debes seleccionar un rol.');
    if (!f.perfil_id)  return this.showInline('Debes seleccionar un perfil.');

    // listo para enviar
    this.saving = true;
    this.okMsg = this.errorMsg = this.errorMsgInline = '';

    const body: any = {
      tipo_identificacion: f.tipo_identificacion,
      identificacion: f.identificacion,
      nombre: f.nombre,
      apellido1: f.apellido1,
      apellido2: f.apellido2 || undefined,
      correo: f.correo,
      perfil_id: f.perfil_id,
      perfil_rol: f.perfil_rol,
      // contraseña solo si crea o si la diligenció en edición
      ...(this.editando ? (f.contrasennia ? { contrasennia: f.contrasennia } : {}) : { contrasennia: f.contrasennia }),
    };

    const req$ = this.editando && this.editingPK
      ? this.http.put<{ message?: string }>(
          `${this.API}/usuarios/${encodeURIComponent(this.editingPK.tipo)}/${encodeURIComponent(this.editingPK.id)}`,
          body
        )
      : this.http.post<{ message?: string }>(`${this.API}/usuarios`, body);

    req$.pipe(finalize(() => this.saving = false)).subscribe({
      next: (res) => {
        this.showOk(res?.message || (this.editando ? 'Usuario actualizado.' : 'Usuario creado.'));
        this.loadData();
        this.resetForm();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (e) => {
        this.showError(e?.error?.message || 'Error al guardar el usuario.');
      }
    });
  }

  editar(u: Usuario) {
    this.editando = true;
    this.editingPK = { tipo: String(u.tipo_identificacion), id: String(u.identificacion) };

    this.form.patchValue({
      tipo_identificacion: String(u.tipo_identificacion ?? ''),
      identificacion: String(u.identificacion ?? ''),
      nombre: u.nombre ?? '',
      apellido1: u.apellido1 ?? '',
      apellido2: u.apellido2 ?? '',
      correo: u.correo ?? '',
      contrasennia: '', // en edición se deja vacío (solo se envía si lo escribe)
      perfil_rol: String(u.perfil_rol ?? ''),
      perfil_id: String(u.perfil_id ?? ''),
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion() {
    this.resetForm();
  }

  confirmarEliminar(u: Usuario) {
    this.pendingDelete = { tipo: String(u.tipo_identificacion), id: String(u.identificacion) };
    this.confirmTitle = 'Confirmar eliminación';
    this.confirmMessage = `¿Seguro que deseas eliminar al usuario ${u.nombre} ${u.apellido1}?`;
    this.confirmOpen = true;
  }

  closeConfirm() {
    this.confirmOpen = false;
    this.confirmTitle = this.confirmMessage = '';
  }

  doEliminarConfirmado() {
    const pk = this.pendingDelete;
    this.pendingDelete = null;
    this.closeConfirm();
    if (!pk) return;

    this.http.delete<{ message?: string }>(`${this.API}/usuarios/${encodeURIComponent(pk.tipo)}/${encodeURIComponent(pk.id)}`)
      .subscribe({
        next: (res) => { this.showOk(res?.message || 'Usuario eliminado.'); this.loadData(); },
        error: (e)  => { this.showError(e?.error?.message || 'No se pudo eliminar el usuario.'); }
      });
  }

  // ---------------- utils ----------------
  private resetForm() {
    this.editando = false;
    this.editingPK = null;
    this.form.reset({
      tipo_identificacion: '',
      identificacion: '',
      nombre: '',
      apellido1: '',
      apellido2: '',
      correo: '',
      contrasennia: '',
      perfil_id: '',
      perfil_rol: '',
    });
  }
}

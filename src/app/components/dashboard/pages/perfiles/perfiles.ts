import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface Rol {
  id_rol: number;
  nombre_rol: string;
}

interface Perfil {
  id: number;
  nombre: string;
  descripcion?: string | null;
  rol: number;           // id de rol
  nombre_rol?: string;   // nombre del rol (si el back lo trae)
}

@Component({
  selector: 'app-perfiles',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './perfiles.html',
  styleUrl: './perfiles.scss'
})
export class Perfiles implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  private API = 'http://localhost:3000/api';

  rows: Perfil[] = [];
  roles: Rol[] = [];

  loadingList = false;
  saving = false;

  okMsg = '';
  errorMsg = '';
  errorMsgInline = '';

  // edición
  editando = false;
  private editId: number | null = null;
  private editRolId: number | null = null;

  // modal confirm
  confirmOpen = false;
  private pendingDelete: { id: number; rol: number } | null = null;

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    descripcion: ['', [Validators.maxLength(255)]],
    rol: ['', [Validators.required]]
  });

  ngOnInit(): void {
    this.loadRoles();
    this.loadData();
  }

  // helpers de mensajes 4s
  private autoHide(ms = 4000) {
    window.setTimeout(() => {
      this.okMsg = '';
      this.errorMsg = '';
      this.errorMsgInline = '';
    }, ms);
  }
  private showOk(m: string) { this.okMsg = m; this.errorMsg = ''; this.errorMsgInline = ''; this.autoHide(); }
  private showError(m: string) { this.errorMsg = m; this.okMsg = ''; this.errorMsgInline = ''; this.autoHide(); }
  private showInline(m: string) { this.errorMsgInline = m; this.okMsg = ''; this.errorMsg = ''; this.autoHide(); }

  // canonicalización p/ proteger "Administrador Supremo"
  private toCanonical(s?: string | null) {
    return (s ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }
  isProtected(p: Perfil) {
    return this.toCanonical(p?.nombre) === 'administrador supremo';
  }

  loadRoles() {
    this.http.get<Rol[]>(`${this.API}/roles`).subscribe({
      next: (rows) => this.roles = rows || [],
      error: () => this.roles = []
    });
  }

  loadData() {
    this.loadingList = true;
    this.http.get<Perfil[]>(`${this.API}/perfiles`).subscribe({
      next: (rows) => { this.rows = rows || []; this.loadingList = false; },
      error: () => { this.rows = []; this.loadingList = false; this.showError('Error cargando perfiles.'); }
    });
  }

  submit() {
    if (this.saving) return;

    // sanitizar/validar como en React
    const rawNombre = (this.form.value.nombre || '').trim().replace(/\s+/g, ' ');
    const rawDesc = (this.form.value.descripcion || '').trim().replace(/\s+/g, ' ');
    const rolVal = this.form.value.rol;

    if (!rawNombre) return this.showInline('El nombre es obligatorio.');
    // Solo letras y espacios (con acentos)
    const SOLO_LETRAS = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;
    if (!SOLO_LETRAS.test(rawNombre)) return this.showInline('El nombre del perfil solo debe contener letras y espacios.');
    if (rawNombre.length > 100) return this.showInline('El nombre admite máximo 100 caracteres.');

    if (!rolVal) return this.showInline('Debes seleccionar un rol.');
    const rolNum = Number(rolVal);
    if (!Number.isInteger(rolNum) || rolNum <= 0) return this.showInline('Rol inválido.');

    if (rawDesc.length > 255) return this.showInline('La descripción admite máximo 255 caracteres.');

    this.saving = true;
    this.okMsg = '';
    this.errorMsg = '';
    this.errorMsgInline = '';

    const body = {
      nombre: rawNombre,
      descripcion: rawDesc,
      rol: rolNum
    };

    const req$ = this.editando && this.editId != null && this.editRolId != null
      ? this.http.put<{ message?: string }>(`${this.API}/perfiles/${this.editId}/${this.editRolId}`, body)
      : this.http.post<{ message?: string }>(`${this.API}/perfiles`, body);

    req$.subscribe({
      next: (res) => {
        this.showOk(res?.message || (this.editando ? 'Perfil actualizado.' : 'Perfil creado.'));
        this.loadData();
        this.resetForm();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (e) => {
        this.saving = false;
        // si el back trae mensaje de duplicado/validación, lo mostramos
        this.showError(e?.error?.message || 'Error al guardar el perfil.');
      },
      complete: () => {
        this.saving = false;
      }
    });
  }

  editar(p: Perfil) {
    if (this.isProtected(p)) return; // extra guard
    this.editando = true;
    this.editId = p.id ?? null;
    this.editRolId = p.rol ?? null;

    this.form.patchValue({
      nombre: p.nombre ?? '',
      descripcion: p.descripcion ?? '',
      rol: String(p.rol ?? '')
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion() {
    this.resetForm();
  }

  confirmarEliminar(p: Perfil) {
    if (this.isProtected(p)) return;
    this.pendingDelete = { id: p.id, rol: p.rol };
    this.confirmOpen = true;
  }

  closeConfirm() {
    this.confirmOpen = false;
    this.pendingDelete = null;
  }

  doEliminarConfirmado() {
    if (!this.pendingDelete) { this.closeConfirm(); return; }
    const { id, rol } = this.pendingDelete;
    this.closeConfirm();

    this.http.delete<{ message?: string; code?: string; requiresUpdateRelations?: boolean }>(
      `${this.API}/perfiles/${id}/${rol}`
    ).subscribe({
      next: (res) => {
        this.showOk(res?.message || 'Perfil eliminado.');
        this.loadData();
      },
      error: (e) => {
        // Manejo de 409 protegidos / en uso (igual filosofía React)
        if (e?.status === 409) {
          const code = e?.error?.code;
          const msg = e?.error?.message;
          if (code === 'PROFILE_PROTECTED') return this.showError(msg || 'Este perfil está protegido y no se puede eliminar.');
          if (code === 'PROFILE_IN_USE') return this.showError(msg || 'No se puede eliminar: el perfil está en uso.');
        }
        this.showError(e?.error?.message || 'Error al eliminar el perfil.');
      }
    });
  }

  // utils
  private resetForm() {
    this.editando = false;
    this.editId = null;
    this.editRolId = null;
    this.form.reset({ nombre: '', descripcion: '', rol: '' });
  }
}

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

type SN = 'S' | 'N';

interface PerfilAPI {
  id: number;
  nombre: string;
  descripcion?: string | null;
  rol: number;
}
interface PerfilView extends PerfilAPI {
  _json: string; // JSON.stringify({ id_perfil: id, perfil_rol: rol })
}

interface FormularioAPI {
  CODIGO_FORMULARIO: number;
  TITULO_FORMULARIO?: string;
}

interface PermisoAsignadoAPI {
  ID_PERFIL: number;
  PERFIL_ROL: number;
  CODIGO_FORMULARIO: number;
  TITULO_FORMULARIO?: string;
  PUEDE_CREAR: SN;
  PUEDE_LEER: SN;
  PUEDE_ACTUALIZAR: SN;
  PUEDE_ELIMINAR: SN;
}

@Component({
  selector: 'app-permisos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './permisos.html',
  styleUrl: './permisos.scss'
})
export class Permisos implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  private API = 'http://localhost:3000/api';

  // UI state
  okMsg = '';
  errorMsg = '';
  errorMsgInline = '';
  saving = false;
  loadingList = false;

  // Data
  perfiles: PerfilView[] = [];
  formularios: FormularioAPI[] = [];
  permisosAsignados: PermisoAsignadoAPI[] = [];

  form = this.fb.nonNullable.group({
    perfilJson: ['', [Validators.required]],       // JSON con {id_perfil, perfil_rol}
    codigoFormulario: ['', [Validators.required]], // number en string
    puedeCrear: ['N' as SN],
    puedeLeer: ['N' as SN],
    puedeActualizar: ['N' as SN],
    puedeEliminar: ['N' as SN],
  });

  ngOnInit(): void {
    this.loadPerfiles();
    this.loadFormularios();
    this.loadPermisosAsignados();
  }

  // Helpers de mensajes (4s)
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

  // Cargas
  loadPerfiles() {
    this.http.get<PerfilAPI[]>(`${this.API}/perfiles`).subscribe({
      next: (rows) => {
        this.perfiles = (rows || []).map(p => ({
          ...p,
          _json: JSON.stringify({ id_perfil: p.id, perfil_rol: p.rol })
        }));
      },
      error: () => this.perfiles = []
    });
  }

  loadFormularios() {
    this.http.get<FormularioAPI[]>(`${this.API}/formularios`).subscribe({
      next: (rows) => this.formularios = rows || [],
      error: () => this.formularios = []
    });
  }

  loadPermisosAsignados() {
    this.loadingList = true;
    this.http.get<PermisoAsignadoAPI[]>(`${this.API}/permisos`).subscribe({
      next: (rows) => { this.permisosAsignados = rows || []; this.loadingList = false; },
      error: () => { this.permisosAsignados = []; this.loadingList = false; }
    });
  }

  // Toggle checkboxes S/N
  toggle(ctrl: 'puedeCrear' | 'puedeLeer' | 'puedeActualizar' | 'puedeEliminar', ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    this.form.controls[ctrl].setValue(checked ? 'S' : 'N');
  }

  submit() {
    if (this.saving) return;

    // Validaciones explícitas (como en React)
    const perfilJson = this.form.value.perfilJson || '';
    const codigoFormulario = this.form.value.codigoFormulario || '';

    if (!perfilJson) return this.showInline('Debes seleccionar un perfil.');
    if (!codigoFormulario) return this.showInline('Debes seleccionar un formulario.');

    let perfilParsed: { id_perfil: number; perfil_rol: number } | null = null;
    try {
      perfilParsed = JSON.parse(perfilJson);
    } catch {
      return this.showInline('Perfil inválido.');
    }

    const idPerfil = Number(perfilParsed?.id_perfil);
    const perfilRol = Number(perfilParsed?.perfil_rol);
    const codForm = Number(codigoFormulario);

    if (!Number.isInteger(idPerfil) || idPerfil <= 0) return this.showInline('Perfil inválido.');
    if (!Number.isInteger(perfilRol) || perfilRol <= 0) return this.showInline('Rol de perfil inválido.');
    if (!Number.isInteger(codForm) || codForm <= 0) return this.showInline('Formulario inválido.');

    const body = {
      idPerfil,
      perfilRol,
      permisos: [
        {
          codigoFormulario: codForm,
          puedeCrear: this.form.value.puedeCrear as SN,
          puedeLeer: this.form.value.puedeLeer as SN,
          puedeActualizar: this.form.value.puedeActualizar as SN,
          puedeEliminar: this.form.value.puedeEliminar as SN
        }
      ]
    };

    this.saving = true;
    this.okMsg = '';
    this.errorMsg = '';
    this.errorMsgInline = '';

    this.http.post<{ message?: string }>(`${this.API}/permisos`, body).subscribe({
      next: (res) => {
        this.showOk(res?.message || 'Permiso asignado correctamente');
        this.loadPermisosAsignados();
        this.resetForm();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: async (e) => {
        this.showError(e?.error?.message || 'Error al asignar permiso');
      },
      complete: () => {
        this.saving = false;
      }
    });
  }

  private resetForm() {
    this.form.reset({
      perfilJson: '',
      codigoFormulario: '',
      puedeCrear: 'N',
      puedeLeer: 'N',
      puedeActualizar: 'N',
      puedeEliminar: 'N'
    });
  }
}

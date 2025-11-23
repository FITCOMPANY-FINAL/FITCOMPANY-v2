import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { PermisosService, Permiso } from '../../../../shared/services/permisos.service';
import { FormulariosService, Formulario } from '../../../../shared/services/formularios.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

interface Rol {
  id_rol: number;
  nombre_rol: string;
  descripcion_rol?: string | null;
  estado?: 'A' | 'I';
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
  private permisosSrv = inject(PermisosService);
  private formulariosSrv = inject(FormulariosService);
  private http = inject(HttpClient);
  private API = environment.apiBaseUrl;

  // UI state
  okMsg = '';
  errorMsg = '';
  errorMsgInline = '';
  saving = false;
  loadingList = false;
  loadingFormularios = false;

  // Data
  roles: Rol[] = [];
  formularios: Formulario[] = [];
  permisosAsignados: Permiso[] = [];

  // Para asignación bulk
  formulariosSeleccionados: Set<number> = new Set();
  
  // Agrupar formularios por padre
  get formulariosAgrupados() {
    const padres = this.formularios.filter(f => f.is_padre);
    const hijos = this.formularios.filter(f => f.padre_id);
    const independientes = this.formularios.filter(f => !f.is_padre && !f.padre_id);
    
    return {
      padres: padres.map(p => ({
        ...p,
        hijos: hijos.filter(h => h.padre_id === p.id_formulario)
      })),
      independientes
    };
  }

  // Confirmación de eliminación
  confirmOpen = false;
  pendingDelete: { idRol: number; idFormulario: number } | null = null;

  form = this.fb.nonNullable.group({
    id_rol: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.loadRoles();
    this.loadFormularios();
    this.loadPermisosAsignados();
  }

  // ---------- Mensajes ----------
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

  // ---------- Cargas ----------
  loadRoles() {
    this.http.get<Rol[]>(`${this.API}/roles`).subscribe({
      next: (rows) => this.roles = (rows || []).filter(r => r.estado === 'A' || !r.estado), // Solo roles activos
      error: () => this.roles = []
    });
  }

  loadFormularios() {
    this.loadingFormularios = true;
    this.formulariosSrv.listar().subscribe({
      next: (rows) => {
        this.formularios = rows || [];
        this.loadingFormularios = false;
        console.log('✅ Formularios cargados:', this.formularios.length, rows);
        if (this.formularios.length === 0) {
          this.showError('⚠️ No hay formularios en la base de datos. Es necesario ejecutar el script SQL de inserción de formularios.');
        }
      },
      error: (e) => {
        console.error('❌ Error al cargar formularios:', e);
        this.formularios = [];
        this.loadingFormularios = false;
        this.showError('❌ Error al cargar los formularios. Verifica que el backend esté funcionando y que exista la tabla "formularios" en la base de datos.');
      }
    });
  }

  loadPermisosAsignados() {
    this.loadingList = true;
    this.permisosSrv.listarTodos().subscribe({
      next: (rows) => {
        this.permisosAsignados = rows || [];
        this.loadingList = false;
      },
      error: () => {
        this.permisosAsignados = [];
        this.loadingList = false;
      }
    });
  }

  // ---------- Helpers ----------
  getNombreRol(idRol: number): string {
    const rol = this.roles.find(r => r.id_rol === idRol);
    return rol?.nombre_rol || `Rol #${idRol}`;
  }

  getNombreFormulario(idFormulario: number): string {
    const form = this.formularios.find(f => f.id_formulario === idFormulario);
    return form?.titulo_formulario || `Formulario #${idFormulario}`;
  }

  tienePermiso(idRol: number, idFormulario: number): boolean {
    return this.permisosAsignados.some(
      p => p.id_rol === idRol && p.id_formulario === idFormulario
    );
  }

  // Helper para convertir string a number en templates
  toNumber(value: any): number {
    return Number(value) || 0;
  }

  getPermisosPorRol(idRol: number): Permiso[] {
    return this.permisosAsignados.filter(p => p.id_rol === idRol);
  }

  // ---------- Asignación de permisos ----------
  toggleFormularioBulk(idFormulario: number) {
    if (this.formulariosSeleccionados.has(idFormulario)) {
      this.formulariosSeleccionados.delete(idFormulario);
    } else {
      this.formulariosSeleccionados.add(idFormulario);
    }
  }

  estaSeleccionadoBulk(idFormulario: number): boolean {
    return this.formulariosSeleccionados.has(idFormulario);
  }

  submitBulk() {
    if (this.saving) return;

    const idRol = Number(this.form.value.id_rol);
    if (!idRol || idRol <= 0) {
      return this.showInline('Debes seleccionar un rol.');
    }

    if (this.formulariosSeleccionados.size === 0) {
      return this.showInline('Debes seleccionar al menos un formulario.');
    }

    // Validar que no se hayan seleccionado solo padres sin hijos
    const formulariosSeleccionadosArray = Array.from(this.formulariosSeleccionados);
    const padresSeleccionados = formulariosSeleccionadosArray.filter(id => {
      const form = this.formularios.find(f => f.id_formulario === id);
      return form?.is_padre;
    });

    if (padresSeleccionados.length > 0) {
      const nombresPadres = padresSeleccionados.map(id => {
        const form = this.formularios.find(f => f.id_formulario === id);
        return form?.titulo_formulario || `ID ${id}`;
      }).join(', ');
      return this.showInline(`No puedes asignar solo formularios padre (${nombresPadres}). Debes seleccionar al menos un formulario hijo de cada padre.`);
    }

    const idFormularios = formulariosSeleccionadosArray;

    this.saving = true;
    this.okMsg = '';
    this.errorMsg = '';
    this.errorMsgInline = '';

    this.permisosSrv.asignarBulk({ id_rol: idRol, id_formularios: idFormularios })
      .pipe(finalize(() => { this.saving = false; }))
      .subscribe({
        next: (res) => {
          const mensaje = `${res?.message || 'Permisos asignados correctamente.'} ` +
            `(Asignados: ${res?.asignados || 0}, Ya existían: ${res?.yaExistian || 0}, ` +
            `Padres asignados automáticamente: ${res?.padresAsignados || 0})`;
          this.showOk(mensaje);
          this.loadPermisosAsignados();
          this.formulariosSeleccionados.clear();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: (e) => {
          this.showError(e?.error?.message || 'Error al asignar permisos.');
        }
      });
  }

  // ---------- Eliminación ----------
  confirmarEliminar(idRol: number, idFormulario: number) {
    this.pendingDelete = { idRol, idFormulario };
    this.confirmOpen = true;
  }

  closeConfirm() {
    this.confirmOpen = false;
    this.pendingDelete = null;
  }

  doEliminarConfirmado() {
    if (!this.pendingDelete) {
      this.closeConfirm();
      return;
    }

    const { idRol, idFormulario } = this.pendingDelete;
    this.closeConfirm();

    this.permisosSrv.quitar(idRol, idFormulario).subscribe({
      next: (res) => {
        let mensaje = res?.message || 'Permiso eliminado correctamente.';
        if (res?.hijosEliminados && res.hijosEliminados > 0) {
          mensaje += ` (Se eliminaron ${res.hijosEliminados} formularios hijos automáticamente)`;
        }
        this.showOk(mensaje);
        this.loadPermisosAsignados();
      },
      error: (e) => {
        this.showError(e?.error?.message || 'Error al eliminar permiso.');
      }
    });
  }

  eliminarTodosDeRol(idRol: number) {
    if (!confirm(`¿Estás seguro de eliminar TODOS los permisos del rol "${this.getNombreRol(idRol)}"?`)) {
      return;
    }

    this.permisosSrv.eliminarTodosDeRol(idRol).subscribe({
      next: (res) => {
        this.showOk(res?.message || `Se eliminaron ${res?.total || 0} permisos.`);
        this.loadPermisosAsignados();
      },
      error: (e) => {
        this.showError(e?.error?.message || 'Error al eliminar permisos.');
      }
    });
  }

  // ---------- Reset ----------
  private resetForm() {
    this.form.reset({
      id_rol: '',
    });
    this.formulariosSeleccionados.clear();
  }
}

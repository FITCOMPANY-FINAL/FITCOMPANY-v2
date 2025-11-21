import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

type TipoId = { 
  id: number; 
  nombre: string;
  abreviatura?: string | null;
  descripcion?: string | null;
  estado: 'A' | 'I' 
};

@Component({
  selector: 'app-tipos-identificaciones',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './tipos-identificaciones.html',
  styleUrl: './tipos-identificaciones.scss'
})
export class TiposIdentificaciones implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private API = environment.apiBaseUrl;

  // límites y patrón (igual a tu React)
  NOMBRE_MAX = 50;
  ABREV_MAX = 10;
  DESC_MAX = 200;
  private PATRON = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;

  // estado UI
  loadingList = false;
  saving = false;
  okMsg = '';
  errorMsg = '';
  errorMsgInline = '';
  descError = '';

  // datos
  tipos: TipoId[] = [];

  // edición
  editando = false;
  private editRow: TipoId | null = null;

  // confirm modal
  confirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  private confirmHandler: (() => void) | null = null;

  // form
  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(this.NOMBRE_MAX)]],
    abreviatura: ['', [Validators.maxLength(this.ABREV_MAX)]],
    descripcion: ['', [Validators.maxLength(this.DESC_MAX)]],
  });

  ngOnInit(): void {
    this.loadData();
  }

  // mensajes
  private autoHide(ms = 4000) {
    window.setTimeout(() => { this.okMsg = ''; this.errorMsg = ''; this.errorMsgInline = ''; }, ms);
  }
  private showOk(m: string) { this.okMsg = m; this.errorMsg = ''; this.errorMsgInline = ''; this.autoHide(); }
  private showError(m: string) { this.errorMsg = m; this.okMsg = ''; this.errorMsgInline = ''; this.autoHide(); }
  private showInline(m: string) { this.errorMsgInline = m; this.okMsg = ''; this.errorMsg = ''; this.autoHide(); }

  // canon para comparar duplicados bloqueando solo cuando la API lo confirma
  private canon(s: string) {
    return (s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim().replace(/\s+/g, ' ');
  }

  // input recorte suave
  onNombreInput(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const rec = el.value.slice(0, this.NOMBRE_MAX);
    if (el.value !== rec) {
      el.value = rec;
      this.form.controls.nombre.setValue(rec, { emitEvent: false });
    }
    if (this.descError) this.descError = '';
  }
  
  onAbreviaturaInput(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const rec = el.value.slice(0, this.ABREV_MAX);
    if (el.value !== rec) {
      el.value = rec;
      this.form.controls.abreviatura.setValue(rec, { emitEvent: false });
    }
  }
  
  onDescripcionInput(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const rec = el.value.slice(0, this.DESC_MAX);
    if (el.value !== rec) {
      el.value = rec;
      this.form.controls.descripcion.setValue(rec, { emitEvent: false });
    }
  }

  loadData() {
    this.loadingList = true;
    // El backend ahora devuelve todos los tipos con su estado 'activo' mapeado a 'estado'
    this.http.get<TipoId[]>(`${this.API}/tipos-identificacion`).subscribe({
      next: (rows) => { 
        this.tipos = rows || []; 
        this.loadingList = false; 
      },
      error: (e) => { 
        console.error('Error al cargar tipos:', e);
        this.tipos = []; 
        this.loadingList = false;
        this.showError('Error al cargar los tipos de identificación.');
      }
    });
  }

  async checkDuplicado() {
    const val = (this.form.value.nombre || '').trim();
    if (!val) { 
      this.descError = 'Ingresa un tipo de identificación'; 
      return; 
    }
    if (!this.PATRON.test(val)) { 
      this.descError = 'Solo letras, espacios, guiones y puntos.'; 
      return; 
    }

    try {
      // El backend acepta tanto 'nombre' como 'descripcion' en el query
      let params = new HttpParams().set('nombre', val);
      if (this.editando && this.editRow?.id) {
        params = params.set('excludeId', String(this.editRow.id));
      }
      const res: any = await this.http.get(`${this.API}/tipos-identificacion/exists`, { params }).toPromise();
      if (res?.exists) {
        this.descError = 'Ya existe un tipo de identificación con ese nombre.';
      } else {
        this.descError = '';
      }
    } catch {
      // si falla el prechequeo, no bloqueamos
      this.descError = '';
    }
  }

  submit() {
    if (this.saving) return;

    const nombre = (this.form.value.nombre || '').trim().replace(/\s+/g, ' ');
    const abreviatura = (this.form.value.abreviatura || '').trim().replace(/\s+/g, ' ');
    const descripcion = (this.form.value.descripcion || '').trim().replace(/\s+/g, ' ');
    
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
    if (abreviatura && abreviatura.length > this.ABREV_MAX) {
      this.showInline(`La abreviatura admite máximo ${this.ABREV_MAX} caracteres.`);
      return;
    }
    if (descripcion && descripcion.length > this.DESC_MAX) {
      this.showInline(`La descripción admite máximo ${this.DESC_MAX} caracteres.`);
      return;
    }
    if (this.descError) {
      this.showInline(this.descError);
      return; // duplicado detectado
    }

    this.saving = true;
    this.errorMsgInline = ''; // Limpiar errores anteriores
    this.errorMsg = ''; // Limpiar errores generales

    const body = { 
      nombre,
      abreviatura: abreviatura || undefined,
      descripcion: descripcion || undefined
    };
    const req$ = (this.editando && this.editRow?.id)
      ? this.http.put<{message?: string}>(`${this.API}/tipos-identificacion/${this.editRow.id}`, body)
      : this.http.post<{message?: string}>(`${this.API}/tipos-identificacion`, body);

    req$.subscribe({
      next: (res) => {
        this.saving = false;
        this.showOk(res?.message || (this.editando ? 'Tipo actualizado' : 'Tipo agregado'));
        this.loadData();
        this.resetForm();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (e) => {
        this.saving = false; // Asegurar que se resetee el estado
        const errorMessage = e?.error?.message || 'Error al guardar.';
        // Si es un error de validación, mostrarlo inline
        if (e?.status === 400 || e?.status === 409) {
          this.showInline(errorMessage);
        } else {
          this.showError(errorMessage);
        }
      }
    });
  }

  editar(row: TipoId) {
    this.editando = true;
    this.editRow = row;
    this.form.patchValue({ 
      nombre: row.nombre ?? '',
      abreviatura: row.abreviatura ?? '',
      descripcion: row.descripcion ?? ''
    });
    this.descError = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion() {
    this.resetForm();
  }

  confirmarEliminar(row: TipoId) {
    // En tu React: si 409 y requiresDeactivation → ofrecer desactivar
    // Aquí abrimos confirm para ELIMINAR. Si la API responde 409,
    // abriremos otro confirm para DESACTIVAR.
    this.confirmTitle = 'Confirmar eliminación';
    this.confirmMessage = `¿Seguro que deseas eliminar "${row.nombre}"?\nEsta acción no se puede deshacer.`;
    this.confirmHandler = () => this.eliminar(row);
    this.confirmOpen = true;
  }

  confirmarActivar(row: TipoId) {
    this.confirmTitle = 'Confirmar activación';
    this.confirmMessage = `Este tipo está inactivo.\n¿Deseas ACTIVAR "${row.descripcion}"?`;
    this.confirmHandler = () => this.activar(row.id);
    this.confirmOpen = true;
  }

  closeConfirm() {
    this.confirmOpen = false;
    this.confirmTitle = '';
    this.confirmMessage = '';
    this.confirmHandler = null;
  }
  doConfirm() {
    const fn = this.confirmHandler;
    this.closeConfirm();
    fn && fn();
  }

  private eliminar(row: TipoId) {
    this.http.delete<{message?: string; code?: string; requiresDeactivation?: boolean; usuarios?: number; ventas?: number}>
      (`${this.API}/tipos-identificacion/${row.id}`)
      .subscribe({
        next: (res) => {
          this.showOk(res?.message || 'Eliminado correctamente');
          this.loadData();
        },
        error: (e) => {
          if (e?.status === 409 && e?.error?.requiresDeactivation) {
            const usuarios = Number(e.error.usuarios ?? 0);
            const ventas = Number(e.error.ventas ?? 0);
            const partes: string[] = [];
            if (usuarios > 0) partes.push(`${usuarios} usuario(s)`);
            if (ventas > 0) partes.push(`${ventas} venta(s)`);
            const detalle = partes.join(' y ') || 'registros relacionados';

            // Ofrecer desactivar (aunque el backend no tiene endpoint de desactivar aún)
            this.confirmTitle = 'No se puede eliminar';
            this.confirmMessage =
              `Este tipo está en uso por ${detalle}.\n\nNo se puede eliminar porque está siendo utilizado.`;
            this.confirmHandler = null; // Por ahora no hay endpoint de desactivar
            this.confirmOpen = true;
            return;
          }
          this.showError(e?.error?.message || 'Operación no permitida.');
          this.loadData();
        }
      });
  }

  private desactivar(id: number) {
    // Por ahora el backend no tiene endpoint de desactivar/activar
    // Esto se puede implementar después si es necesario
    this.http.patch<{message?: string}>(`${this.API}/tipos-identificacion/${id}/desactivar`, {})
      .subscribe({
        next: (res) => {
          this.showOk(res?.message || 'Desactivado correctamente');
          this.loadData();
        },
        error: (e) => {
          this.showError(e?.error?.message || 'No se pudo desactivar.');
        }
      });
  }

  private activar(id: number) {
    // Por ahora el backend no tiene endpoint de activar
    // Esto se puede implementar después si es necesario
    this.http.patch<{message?: string}>(`${this.API}/tipos-identificacion/${id}/activar`, {})
      .subscribe({
        next: (res) => {
          this.showOk(res?.message || 'Activado correctamente');
          this.loadData();
        },
        error: (e) => {
          this.showError(e?.error?.message || 'No se pudo activar.');
        }
      });
  }

  // utils
  private resetForm() {
    this.editando = false;
    this.editRow = null;
    this.form.reset({ 
      nombre: '',
      abreviatura: '',
      descripcion: ''
    });
    this.descError = '';
  }
}

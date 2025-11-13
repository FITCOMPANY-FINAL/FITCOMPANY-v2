import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

type Unidad = {
  codigo_unidad_medida: number;
  nombre_unidad_medida: string;
  descripcion_unidad_medida?: string;
};

@Component({
  selector: 'app-unidades-medidas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './unidades-medidas.html',
  styleUrl: './unidades-medidas.scss'
})
export class UnidadesMedidas implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private API = 'http://localhost:3000/api';

  // límites / patrón como en tu React
  NOMBRE_MAX = 100;
  DESC_MAX   = 150;
  private PATRON = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;

  // estado UI
  loadingList = false;
  saving = false;
  okMsg = '';
  errorMsg = '';
  errorMsgInline = '';
  nombreError = '';

  // datos
  rows: Unidad[] = [];

  // edición
  editando = false;
  private editingRow: Unidad | null = null;

  // confirm
  confirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  private confirmHandler: (() => void) | null = null;

  // form
  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(this.NOMBRE_MAX)]],
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

  // recortes suaves
  onNombreInput(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const rec = el.value.slice(0, this.NOMBRE_MAX);
    if (el.value !== rec) {
      el.value = rec;
      this.form.controls.nombre.setValue(rec, { emitEvent: false });
    }
    if (this.nombreError) this.nombreError = '';
  }
  onDescInput(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const rec = el.value.slice(0, this.DESC_MAX);
    if (el.value !== rec) {
      el.value = rec;
      this.form.controls.descripcion.setValue(rec, { emitEvent: false });
    }
  }

  loadData() {
    this.loadingList = true;
    this.http.get<Unidad[]>(`${this.API}/unidades-medida`).subscribe({
      next: (rows) => { this.rows = rows || []; this.loadingList = false; },
      error: () => { this.rows = []; this.loadingList = false; }
    });
  }

  submit() {
    if (this.saving) return;

    const nombre = (this.form.value.nombre || '').trim().replace(/\s+/g, ' ');
    const descripcion = (this.form.value.descripcion || '').trim().replace(/\s+/g, ' ');

    // Validaciones locales (NO activar saving aún)
    if (!nombre) return this.showInline('El nombre es obligatorio.');
    if (!this.PATRON.test(nombre)) return this.showInline('El nombre solo puede contener letras, espacios, guiones y puntos.');
    if (nombre.length > this.NOMBRE_MAX) return this.showInline(`El nombre admite máximo ${this.NOMBRE_MAX} caracteres.`);
    if (descripcion.length > this.DESC_MAX) return this.showInline(`La descripción admite máximo ${this.DESC_MAX} caracteres.`);

    // Pasa validación → activar saving
    this.saving = true;

    const body = {
      nombre_unidad_medida: nombre,
      descripcion_unidad_medida: descripcion || undefined,
    };

    const req$ = (this.editando && this.editingRow?.codigo_unidad_medida)
      ? this.http.put<{message?: string}>(`${this.API}/unidades-medida/${this.editingRow.codigo_unidad_medida}`, body)
      : this.http.post<{message?: string}>(`${this.API}/unidades-medida`, body);

    req$
      .pipe(finalize(() => { this.saving = false; })) // ← clave: siempre apaga el “Guardando…”
      .subscribe({
        next: (res) => {
          this.showOk(res?.message || (this.editando ? 'Unidad actualizada' : 'Unidad creada'));
          this.loadData();
          this.resetForm();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: (e) => {
          this.showError(e?.error?.message || 'Error al guardar la unidad.');
        }
      });
  }

  editar(row: Unidad) {
    this.editando = true;
    this.editingRow = row;
    this.form.patchValue({
      nombre: row.nombre_unidad_medida ?? '',
      descripcion: row.descripcion_unidad_medida ?? ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion() {
    this.resetForm();
  }

  confirmarEliminar(row: Unidad) {
    this.confirmTitle = 'Confirmar eliminación';
    this.confirmMessage = `¿Seguro que deseas eliminar la unidad "${row.nombre_unidad_medida}"?\nEsta acción no se puede deshacer.`;
    this.confirmHandler = () => this.eliminar(row.codigo_unidad_medida);
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

  private eliminar(id: number) {
    if (!id || Number.isNaN(id)) { this.showError('ID inválido.'); return; }

    this.http.delete<{message?: string; requiresUpdateProducts?: boolean; productos?: string[]; truncated?: boolean; totalProductos?: number}>
      (`${this.API}/unidades-medida/${id}`)
      .subscribe({
        next: (res) => {
          this.showOk(res?.message || 'Unidad eliminada correctamente.');
          this.loadData();
        },
        error: (e) => {
          const err = e?.error || {};
          if (e?.status === 409 && err?.requiresUpdateProducts) {
            const lista = (err.productos || []).map((n: string) => `• ${n}`).join('\n');
            const sufijo = err.truncated ? `\n\n(Se muestran solo algunos; total: ${err.totalProductos})` : '';
            // Modal informativo (no destructivo)
            this.confirmTitle = 'No se puede eliminar';
            this.confirmMessage =
              `La unidad está en uso por ${err.totalProductos ?? 0} producto(s).\n` +
              `Debes editar esos productos y cambiar la unidad antes de eliminarla.\n\n` +
              `${lista}${sufijo}`;
            this.confirmHandler = null; // solo informativo
            this.confirmOpen = true;
            return;
          }
          this.showError(err?.message || 'Error al eliminar.');
        }
      });
  }

  private resetForm() {
    this.editando = false;
    this.editingRow = null;
    this.form.reset({ nombre: '', descripcion: '' });
    this.nombreError = '';
  }
}

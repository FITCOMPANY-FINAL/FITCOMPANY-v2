import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';

type TipoId = { id: number; descripcion: string; estado: 'A' | 'I' };

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
  private API = 'http://localhost:3000/api';

  // límites y patrón (igual a tu React)
  DESC_MAX = 100;
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
    descripcion: ['', [Validators.required, Validators.maxLength(this.DESC_MAX)]],
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
  onDescripcionInput(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const rec = el.value.slice(0, this.DESC_MAX);
    if (el.value !== rec) {
      el.value = rec;
      this.form.controls.descripcion.setValue(rec, { emitEvent: false });
    }
    if (this.descError) this.descError = '';
  }

  loadData() {
    this.loadingList = true;
    const params = new HttpParams().set('incluirInactivos', 'true');
    this.http.get<TipoId[]>(`${this.API}/tipos-identificacion`, { params }).subscribe({
      next: (rows) => { this.tipos = rows || []; this.loadingList = false; },
      error: () => { this.tipos = []; this.loadingList = false; }
    });
  }

  async checkDuplicado() {
    const val = (this.form.value.descripcion || '').trim();
    if (!val) { this.descError = 'Ingresa un tipo de identificación'; return; }
    if (!this.PATRON.test(val)) { this.descError = 'Solo letras, espacios, guiones y puntos.'; return; }

    try {
      let params = new HttpParams().set('descripcion', val);
      if (this.editando && this.editRow?.id) {
        params = params.set('excludeId', String(this.editRow.id));
      }
      const res: any = await this.http.get(`${this.API}/tipos-identificacion/exists`, { params }).toPromise();
      if (res?.exists) {
        this.descError = 'Ya existe un tipo de identificación con esa descripción.';
      } else {
        this.descError = '';
      }
    } catch {
      // si falla el prechequeo, no bloqueamos
    }
  }

  submit() {
    if (this.saving) return;

    const descripcion = (this.form.value.descripcion || '').trim().replace(/\s+/g, ' ');
    if (!descripcion) return this.showInline('La descripción es obligatoria.');
    if (!this.PATRON.test(descripcion)) return this.showInline('Solo se permiten letras, espacios, guiones y puntos.');
    if (this.descError) return; // duplicado detectado

    this.saving = true;

    const body = { descripcion };
    const req$ = (this.editando && this.editRow?.id)
      ? this.http.put<{message?: string}>(`${this.API}/tipos-identificacion/${this.editRow.id}`, body)
      : this.http.post<{message?: string}>(`${this.API}/tipos-identificacion`, body);

    req$.subscribe({
      next: (res) => {
        this.showOk(res?.message || (this.editando ? 'Tipo actualizado' : 'Tipo agregado'));
        this.loadData();
        this.resetForm();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (e) => {
        this.showError(e?.error?.message || 'Error al guardar.');
      },
      complete: () => { this.saving = false; }
    });
  }

  editar(row: TipoId) {
    this.editando = true;
    this.editRow = row;
    this.form.patchValue({ descripcion: row.descripcion ?? '' });
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
    this.confirmMessage = `¿Seguro que deseas eliminar "${row.descripcion}"?\nEsta acción no se puede deshacer.`;
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

            // Ofrecer desactivar
            this.confirmTitle = 'No se puede eliminar';
            this.confirmMessage =
              `Este tipo está en uso por ${detalle}.\n\n¿Deseas DESACTIVARLO para que no se use en nuevos registros?`;
            this.confirmHandler = () => this.desactivar(row.id);
            this.confirmOpen = true;
            return;
          }
          this.showError(e?.error?.message || 'Operación no permitida.');
          this.loadData();
        }
      });
  }

  private desactivar(id: number) {
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
    this.form.reset({ descripcion: '' });
    this.descError = '';
  }
}

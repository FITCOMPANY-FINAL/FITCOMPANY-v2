import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MetodosPagoService, MetodoPago } from '../../../../shared/services/metodos-pago.service';

@Component({
  standalone: true,
  selector: 'app-metodos-pago',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './metodos-pago.html',
  styleUrl: './metodos-pago.scss'
})
export class MetodosPago implements OnInit {
  private fb = inject(FormBuilder);
  private metodosPagoSrv = inject(MetodosPagoService);

  rows: MetodoPago[] = [];
  loadingList = false;

  saving = false;
  okMsg = '';
  errorMsg = '';

  // Form
  form = this.fb.nonNullable.group({
    nombre_metodo_pago: ['', [Validators.required, Validators.maxLength(100)]],
    descripcion_metodo_pago: ['', [Validators.maxLength(255)]],
    activo: [true]
  });

  // Edición
  editando = false;
  private editId: number | null = null;

  // Confirm modal
  confirmOpen = false;
  private pendingDeleteId: number | null = null;

  ngOnInit(): void {
    this.loadData();
  }

  // --- helpers de mensajes (auto-ocultan a los 4s) ---
  private autoHideMessages(ms = 4000) {
    window.setTimeout(() => {
      this.okMsg = '';
      this.errorMsg = '';
    }, ms);
  }
  private showOk(msg: string) {
    this.okMsg = msg;
    this.errorMsg = '';
    this.autoHideMessages(4000);
  }
  private showError(msg: string) {
    this.errorMsg = msg;
    this.okMsg = '';
    this.autoHideMessages(4000);
  }

  // --- cargar listado ---
  loadData() {
    this.loadingList = true;
    this.metodosPagoSrv.listar().subscribe({
      next: (rows) => { this.rows = rows || []; this.loadingList = false; },
      error: () => { this.rows = []; this.loadingList = false; this.showError('Error cargando métodos de pago'); }
    });
  }

  // --- crear / actualizar ---
  submit() {
    if (this.saving) return;

    // sanitizar
    const nombre = (this.form.value.nombre_metodo_pago || '').trim().replace(/\s+/g, ' ');
    const desc   = (this.form.value.descripcion_metodo_pago || '').trim().replace(/\s+/g, ' ');

    // validaciones
    if (!nombre) return this.showError('El nombre es obligatorio.');
    const PATRON = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;
    if (!PATRON.test(nombre)) return this.showError('El nombre solo puede contener letras, espacios, guiones y puntos.');
    if (nombre.length > 100) return this.showError('El nombre admite máximo 100 caracteres.');
    if (desc.length > 200) return this.showError('La descripción admite máximo 200 caracteres.');

    this.saving = true;
    this.okMsg = '';
    this.errorMsg = '';

    const body = {
      nombre_metodo_pago: nombre,
      descripcion_metodo_pago: desc,
      activo: this.form.value.activo ?? true
    };
    const req$ = (this.editando && this.editId != null)
      ? this.metodosPagoSrv.actualizar(this.editId, body)
      : this.metodosPagoSrv.crear(body);

    req$
      .pipe(finalize(() => { this.saving = false; }))
      .subscribe({
        next: (res) => {
          this.showOk(res?.message || (this.editando ? 'Método de pago actualizado.' : 'Método de pago creado.'));
          this.loadData();
          this.editando = false;
          this.editId = null;
          this.form.reset({ nombre_metodo_pago: '', descripcion_metodo_pago: '', activo: true });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: (e) => {
          this.showError(e?.error?.message || 'Error al guardar el método de pago.');
        }
      });
  }

  // --- edición ---
  editar(m: MetodoPago) {
    this.editando = true;
    this.editId = m.id_metodo_pago ?? null;
    this.form.patchValue({
      nombre_metodo_pago: m.nombre_metodo_pago ?? '',
      descripcion_metodo_pago: m.descripcion_metodo_pago ?? '',
      activo: m.activo ?? true
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion() {
    this.editando = false;
    this.editId = null;
    this.form.reset({ nombre_metodo_pago: '', descripcion_metodo_pago: '', activo: true });
  }

  // --- confirmación estilizada ---
  confirmarEliminar(m: MetodoPago) {
    this.pendingDeleteId = m.id_metodo_pago ?? null;
    this.confirmOpen = true;
  }

  closeConfirm() {
    this.confirmOpen = false;
    this.pendingDeleteId = null;
  }

  doEliminarConfirmado() {
    if (this.pendingDeleteId == null) { this.closeConfirm(); return; }
    const id = this.pendingDeleteId;

    // cerramos modal y limpiamos id pendiente
    this.confirmOpen = false;
    this.pendingDeleteId = null;

    this.metodosPagoSrv.eliminar(id).subscribe({
      next: (res) => {
        this.showOk(res?.message || 'Método de pago eliminado correctamente.');
        this.loadData();
      },
      error: (e) => {
        this.showError(e?.error?.message || 'Error eliminando el método de pago.');
      }
    });
  }
}

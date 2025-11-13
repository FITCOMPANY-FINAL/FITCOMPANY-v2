import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { ComprasService } from '../../../../shared/services/compras.service';
import { ProductosService } from '../../../../shared/services/productos.service';
import { Compra } from '../../../../shared/models/compra.model';
import { Producto } from '../../../../shared/models/producto.model';

@Component({
  standalone: true,
  selector: 'app-compras',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './compras.html'
})
export class Compras implements OnInit {
  private fb = inject(FormBuilder);
  private comprasSrv = inject(ComprasService);
  private productosSrv = inject(ProductosService);

  rows: Compra[] = [];
  productos: Producto[] = [];

  saving = false;
  okMsg = '';
  errorMsg = '';
  errorMsgInline = '';

  editando = false;
  private editId: number | null = null;

  // modal confirm
  confirmOpen = false;
  private pendingDeleteId: number | null = null;

  today = this.toTodayISO();

  // máscaras
  cantidadMasked = '';
  costoMasked = '';

  form = this.fb.nonNullable.group({
    producto_id: ['', [Validators.required]],
    cantidad: [null as number | null, [Validators.required, Validators.min(1), Validators.max(999999)]],
    costo_unitario: [null as number | null, [Validators.required, Validators.min(1), Validators.max(99999999)]],
    fecha_compra: [this.today, [Validators.required]]
  });

  ngOnInit(): void {
    this.loadProductos();
    this.loadData();
  }

  private toTodayISO(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // helpers máscara
  private onlyDigits(s: string) { return (s || '').replace(/\D/g, ''); }
  private clampDigits(s: string, maxLen: number) { return this.onlyDigits(s).slice(0, maxLen); }
  private withThousands(digits: string) { return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  // auto-hide mensajes
  private autoHideMessages(ms = 4000) {
    window.setTimeout(() => {
      this.okMsg = '';
      this.errorMsg = '';
      this.errorMsgInline = '';
    }, ms);
  }
  private showOk(msg: string) { this.okMsg = msg; this.errorMsg = ''; this.errorMsgInline = ''; this.autoHideMessages(); }
  private showError(msg: string) { this.errorMsg = msg; this.okMsg = ''; this.autoHideMessages(); }
  private showInline(msg: string) { this.errorMsgInline = msg; this.okMsg = ''; this.errorMsg = ''; this.autoHideMessages(); }

  // enmascara y sincroniza con el form
  onInputMasked(ctrl: 'cantidad' | 'costo_unitario', maxLen: number, ev: Event) {
    const el = ev.target as HTMLInputElement;
    const digits = this.clampDigits(el.value, maxLen);
    const masked = this.withThousands(digits);
    el.value = masked;

    if (ctrl === 'cantidad') {
      this.cantidadMasked = masked;
      this.form.controls.cantidad.setValue(digits ? Number(digits) : null);
      this.form.controls.cantidad.markAsTouched();
    } else {
      this.costoMasked = masked;
      this.form.controls.costo_unitario.setValue(digits ? Number(digits) : null);
      this.form.controls.costo_unitario.markAsTouched();
    }
    this.errorMsgInline = '';
  }

  loadProductos() {
    this.productosSrv.listar().subscribe({
      next: (rows) => this.productos = rows || [],
      error: () => this.productos = []
    });
  }

  loadData() {
    this.comprasSrv.listar().subscribe({
      next: (rows) => this.rows = rows || [],
      error: () => this.rows = []
    });
  }

  submit() {
    if (this.saving) return;

    // validaciones explícitas (idénticas a React)
    if (!this.form.value.producto_id) return this.showInline('Debes seleccionar un producto.');
    if (!(this.form.value.cantidad && this.form.value.cantidad >= 1 && this.form.value.cantidad <= 999999)) {
      return this.showInline('La cantidad debe ser un entero entre 1 y 999.999.');
    }
    if (!(this.form.value.costo_unitario && this.form.value.costo_unitario >= 1 && this.form.value.costo_unitario <= 99999999)) {
      return this.showInline('El costo unitario debe ser un entero entre 1 y 99.999.999.');
    }
    if (!this.form.value.fecha_compra) return this.showInline('Debes seleccionar la fecha de compra.');

    this.saving = true;
    this.okMsg = '';
    this.errorMsg = '';
    this.errorMsgInline = '';

    const body = {
      producto_id: Number(this.form.value.producto_id),
      cantidad: Number(this.form.value.cantidad),
      costo_unitario: Number(this.form.value.costo_unitario),
      fecha_compra: this.form.value.fecha_compra! // YYYY-MM-DD
    };

    const req$ = (this.editando && this.editId != null)
      ? this.comprasSrv.actualizar(this.editId, body)
      : this.comprasSrv.crear(body);

    req$
      .pipe(finalize(() => { this.saving = false; this.autoHideMessages(); }))
      .subscribe({
        next: (res) => {
          if (Array.isArray((res as any)?.warnings) && (res as any).warnings.length > 0) {
            console.warn('Warnings:', (res as any).warnings);
          }
          this.showOk(res?.message || (this.editando ? 'Compra actualizada' : `Compra registrada (ID: ${(res as any)?.id_compra ?? ''})`));
          this.loadData();
          this.resetForm();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: (e) => {
          this.showError(e?.error?.message || e?.error?.raw || 'Error al guardar la compra.');
        }
      });
  }

  editar(c: Compra) {
    this.editando = true;
    this.editId = c.id_compra ?? null;

    this.form.patchValue({
      producto_id: c.producto as any,
      cantidad: c.cantidad ?? null,
      costo_unitario: c.costo_unitario ?? null,
      fecha_compra: this.ddmmyyyyToISO(c.fecha) || this.today
    });

    this.cantidadMasked = this.withThousands(String(c.cantidad ?? '').replace(/\D/g, ''));
    const cu = c.costo_unitario ?? '';
    this.costoMasked = this.withThousands(String(cu).replace(/\D/g, ''));

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion() {
    this.resetForm();
  }

  // --- Confirmación estilizada ---
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

    this.comprasSrv.eliminar(id).subscribe({
      next: (res) => {
        this.showOk(res?.message || 'Compra eliminada correctamente');
        this.loadData();
      },
      error: (e) => {
        this.showError(e?.error?.message || e?.error?.raw || 'Error al eliminar compra.');
      }
    });
  }

  // Bloquea tecleo/pegado si supera el límite de dígitos (cuenta solo números)
  onBeforeInputDigits(ev: InputEvent, ctrl: 'cantidad' | 'costo_unitario', maxLen: number) {
    const it = ev.inputType || '';
    if (it.startsWith('delete') || it === 'historyUndo' || it === 'historyRedo') return;

    const el = ev.target as HTMLInputElement;
    const data = (ev as any).data ?? '';
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;

    const before = (el.value.slice(0, start) || '').replace(/\D/g, '');
    const after = (el.value.slice(end) || '').replace(/\D/g, '');
    const incoming = (String(data) || '').replace(/\D/g, '');

    const nextLen = before.length + incoming.length + after.length;
    if (nextLen > maxLen) ev.preventDefault();
  }

  // utils
  private resetForm() {
    this.editando = false;
    this.editId = null;
    this.form.reset({
      producto_id: '',
      cantidad: null,
      costo_unitario: null,
      fecha_compra: this.today
    });
    this.cantidadMasked = '';
    this.costoMasked = '';
  }

  private ddmmyyyyToISO(ddmmyyyy?: string | null) {
    if (!ddmmyyyy) return '';
    const [dd, mm, yyyy] = ddmmyyyy.split('/');
    if (!dd || !mm || !yyyy) return '';
    return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }
}

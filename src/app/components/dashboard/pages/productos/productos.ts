import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs/operators'; // 👈 clave

interface Producto {
  id_producto: number;
  nombre_producto: string;
  descripcion_producto?: string | null;
  precio_unitario: number;
  stock_actual: number;
  stock_minimo: number;
  stock_maximo: number;
  unidad_medida: number;
  producto_categoria: number;
  nombre_unidad_medida?: string;
  nombre_categoria?: string;
}

interface UnidadMedida {
  codigo_unidad_medida: number;
  nombre_unidad_medida: string;
}
interface Categoria {
  id_categoria: number;
  nombre_categoria: string;
}

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './productos.html',
  styleUrl: './productos.scss'
})
export class Productos implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private API = 'http://localhost:3000/api';

  // datos
  rows: Producto[] = [];
  unidades: UnidadMedida[] = [];
  categorias: Categoria[] = [];

  // ui
  loadingList = false;
  saving = false;
  okMsg = '';
  errorMsg = '';
  errorMsgInline = '';

  // edición
  editando = false;
  private editId: number | null = null;

  // confirm modal
  confirmOpen = false;
  private pendingDeleteId: number | null = null;

  // máscaras de números
  precioMasked = '';
  stockActualMasked = '';
  stockMinimoMasked = '';
  stockMaximoMasked = '';

  form = this.fb.nonNullable.group({
    nombre_producto: ['', [Validators.required, Validators.maxLength(120)]],
    descripcion_producto: ['', [Validators.maxLength(255)]],
    precio_unitario: [null as number | null, [Validators.required, Validators.min(1), Validators.max(99_999_999)]],
    stock_actual: [null as number | null, [Validators.required, Validators.min(0)]],
    stock_minimo: [null as number | null, [Validators.required, Validators.min(0)]],
    stock_maximo: [null as number | null, [Validators.required, Validators.min(1)]],
    unidad_medida: ['', [Validators.required]],
    producto_categoria: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.loadCombos();
    this.loadData();
  }

  // ------------ Helpers UI mensajes ------------
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

  // ------------ Máscaras y validación de dígitos ------------
  private onlyDigits(s: string) { return (s || '').replace(/\D/g, ''); }
  private clampDigits(s: string, maxLen: number) { return this.onlyDigits(s).slice(0, maxLen); }
  private withThousands(d: string) { return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  onBeforeInputDigits(ev: InputEvent, ctrl: 'precio_unitario' | 'stock_actual' | 'stock_minimo' | 'stock_maximo', maxLen: number) {
    const it = ev.inputType || '';
    if (it.startsWith('delete') || it === 'historyUndo' || it === 'historyRedo') return;

    const el = ev.target as HTMLInputElement;
    const data = (ev as any).data ?? '';
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;

    const currentDigits = (el.value || '').replace(/\D/g, '');
    const before = (el.value.slice(0, start) || '').replace(/\D/g, '');
    const after  = (el.value.slice(end) || '').replace(/\D/g, '');
    const incomingDigits = (String(data) || '').replace(/\D/g, '');

    const nextDigitsLen = before.length + incomingDigits.length + after.length;
    if (nextDigitsLen > maxLen) ev.preventDefault();
  }

  onInputMasked(ctrl: 'precio_unitario' | 'stock_actual' | 'stock_minimo' | 'stock_maximo', maxLen: number, ev: Event) {
    const el = ev.target as HTMLInputElement;
    const digits = this.clampDigits(el.value, maxLen);
    const masked = this.withThousands(digits);

    if (ctrl === 'precio_unitario') {
      this.precioMasked = masked;
      this.form.controls.precio_unitario.setValue(digits ? Number(digits) : null);
      this.form.controls.precio_unitario.markAsTouched();
    } else if (ctrl === 'stock_actual') {
      this.stockActualMasked = masked;
      this.form.controls.stock_actual.setValue(digits ? Number(digits) : null);
      this.form.controls.stock_actual.markAsTouched();
    } else if (ctrl === 'stock_minimo') {
      this.stockMinimoMasked = masked;
      this.form.controls.stock_minimo.setValue(digits ? Number(digits) : null);
      this.form.controls.stock_minimo.markAsTouched();
    } else {
      this.stockMaximoMasked = masked;
      this.form.controls.stock_maximo.setValue(digits ? Number(digits) : null);
      this.form.controls.stock_maximo.markAsTouched();
    }

    this.errorMsgInline = '';
  }

  // ------------ Cargas ------------
  loadCombos() {
    this.http.get<UnidadMedida[]>(`${this.API}/unidades-medida`).subscribe({
      next: (rows) => this.unidades = rows || [],
      error: () => this.unidades = []
    });
    this.http.get<Categoria[]>(`${this.API}/categorias`).subscribe({
      next: (rows) => this.categorias = rows || [],
      error: () => this.categorias = []
    });
  }

  loadData() {
    this.loadingList = true;
    this.http.get<Producto[]>(`${this.API}/productos`).subscribe({
      next: (rows) => { this.rows = rows || []; this.loadingList = false; },
      error: () => { this.rows = []; this.loadingList = false; }
    });
  }

  // ------------ Reglas de negocio ------------
  private stocksValid(): string | null {
    const act = Number(this.form.value.stock_actual ?? 0);
    const min = Number(this.form.value.stock_minimo ?? 0);
    const max = Number(this.form.value.stock_maximo ?? 0);

    if (!Number.isFinite(max) || max <= 0) return 'El stock máximo debe ser mayor a cero.';
    if (!Number.isFinite(act) || !Number.isFinite(min)) return 'Stock actual y mínimo deben ser números válidos.';
    if (act < min) return 'El stock actual no puede ser menor que el stock mínimo.';
    if (act > max) return 'El stock actual no puede ser mayor que el stock máximo.';
    return null;
  }

  isOutOfRange(p: Producto): boolean {
    const act = Number(p.stock_actual ?? 0);
    const min = Number(p.stock_minimo ?? 0);
    const max = Number(p.stock_maximo ?? 0);
    return (act < min) || (max > 0 && act > max);
  }

  // ------------ CRUD ------------
  submit() {
    if (this.saving) return;

    // Validaciones locales (antes de activar saving)
    if (!this.form.value.nombre_producto) return this.showInline('El nombre es obligatorio.');
    if (!(this.form.value.precio_unitario && this.form.value.precio_unitario >= 1 && this.form.value.precio_unitario <= 99_999_999)) {
      return this.showInline('El precio debe estar entre 1 y 99.999.999.');
    }
    if (!this.form.value.unidad_medida) return this.showInline('Debes seleccionar la unidad de medida.');
    if (!this.form.value.producto_categoria) return this.showInline('Debes seleccionar la categoría.');

    const stocksErr = this.stocksValid();
    if (stocksErr) return this.showInline(stocksErr);

    // Pasa validación → activar saving
    this.saving = true;
    this.okMsg = '';
    this.errorMsg = '';
    this.errorMsgInline = '';

    const body = {
      nombre_producto: (this.form.value.nombre_producto || '').trim().replace(/\s+/g, ' '),
      descripcion_producto: (this.form.value.descripcion_producto || '').trim().replace(/\s+/g, ' '),
      precio_unitario: Number(this.form.value.precio_unitario),
      stock_actual: Number(this.form.value.stock_actual),
      stock_minimo: Number(this.form.value.stock_minimo),
      stock_maximo: Number(this.form.value.stock_maximo),
      unidad_medida: Number(this.form.value.unidad_medida),
      producto_categoria: Number(this.form.value.producto_categoria),
    };

    const req$ = this.editando && this.editId != null
      ? this.http.put<{ message?: string }>(`${this.API}/productos/${this.editId}`, body)
      : this.http.post<{ message?: string }>(`${this.API}/productos`, body);

    req$
      .pipe(finalize(() => { this.saving = false; })) // 👈 aquí se apaga SIEMPRE
      .subscribe({
        next: (res) => {
          this.showOk(res?.message || (this.editando ? 'Producto actualizado.' : 'Producto creado.'));
          this.loadData();
          this.resetForm();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: (e) => {
          this.showError(e?.error?.message || 'Error al guardar producto.');
        }
      });
  }

  editar(p: Producto) {
    this.editando = true;
    this.editId = p.id_producto ?? null;

    this.form.patchValue({
      nombre_producto: p.nombre_producto ?? '',
      descripcion_producto: p.descripcion_producto ?? '',
      precio_unitario: p.precio_unitario ?? null,
      stock_actual: p.stock_actual ?? null,
      stock_minimo: p.stock_minimo ?? null,
      stock_maximo: p.stock_maximo ?? null,
      unidad_medida: String(p.unidad_medida ?? ''),
      producto_categoria: String(p.producto_categoria ?? ''),
    });

    this.precioMasked      = this.withThousands(String(p.precio_unitario ?? '').replace(/\D/g, ''));
    this.stockActualMasked = this.withThousands(String(p.stock_actual ?? '').replace(/\D/g, ''));
    this.stockMinimoMasked = this.withThousands(String(p.stock_minimo ?? '').replace(/\D/g, ''));
    this.stockMaximoMasked = this.withThousands(String(p.stock_maximo ?? '').replace(/\D/g, ''));

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

    this.http.delete<{ message?: string }>(`${this.API}/productos/${id}`).subscribe({
      next: (res) => {
        this.showOk(res?.message || 'Producto eliminado correctamente.');
        this.loadData();
      },
      error: (e) => {
        this.showError(e?.error?.message || 'No se pudo eliminar el producto.');
      }
    });
  }

  // ------------ utils ------------
  private resetForm() {
    this.editando = false;
    this.editId = null;
    this.form.reset({
      nombre_producto: '',
      descripcion_producto: '',
      precio_unitario: null,
      stock_actual: null,
      stock_minimo: null,
      stock_maximo: null,
      unidad_medida: '',
      producto_categoria: ''
    });
    this.precioMasked = '';
    this.stockActualMasked = '';
    this.stockMinimoMasked = '';
    this.stockMaximoMasked = '';
  }
}

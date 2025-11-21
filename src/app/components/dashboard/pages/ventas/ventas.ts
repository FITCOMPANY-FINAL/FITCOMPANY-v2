import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  FormArray,
  FormGroup,
} from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { VentasService } from '../../../../shared/services/ventas.service';
import { ProductosService } from '../../../../shared/services/productos.service';
import { Venta } from '../../../../shared/models/venta.model';
import { Producto } from '../../../../shared/models/producto.model';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ventas.html',
  styleUrl: './ventas.scss',
})
export class Ventas implements OnInit {
  private fb = inject(FormBuilder);
  private ventasSrv = inject(VentasService);
  private productosSrv = inject(ProductosService);

  rows: Venta[] = [];
  productos: Producto[] = [];

  okMsg = '';
  errorMsg = '';
  saving = false;

  violations: any[] = [];
  violTitle = '';
  private violTimer: any = null;

  editando = false;
  private editId: number | null = null;

  confirmOpen = false;
  private pendingDeleteId: number | null = null;

  private static readonly LIMITE_CANTIDAD = 6;
  private static readonly TOPE_TOTAL = 99_999_999;
  private static readonly MAX_ITEMS = 200;

  form = this.fb.group({
    lineas: this.fb.array<FormGroup>([]),
  });

  get lineas(): FormArray<FormGroup> {
    return this.form.controls.lineas as FormArray<FormGroup>;
  }

  ngOnInit(): void {
    this.loadProductos();
    this.loadRows();
    if (this.lineas.length === 0) this.agregarLinea();
  }

  // ---------- máscara ----------
  private onlyDigits(s: string) { return (s || '').replace(/\D/g, ''); }
  private clampDigits(s: string, maxLen: number) { return this.onlyDigits(s).slice(0, maxLen); }
  private withThousands(digits: string) { return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  private unmask(v: unknown): number { const d = (v ?? '').toString().replace(/\D/g, ''); return d ? Number(d) : 0; }

  onBeforeInputDigits(ev: InputEvent, idx: number, maxLen: number) {
    const it = ev.inputType || '';
    if (it.startsWith('delete') || it === 'historyUndo' || it === 'historyRedo') return;
    const el = ev.target as HTMLInputElement;
    const data = (ev as any).data ?? '';
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;

    const before = (el.value.slice(0, start) || '').replace(/\D/g, '');
    const after = (el.value.slice(end) || '').replace(/\D/g, '');
    const incoming = (String(data) || '').replace(/\D/g, '');
    if (before.length + incoming.length + after.length > maxLen) ev.preventDefault();
  }

  getCantidadMasked(i: number): string {
    const valor = this.lineas.at(i).get('cantidad')?.value || '';
    // Si es número, convertirlo a entero primero
    let digits: string;
    if (typeof valor === 'number') {
      digits = String(Math.floor(valor));
    } else {
      // Si es string, extraer solo dígitos (sin puntos ni comas)
      digits = this.onlyDigits(String(valor));
    }
    return this.withThousands(digits);
  }

  onInputMasked(i: number, controlName: 'cantidad', max: number, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const digits = this.clampDigits(input.value, max);
    const masked = this.withThousands(digits);
    input.value = masked;
    // Guardar el valor sin máscara (solo dígitos) en el FormControl para los cálculos
    const control = this.lineas.at(i).get(controlName);
    if (control) {
      control.setValue(digits || '', { emitEvent: true });
      control.markAsTouched();
    }
  }

  // ---------- productos / data ----------
  loadProductos() {
    this.productosSrv.listar().subscribe({
      next: (rows) => this.productos = rows || [],
      error: () => this.productos = [],
    });
  }

  loadRows() {
    this.ventasSrv.listar().subscribe({
      next: (rows) => this.rows = rows || [],
      error: () => this.rows = [],
    });
  }

  // ---------- líneas ----------
  private crearLinea(): FormGroup {
    return this.fb.group({
      producto: ['', [Validators.required]],
      cantidad: ['', [Validators.required]],
      precioUnit: [0, [Validators.required]],
    });
  }

  agregarLinea() {
    if (this.lineas.length >= Ventas.MAX_ITEMS) return;
    this.lineas.push(this.crearLinea());
  }

  eliminarLinea(i: number) {
    this.lineas.removeAt(i);
  }

  // ---- evitar duplicados ----
  private getSelectedIds(exceptIndex?: number): Set<number> {
    const set = new Set<number>();
    this.lineas.controls.forEach((g, idx) => {
      if (idx === exceptIndex) return;
      const v = g.get('producto')?.value;
      const id = Number(v);
      if (id) set.add(id);
    });
    return set;
  }

  isProductoOcupado(idProducto: number, indexActual: number): boolean {
    // Deshabilita el option si ya está seleccionado en otra fila distinta a la actual
    const selected = this.getSelectedIds(indexActual);
    return selected.has(Number(idProducto));
  }

  onProductoChange(i: number) {
    const ctrl = this.lineas.at(i);
    const idSel = Number(ctrl.get('producto')?.value);

    // Si ese producto ya está ocupado en otra fila, revertir selección y avisar
    if (this.isProductoOcupado(idSel, i)) {
      ctrl.get('producto')?.setValue('');
      ctrl.get('precioUnit')?.setValue(0);
      this.showError('Este producto ya está seleccionado en otra fila.');
      return;
    }

    const p = this.productos.find(pp => Number(pp.id_producto) === idSel);
    // El backend puede devolver precio_unitario o precio_venta
    const precio = Number((p as any)?.precio_unitario ?? (p as any)?.precio_venta ?? 0);
    ctrl.get('precioUnit')?.setValue(precio);
  }

  subtotal(i: number): number {
    const g = this.lineas.at(i);
    const qty = this.unmask(g.get('cantidad')?.value);
    const pu  = Number(g.get('precioUnit')?.value || 0);
    return qty * pu;
  }

  get total(): number {
    return this.lineas.controls.reduce((acc, g) => {
      const qty = this.unmask(g.get('cantidad')?.value);
      const pu  = Number(g.get('precioUnit')?.value || 0);
      return acc + qty * pu;
    }, 0);
  }

  // ---------- mensajes ----------
  private autoHide(ms = 4000) {
    window.setTimeout(() => { this.okMsg = ''; this.errorMsg = ''; }, ms);
  }
  private showOk(msg: string) { this.okMsg = msg; this.errorMsg = ''; this.autoHide(); }
  private showError(msg: string) { this.errorMsg = msg; this.okMsg = ''; this.autoHide(); }

  private clearViolations() {
    if (this.violTimer) clearTimeout(this.violTimer);
    this.violations = [];
    this.violTitle = '';
  }
  private setViolations(arr: any[], title: string) {
    this.violations = arr || [];
    this.violTitle = title;
    if (this.violTimer) clearTimeout(this.violTimer);
    this.violTimer = setTimeout(() => this.clearViolations(), 10_000);
  }

  private validar(): string {
    const n = this.lineas.length;
    if (n <= 0) return 'Debes agregar al menos un producto.';
    if (n > Ventas.MAX_ITEMS) return `La venta no puede tener más de ${Ventas.MAX_ITEMS} ítems.`;

    // validar duplicados
    const seen = new Set<number>();
    for (let i = 0; i < n; i++) {
      const g = this.lineas.at(i);
      const idp = Number(g.get('producto')?.value);
      const qty = this.unmask(g.get('cantidad')?.value);
      const pu  = Number(g.get('precioUnit')?.value || 0);

      if (!idp) return `Debes seleccionar el producto en la fila #${i + 1}.`;
      if (seen.has(idp)) return `El producto de la fila #${i + 1} ya fue seleccionado en otra fila.`;
      seen.add(idp);

      if (!(qty >= 1 && qty <= 999_999)) return `La cantidad de la fila #${i + 1} debe estar entre 1 y 999.999.`;
      if (!(pu >= 1 && pu <= 99_999_999)) return `El precio unitario de la fila #${i + 1} debe estar entre 1 y 99.999.999.`;
    }

    const tot = this.total;
    if (!(tot >= 1 && tot <= Ventas.TOPE_TOTAL)) {
      return `El total de la venta no puede superar $ ${Ventas.TOPE_TOTAL.toLocaleString('es-CO')}.`;
    }
    return '';
  }

  submit() {
    if (this.saving) return;

    const msg = this.validar();
    if (msg) { this.showError(`❌ ${msg}`); return; }

    const productos = this.lineas.controls.map(g => ({
      id_producto: Number(g.get('producto')?.value),
      cantidad: this.unmask(g.get('cantidad')?.value),
      precio_unitario: Number(g.get('precioUnit')?.value || 0),
    }));

    this.saving = true;
    this.clearViolations();

    const req$ = (this.editando && this.editId != null)
      ? this.ventasSrv.actualizar(this.editId, { productos })
      : this.ventasSrv.crear({ productos });

    req$.pipe(finalize(() => { this.saving = false; this.autoHide(); }))
      .subscribe({
        next: (res: any) => {
          if (Array.isArray(res?.warnings) && res.warnings.length > 0) {
            console.warn('Warnings:', res.warnings);
          }
          this.showOk(res?.message || (this.editando ? 'Venta actualizada' : `Venta registrada (ID: ${res?.id_venta ?? ''})`));
          this.loadRows();
          this.resetForm();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: (e) => {
          const data = e?.error || {};
          if (data?.code === 'STOCK_NOT_ENOUGH' && Array.isArray(data?.items)) {
            const mapped = data.items.map((it: any) => ({
              producto_id: it.producto_id,
              nombre: it.nombre || `#${it.producto_id}`,
              type: 'NOT_ENOUGH',
              actual: it.disponible,
              solicitado: it.solicitado,
              faltan: it.deficit,
              resultante: (it.disponible ?? 0) - (it.solicitado ?? 0),
            }));
            this.setViolations(mapped, 'Productos sin stock suficiente:');
            this.showError('❌ No se puede registrar la venta: stock insuficiente.');
          } else if (data?.code === 'MIN_STOCK_BREACH' && Array.isArray(data?.violations)) {
            this.setViolations(data.violations, 'Productos bajo el mínimo:');
            this.showError('❌ No se puede registrar la venta: hay productos que quedarían bajo el mínimo.');
          } else {
            this.showError(data?.message || data?.raw || 'Error al guardar la venta.');
          }
        }
      });
  }

  editar(v: Venta) {
    this.ventasSrv.detalle(v.id_venta).subscribe({
      next: (det) => {
        this.editando = true;
        this.editId = v.id_venta;
        this.lineas.clear();
        (det?.productos || []).forEach((p) => {
          const g = this.crearLinea();
          // Convertir a enteros para evitar problemas con decimales de la BD
          const cantidadInt = Math.floor(Number(p.cantidad) || 0);
          const precioInt = Math.floor(Number(p.precio_unitario) || 0);
          
          // Guardar como string sin máscara (solo dígitos) para los cálculos
          g.patchValue({
            producto: String(p.id_producto),
            cantidad: String(cantidadInt),
            precioUnit: precioInt,
          });
          this.lineas.push(g);
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: () => { this.showError('❌ No se pudo cargar la venta para editar'); }
    });
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

    this.ventasSrv.eliminar(id).subscribe({
      next: (res: any) => {
        if (Array.isArray(res?.warnings) && res.warnings.length > 0) {
          console.warn('Warnings:', res.warnings);
        }
        this.showOk(res?.message || 'Venta eliminada correctamente');
        this.loadRows();
      },
      error: (e) => {
        const data = e?.error || {};
        if (data?.code === 'MAX_STOCK_BREACH' && Array.isArray(data?.violations)) {
          this.setViolations(data.violations, 'Productos que excederían el máximo:');
          this.showError('❌ No se puede eliminar la venta: los productos listados superarían el stock máximo.');
        } else {
          this.showError(data?.message || data?.raw || 'Error al eliminar venta.');
        }
      }
    });
  }

  cancelarEdicion() {
    this.resetForm();
  }

  private resetForm() {
    this.editando = false;
    this.editId = null;
    this.form.reset({ lineas: [] });
    this.lineas.clear();
    this.agregarLinea();
    this.clearViolations();
  }
}

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormsModule,
  FormBuilder,
  Validators,
  FormArray,
  FormGroup,
} from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { VentasService } from '../../../../shared/services/ventas.service';
import { ProductosService } from '../../../../shared/services/productos.service';
import { MetodosPagoService, MetodoPago } from '../../../../shared/services/metodos-pago.service';
import { Venta } from '../../../../shared/models/venta.model';
import { Producto } from '../../../../shared/models/producto.model';
import { AbonosModalComponent } from '../../modals/abonos-modal/abonos-modal.component';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, AbonosModalComponent],
  templateUrl: './ventas.html',
  styleUrl: './ventas.scss',
})
export class Ventas implements OnInit {
  private fb = inject(FormBuilder);
  private ventasSrv = inject(VentasService);
  private productosSrv = inject(ProductosService);
  private metodosPagoSrv = inject(MetodosPagoService);

  rows: Venta[] = [];
  productos: Producto[] = [];
  metodosPago: MetodoPago[] = [];

  okMsg = '';
  errorMsg = '';
  saving = false;

  violations: any[] = [];
  violTitle = '';
  private violTimer: any = null;

  confirmOpen = false;
  private pendingDeleteId: number | null = null;
  motivoEliminacion = '';

  // Modal de abonos
  mostrarModalAbonos = false;
  ventaSeleccionada: Venta | null = null;

  // Mostrar eliminadas
  mostrarEliminadas = false;
  rowsOriginales: Venta[] = [];

  private static readonly LIMITE_CANTIDAD = 6;
  private static readonly TOPE_TOTAL = 99_999_999;
  private static readonly MAX_ITEMS = 200;

  form = this.fb.group({
    lineas: this.fb.array<FormGroup>([]),
    pagos: this.fb.array<FormGroup>([]),
    cliente_desc: [''],
    observaciones: [''],
    fecha_venta: [''], // YYYY-MM-DD
  });

  get lineas(): FormArray<FormGroup> {
    return this.form.controls.lineas as FormArray<FormGroup>;
  }

  get pagos(): FormArray<FormGroup> {
    return this.form.controls.pagos as FormArray<FormGroup>;
  }

  get today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  ngOnInit(): void {
    this.loadProductos();
    this.loadMetodosPago();
    this.loadRows();
    if (this.lineas.length === 0) this.agregarLinea();
    // Inicializar fecha con hoy
    this.form.patchValue({ fecha_venta: this.today });
  }

  // ---------- máscara ----------
  private onlyDigits(s: string) {
    return (s || '').replace(/\D/g, '');
  }
  private clampDigits(s: string, maxLen: number) {
    return this.onlyDigits(s).slice(0, maxLen);
  }
  private withThousands(digits: string) {
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  private unmask(v: unknown): number {
    const d = (v ?? '').toString().replace(/\D/g, '');
    return d ? Number(d) : 0;
  }

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
      next: (rows) => (this.productos = rows || []),
      error: () => (this.productos = []),
    });
  }

  loadMetodosPago() {
    this.metodosPagoSrv.listar().subscribe({
      next: (rows) => (this.metodosPago = rows || []),
      error: () => (this.metodosPago = []),
    });
  }

  loadRows() {
    this.ventasSrv.listar().subscribe({
      next: (rows) => {
        this.rowsOriginales = rows || [];
        this.actualizarFiltroPantalla();
      },
      error: () => {
        this.rows = [];
        this.rowsOriginales = [];
      },
    });
  }

  actualizarFiltroPantalla() {
    if (this.mostrarEliminadas) {
      // Mostrar solo las eliminadas
      this.rows = this.rowsOriginales.filter((r) => r.activo === false);
    } else {
      // Mostrar solo las activas
      this.rows = this.rowsOriginales.filter((r) => r.activo !== false);
    }
  }

  toggleMostrarEliminadas() {
    this.mostrarEliminadas = !this.mostrarEliminadas;
    this.actualizarFiltroPantalla();
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

    const p = this.productos.find((pp) => Number(pp.id_producto) === idSel);
    // El backend puede devolver precio_unitario o precio_venta
    const precio = Number((p as any)?.precio_unitario ?? (p as any)?.precio_venta ?? 0);
    ctrl.get('precioUnit')?.setValue(precio);
  }

  subtotal(i: number): number {
    const g = this.lineas.at(i);
    const qty = this.unmask(g.get('cantidad')?.value);
    const pu = Number(g.get('precioUnit')?.value || 0);
    return qty * pu;
  }

  get total(): number {
    return this.lineas.controls.reduce((acc, g) => {
      const qty = this.unmask(g.get('cantidad')?.value);
      const pu = Number(g.get('precioUnit')?.value || 0);
      return acc + qty * pu;
    }, 0);
  }

  // ---------- pagos ----------
  private crearPago(): FormGroup {
    return this.fb.group({
      id_metodo_pago: ['', [Validators.required]],
      monto: ['', [Validators.required, Validators.min(1)]],
      observaciones: [''],
    });
  }

  agregarPago() {
    this.pagos.push(this.crearPago());
  }

  eliminarPago(i: number) {
    this.pagos.removeAt(i);
  }

  getMontoMasked(i: number): string {
    const valor = this.pagos.at(i).get('monto')?.value || '';
    let digits: string;
    if (typeof valor === 'number') {
      digits = String(Math.floor(valor));
    } else {
      digits = this.onlyDigits(String(valor));
    }
    return this.withThousands(digits);
  }

  onInputMontoMasked(i: number, max: number, ev: Event) {
    const input = ev.target as HTMLInputElement;
    const digits = this.clampDigits(input.value, max);
    const masked = this.withThousands(digits);
    input.value = masked;
    const control = this.pagos.at(i).get('monto');
    if (control) {
      control.setValue(digits ? Number(digits) : null, { emitEvent: true });
      control.markAsTouched();
    }
  }

  get totalPagos(): number {
    return this.pagos.controls.reduce((acc, g) => {
      const monto = this.unmask(g.get('monto')?.value);
      return acc + monto;
    }, 0);
  }

  get saldoPendiente(): number {
    return Math.max(0, this.total - this.totalPagos);
  }

  get esVentaFiada(): boolean {
    return this.totalPagos < this.total;
  }

  get requiereCliente(): boolean {
    return this.esVentaFiada;
  }

  // ---------- mensajes ----------
  private autoHide(ms = 4000) {
    window.setTimeout(() => {
      this.okMsg = '';
      this.errorMsg = '';
    }, ms);
  }
  private showOk(msg: string) {
    this.okMsg = msg;
    this.errorMsg = '';
    this.autoHide();
  }
  private showError(msg: string) {
    this.errorMsg = msg;
    this.okMsg = '';
    this.autoHide();
  }

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
      const pu = Number(g.get('precioUnit')?.value || 0);

      if (!idp) return `Debes seleccionar el producto en la fila #${i + 1}.`;
      if (seen.has(idp))
        return `El producto de la fila #${i + 1} ya fue seleccionado en otra fila.`;
      seen.add(idp);

      if (!(qty >= 1 && qty <= 999_999))
        return `La cantidad de la fila #${i + 1} debe estar entre 1 y 999.999.`;
      if (!(pu >= 1 && pu <= 99_999_999))
        return `El precio unitario de la fila #${i + 1} debe estar entre 1 y 99.999.999.`;
    }

    const tot = this.total;
    if (!(tot >= 1 && tot <= Ventas.TOPE_TOTAL)) {
      return `El total de la venta no puede superar $ ${Ventas.TOPE_TOTAL.toLocaleString('es-CO')}.`;
    }

    // Validar pagos
    for (let i = 0; i < this.pagos.length; i++) {
      const g = this.pagos.at(i);
      const idMetodo = Number(g.get('id_metodo_pago')?.value);
      const monto = this.unmask(g.get('monto')?.value);

      if (!idMetodo) return `Debes seleccionar el método de pago en la fila #${i + 1}.`;
      if (!(monto >= 1 && monto <= 99_999_999))
        return `El monto del pago #${i + 1} debe estar entre 1 y 99.999.999.`;
    }

    // Validar que si es venta fiada, cliente_desc es obligatorio
    if (this.esVentaFiada) {
      const cliente = (this.form.get('cliente_desc')?.value || '').trim();
      if (!cliente) return 'Para ventas fiadas es obligatorio especificar el nombre del cliente.';
    }

    // Validar que el total de pagos no exceda el total de la venta (para ventas simples)
    if (!this.esVentaFiada && this.totalPagos > this.total) {
      const exceso = this.totalPagos - this.total;
      return `El total de pagos ($${this.totalPagos.toLocaleString('es-CO')}) excede el total de la venta ($${this.total.toLocaleString('es-CO')}) por $${exceso.toLocaleString('es-CO')}.`;
    }

    return '';
  }

  submit() {
    if (this.saving) return;

    const msg = this.validar();
    if (msg) {
      this.showError(`❌ ${msg}`);
      return;
    }

    const detalles = this.lineas.controls.map((g) => ({
      id_producto: Number(g.get('producto')?.value),
      cantidad: this.unmask(g.get('cantidad')?.value),
      precio_unitario: Number(g.get('precioUnit')?.value || 0),
    }));

    const pagos =
      this.pagos.length > 0
        ? this.pagos.controls.map((g) => ({
            id_metodo_pago: Number(g.get('id_metodo_pago')?.value),
            monto: this.unmask(g.get('monto')?.value),
            observaciones: (g.get('observaciones')?.value || '').trim() || null,
          }))
        : undefined;

    const clienteDesc = this.esVentaFiada
      ? (this.form.get('cliente_desc')?.value || '').trim() || null
      : null;
    const observaciones = (this.form.get('observaciones')?.value || '').trim() || null;
    const fechaVenta = this.form.get('fecha_venta')?.value || undefined;

    const body: any = { detalles };
    if (pagos && pagos.length > 0) body.pagos = pagos;
    if (clienteDesc) body.cliente_desc = clienteDesc;
    if (observaciones) body.observaciones = observaciones;
    if (fechaVenta) body.fecha_venta = fechaVenta;

    // 🔍 DEBUG: Ver qué se está enviando
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 BODY A ENVIAR AL BACKEND:');
    console.log(JSON.stringify(body, null, 2));
    console.log('📤 Detalles:', body.detalles);
    console.log('📤 Es array?', Array.isArray(body.detalles), '| Longitud:', body.detalles?.length);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    this.saving = true;
    this.clearViolations();

    this.ventasSrv
      .crear(body)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.autoHide();
        }),
      )
      .subscribe({
        next: (res: any) => {
          if (Array.isArray(res?.warnings) && res.warnings.length > 0) {
            console.warn('Warnings:', res.warnings);
          }
          this.showOk(res?.message || `Venta registrada (ID: ${res?.venta?.id_venta ?? ''})`);
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
            this.showError(
              '❌ No se puede registrar la venta: hay productos que quedarían bajo el mínimo.',
            );
          } else {
            this.showError(data?.message || data?.raw || 'Error al guardar la venta.');
          }
        },
      });
  }

  editar(v: Venta) {
    // NOTA: El backend no tiene funcionalidad de actualizar ventas por ahora
    this.showError('❌ La funcionalidad de editar ventas no está disponible actualmente.');
  }

  confirmarEliminar(id: number) {
    this.pendingDeleteId = id ?? null;
    this.motivoEliminacion = '';
    this.confirmOpen = true;
  }
  closeConfirm() {
    this.confirmOpen = false;
    this.pendingDeleteId = null;
    this.motivoEliminacion = '';
  }
  doEliminarConfirmado() {
    if (this.pendingDeleteId == null) {
      this.closeConfirm();
      return;
    }
    const id = this.pendingDeleteId;
    const motivo = this.motivoEliminacion.trim() || null;
    this.closeConfirm();

    this.ventasSrv.eliminar(id, motivo).subscribe({
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
          this.showError(
            '❌ No se puede eliminar la venta: los productos listados superarían el stock máximo.',
          );
        } else {
          this.showError(data?.message || data?.raw || 'Error al eliminar venta.');
        }
      },
    });
  }

  private resetForm() {
    this.form.reset({
      lineas: [],
      pagos: [],
      cliente_desc: '',
      observaciones: '',
      fecha_venta: this.today,
    });
    this.lineas.clear();
    this.pagos.clear();
    this.agregarLinea();
    this.clearViolations();
  }

  // ═══════════════════════════════════════════════════════════
  // 📦 HELPERS PARA PRODUCTOS EN TABLA
  // ═══════════════════════════════════════════════════════════

  getPrimerosProductos(venta: Venta): string {
    if (!venta.productos || venta.productos.length === 0) return '-';
    return venta.productos.slice(0, 2).join(', ');
  }

  getProductosAdicionales(venta: Venta): number {
    if (!venta.productos || venta.productos.length <= 2) return 0;
    return venta.productos.length - 2;
  }

  getProductosCompletos(venta: Venta): string {
    if (!venta.productos || venta.productos.length === 0) return 'Sin productos';
    return venta.productos.map((p) => `• ${p}`).join('\n');
  }

  // ═══════════════════════════════════════════════════════════
  // 💰 MODAL DE ABONOS
  // ═══════════════════════════════════════════════════════════

  abrirModalAbonos(venta: Venta): void {
    this.ventaSeleccionada = venta;
    this.mostrarModalAbonos = true;
  }

  cerrarModalAbonos(abonoRegistrado: boolean): void {
    this.mostrarModalAbonos = false;
    this.ventaSeleccionada = null;

    // Si se registró un abono, recargar la tabla para ver los cambios
    if (abonoRegistrado) {
      this.loadRows();
    }
  }
}

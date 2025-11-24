import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormGroup } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { ComprasService } from '../../../../shared/services/compras.service';
import { ProductosService } from '../../../../shared/services/productos.service';
import { AlertsService } from '../../../../shared/services/alerts.service';
import { Compra } from '../../../../shared/models/compra.model';
import { Producto } from '../../../../shared/models/producto.model';

@Component({
  standalone: true,
  selector: 'app-compras',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './compras.html',
})
export class Compras implements OnInit {
  private fb = inject(FormBuilder);
  private comprasSrv = inject(ComprasService);
  private productosSrv = inject(ProductosService);
  private alertsService = inject(AlertsService);

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

  form = this.fb.nonNullable.group({
    detalles: this.fb.array<FormGroup>([]),
    fecha_compra: [this.today, [Validators.required]],
    observaciones: ['' as string | null],
  });

  get detalles(): FormArray<FormGroup> {
    return this.form.get('detalles') as FormArray<FormGroup>;
  }

  private crearLineaCompra(): FormGroup {
    return this.fb.nonNullable.group({
      producto_id: ['', [Validators.required]],
      cantidad: [
        null as number | null,
        [Validators.required, Validators.min(1), Validators.max(999999)],
      ],
      costo_unitario: [
        { value: null as number | null, disabled: true },
        [Validators.required, Validators.min(0), Validators.max(99999999)],
      ],
    });
  }

  // ═══════════════════════════════════════════════════════════
  // GESTIÓN DE LÍNEAS DE COMPRA (FormArray)
  // ═══════════════════════════════════════════════════════════

  agregarLinea(): void {
    if (this.detalles.length >= 200) return;
    this.detalles.push(this.crearLineaCompra());
  }

  eliminarLinea(index: number): void {
    this.detalles.removeAt(index);
  }

  // Validar que no hay productos duplicados
  isProductoOcupado(idProducto: number, indexActual: number): boolean {
    if (!idProducto) return false;
    const idsSeleccionados = this.detalles.controls
      .map((g, idx) => (idx !== indexActual ? Number(g.get('producto_id')?.value) : null))
      .filter((id) => id && id > 0);
    return idsSeleccionados.includes(idProducto);
  }

  // Cuando se selecciona un producto en una línea
  onProductoChange(index: number): void {
    const linea = this.detalles.at(index);
    const productoId = Number(linea.get('producto_id')?.value);

    // Validar duplicados
    if (productoId && this.isProductoOcupado(productoId, index)) {
      linea.get('producto_id')?.setValue('');
      linea.get('costo_unitario')?.setValue(null);
      this.showInline('Este producto ya está seleccionado en otra línea.');
      return;
    }

    // Cargar precio de costo
    linea.get('costo_unitario')?.enable();

    if (!productoId) {
      linea.get('costo_unitario')?.setValue(null);
      linea.get('costo_unitario')?.disable();
      return;
    }

    const producto = this.productos.find((p) => p.id_producto === productoId);
    if (producto && producto.precio_costo != null) {
      const precioCosto = Math.floor(producto.precio_costo);
      linea.get('costo_unitario')?.setValue(precioCosto);
    } else {
      linea.get('costo_unitario')?.setValue(0);
    }

    linea.get('costo_unitario')?.disable();
  }

  // Calcular subtotal de una línea
  subtotal(index: number): number {
    const linea = this.detalles.at(index);
    const cantidad = Number(linea.get('cantidad')?.value || 0);
    const precio = Number(linea.getRawValue().costo_unitario || 0);
    return cantidad * precio;
  }

  // Total general
  get total(): number {
    return this.detalles.controls.reduce((acc, linea) => {
      const cantidad = Number(linea.get('cantidad')?.value || 0);
      const precio = Number(linea.getRawValue().costo_unitario || 0);
      return acc + cantidad * precio;
    }, 0);
  }

  ngOnInit(): void {
    this.loadProductos();
    this.loadData();
    // Inicializar con una línea en blanco
    this.agregarLinea();
  }

  private toTodayISO(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // helpers máscara
  private onlyDigits(s: string) {
    return (s || '').replace(/\D/g, '');
  }
  private clampDigits(s: string, maxLen: number) {
    return this.onlyDigits(s).slice(0, maxLen);
  }
  private withThousands(digits: string) {
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // auto-hide mensajes
  private autoHideMessages(ms = 4000) {
    window.setTimeout(() => {
      this.okMsg = '';
      this.errorMsg = '';
      this.errorMsgInline = '';
    }, ms);
  }

  private showOk(msg: string) {
    this.okMsg = msg;
    this.errorMsg = '';
    this.errorMsgInline = '';
    this.autoHideMessages();
  }

  private showError(msg: string) {
    this.errorMsg = msg;
    this.okMsg = '';
    this.autoHideMessages();
  }

  private showInline(msg: string) {
    this.errorMsgInline = msg;
    this.okMsg = '';
    this.errorMsg = '';
    this.autoHideMessages();
  }

  // enmascara y sincroniza con el form (para FormArray)
  onInputMasked(index: number, ctrl: 'cantidad' | 'costo_unitario', maxLen: number, ev: Event) {
    const el = ev.target as HTMLInputElement;
    const digits = this.clampDigits(el.value, maxLen);
    const masked = this.withThousands(digits);
    el.value = masked;

    const linea = this.detalles.at(index);
    linea.get(ctrl)?.setValue(digits ? Number(digits) : null);
    linea.get(ctrl)?.markAsTouched();
    this.errorMsgInline = '';
  }

  loadProductos() {
    this.productosSrv.listar().subscribe({
      next: (rows) => (this.productos = rows || []),
      error: () => (this.productos = []),
    });
  }

  loadData() {
    this.comprasSrv.listar().subscribe({
      next: (rows) => (this.rows = rows || []),
      error: () => (this.rows = []),
    });
  }

  submit() {
    if (this.saving) return;

    // Validaciones locales
    if (this.detalles.length === 0) {
      return this.showInline('Debes agregar al menos un producto.');
    }

    // Validar cada detalle
    for (let i = 0; i < this.detalles.length; i++) {
      const detalle = this.detalles.at(i);
      const productoId = detalle.get('producto_id')?.value;
      const cantidad = detalle.get('cantidad')?.value;
      const precio = detalle.getRawValue().costo_unitario;

      if (!productoId) {
        return this.showInline(`Línea ${i + 1}: Debes seleccionar un producto.`);
      }
      if (!(cantidad && cantidad >= 1 && cantidad <= 999999)) {
        return this.showInline(`Línea ${i + 1}: La cantidad debe estar entre 1 y 999.999.`);
      }
      if (precio === null || precio < 0 || precio > 99999999) {
        return this.showInline(
          `Línea ${i + 1}: El precio unitario debe estar entre 0 y 99.999.999.`,
        );
      }
    }

    if (!this.form.value.fecha_compra) {
      return this.showInline('Debes seleccionar la fecha de compra.');
    }

    // Pasa validación → activar saving
    this.saving = true;
    this.okMsg = '';
    this.errorMsg = '';
    this.errorMsgInline = '';

    // Construir detalles para el backend
    const detalles = this.detalles.controls.map((detalle) => ({
      id_producto: Number(detalle.get('producto_id')?.value),
      cantidad: Math.floor(Number(detalle.get('cantidad')?.value) || 0),
      precio_unitario: Math.floor(detalle.getRawValue().costo_unitario || 0),
    }));

    const body = {
      detalles,
      fecha_compra: this.form.value.fecha_compra || undefined,
      observaciones: (this.form.value.observaciones || '').trim() || null,
    };

    const req$ =
      this.editando && this.editId != null
        ? this.comprasSrv.actualizar(this.editId, body)
        : this.comprasSrv.crear(body);

    req$
      .pipe(
        finalize(() => {
          this.saving = false;
        }),
      )
      .subscribe({
        next: (res) => {
          if (Array.isArray(res?.warnings) && res.warnings.length > 0) {
            console.warn('Warnings:', res.warnings);
            const warningsMsg = res.warnings.map((w: any) => w.mensaje || w.message).join('; ');
            this.showOk(
              `${res?.message || (this.editando ? 'Compra actualizada correctamente.' : 'Compra registrada correctamente.')} ${warningsMsg ? `(Advertencias: ${warningsMsg})` : ''}`,
            );
          } else {
            this.showOk(
              res?.message ||
                (this.editando
                  ? 'Compra actualizada correctamente.'
                  : `Compra registrada correctamente.${res?.compra?.id_compra ? ` (ID: ${res.compra.id_compra})` : ''}`),
            );
          }
          this.loadData();
          this.resetForm();
          this.alertsService.refresh(); // Refrescar alertas después de crear/editar compra
          window.dispatchEvent(new Event('dashboard:refresh')); // Refrescar dashboard
        },
        error: (e) => {
          const errorMessage = e?.error?.message || 'Error al guardar la compra.';
          if (e?.status === 400 || e?.status === 409) {
            this.showInline(errorMessage);
          } else {
            this.showError(errorMessage);
          }
        },
      });
  }

  editar(c: Compra) {
    this.editando = true;
    this.editId = c.id_compra ?? null;

    // Cargar detalles de la compra
    if (this.editId != null) {
      this.comprasSrv.obtenerPorId(this.editId).subscribe({
        next: (compraDetalle) => {
          const detalles = compraDetalle.detalles || [];

          if (detalles.length > 0) {
            // Limpiar detalles actuales
            this.detalles.clear();

            // Cargar cada detalle
            for (const detalle of detalles) {
              const linea = this.crearLineaCompra();
              const precioUnitario = Math.floor(Number(detalle.precio_unitario_compra) || 0);

              linea.get('producto_id')?.setValue(String(detalle.id_producto));
              linea
                .get('cantidad')
                ?.setValue(Math.floor(Number(detalle.cantidad_detalle_compra) || 0));

              // Habilitar temporalmente para asignar valor
              linea.get('costo_unitario')?.enable();
              linea.get('costo_unitario')?.setValue(precioUnitario);
              linea.get('costo_unitario')?.disable();

              this.detalles.push(linea);
            }

            // Cargar fecha y observaciones
            this.form.patchValue({
              fecha_compra: compraDetalle['fecha_compra']
                ? compraDetalle['fecha_compra'].split('T')[0]
                : this.today,
              observaciones: compraDetalle['observaciones'] || null,
            });
          } else {
            this.showError('La compra no tiene detalles.');
          }
        },
        error: (e) => {
          this.showError(e?.error?.message || 'Error al cargar los detalles de la compra.');
        },
      });
    }

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
    if (this.pendingDeleteId == null) {
      this.closeConfirm();
      return;
    }
    const id = this.pendingDeleteId;
    this.closeConfirm();

    this.comprasSrv
      .eliminar(id)
      .pipe(finalize(() => {}))
      .subscribe({
        next: (res) => {
          this.showOk(res?.message || 'Compra eliminada correctamente y stock revertido.');
          this.loadData();
          this.alertsService.refresh(); // Refrescar alertas después de eliminar compra
          window.dispatchEvent(new Event('dashboard:refresh')); // Refrescar dashboard
        },
        error: (e) => {
          const errorMessage = e?.error?.message || 'Error al eliminar compra.';
          // Si es un error de validación, mostrarlo inline
          if (e?.status === 400 || e?.status === 409) {
            this.showInline(errorMessage);
          } else {
            this.showError(errorMessage);
          }
        },
      });
  }

  // Bloquea tecleo/pegado si supera el límite de dígitos (cuenta solo números)
  onBeforeInputDigits(ev: InputEvent, index: number, maxLen: number) {
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

    // Limpiar detalles y agregar una línea vacía
    this.detalles.clear();
    this.agregarLinea();

    this.form.patchValue({
      fecha_compra: this.today,
      observaciones: null,
    });
  }

  // Formatea fecha del backend (YYYY-MM-DD) para mostrar
  formatFecha(fecha?: string | null): string {
    if (!fecha) return '-';
    try {
      const d = new Date(fecha);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch {
      return fecha;
    }
  }

  // Métodos para el tooltip de productos múltiples
  getPrimerosProductos(compra: Compra): string {
    if (!compra.detalles || compra.detalles.length === 0) return '-';
    return compra.detalles
      .slice(0, 2)
      .map((d) => `${d.nombre_producto} (${Math.floor(d.cantidad_detalle_compra || 0)})`)
      .join(', ');
  }

  getProductosAdicionales(compra: Compra): number {
    if (!compra.detalles || compra.detalles.length <= 2) return 0;
    return compra.detalles.length - 2;
  }

  getProductosCompletos(compra: Compra): string {
    if (!compra.detalles || compra.detalles.length === 0) return 'Sin productos';
    return compra.detalles
      .map((d) => `• ${d.nombre_producto} (${Math.floor(d.cantidad_detalle_compra || 0)})`)
      .join('\n');
  }
}

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
    costo_unitario: [{ value: null as number | null, disabled: true }, [Validators.required, Validators.min(0), Validators.max(99999999)]],
    fecha_compra: [this.today, [Validators.required]],
    observaciones: ['' as string | null]
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

  // Cuando se selecciona un producto, cargar automáticamente el precio de compra
  onProductoChange() {
    const productoId = this.form.value.producto_id;
    
    // Habilitar temporalmente el campo para poder actualizar su valor
    this.form.controls.costo_unitario.enable();
    
    if (!productoId) {
      // Si no hay producto seleccionado, limpiar el costo unitario
      this.form.controls.costo_unitario.setValue(null);
      this.costoMasked = '';
      this.form.controls.costo_unitario.disable();
      return;
    }

    const producto = this.productos.find(p => String(p.id_producto) === productoId);
    if (producto && producto.precio_costo != null) {
      const precioCosto = Math.floor(producto.precio_costo);
      this.form.controls.costo_unitario.setValue(precioCosto);
      this.costoMasked = this.withThousands(String(precioCosto));
    } else {
      // Si el producto no tiene precio_costo, dejar en 0
      this.form.controls.costo_unitario.setValue(0);
      this.costoMasked = '0';
    }
    
    // Deshabilitar nuevamente después de actualizar
    this.form.controls.costo_unitario.disable();
  }

  loadData() {
    this.comprasSrv.listar().subscribe({
      next: (rows) => this.rows = rows || [],
      error: () => this.rows = []
    });
  }

  submit() {
    if (this.saving) return;

    // Validaciones locales
    if (!this.form.value.producto_id) return this.showInline('Debes seleccionar un producto.');
    if (!(this.form.value.cantidad && this.form.value.cantidad >= 1 && this.form.value.cantidad <= 999999)) {
      return this.showInline('La cantidad debe ser un entero entre 1 y 999.999.');
    }
    // Obtener el valor del costo_unitario aunque esté deshabilitado
    const precioUnitario = this.form.getRawValue().costo_unitario ?? null;
    if (precioUnitario === null || precioUnitario < 0 || precioUnitario > 99999999) {
      return this.showInline('El precio unitario debe estar entre 0 y 99.999.999.');
    }
    if (!this.form.value.fecha_compra) return this.showInline('Debes seleccionar la fecha de compra.');

    // Pasa validación → activar saving
    this.saving = true;
    this.okMsg = '';
    this.errorMsg = '';
    this.errorMsgInline = '';

    // El backend espera detalles como array
    // Obtener el valor del costo_unitario aunque esté deshabilitado
    const costoUnitarioValue = this.form.getRawValue().costo_unitario;
    const body = {
      detalles: [{
        id_producto: Number(this.form.value.producto_id),
        cantidad: Math.floor(Number(this.form.value.cantidad) || 0),
        precio_unitario: Math.floor(costoUnitarioValue || 0)
      }],
      fecha_compra: this.form.value.fecha_compra || undefined, // Opcional, backend usa fecha actual si no se envía
      observaciones: (this.form.value.observaciones || '').trim() || null
    };

    const req$ = this.editando && this.editId != null
      ? this.comprasSrv.actualizar(this.editId, body)
      : this.comprasSrv.crear(body);

    req$
      .pipe(finalize(() => { this.saving = false; }))
      .subscribe({
        next: (res) => {
          if (Array.isArray(res?.warnings) && res.warnings.length > 0) {
            console.warn('Warnings:', res.warnings);
            // Mostrar warnings si existen
            const warningsMsg = res.warnings.map((w: any) => w.mensaje || w.message).join('; ');
            this.showOk(`${res?.message || (this.editando ? 'Compra actualizada correctamente.' : 'Compra registrada correctamente.')} ${warningsMsg ? `(Advertencias: ${warningsMsg})` : ''}`);
          } else {
            this.showOk(res?.message || (this.editando ? 'Compra actualizada correctamente.' : `Compra registrada correctamente.${res?.compra?.id_compra ? ` (ID: ${res.compra.id_compra})` : ''}`));
          }
          this.loadData();
          this.resetForm();
        },
        error: (e) => {
          const errorMessage = e?.error?.message || 'Error al guardar la compra.';
          // Si es un error de validación, mostrarlo inline
          if (e?.status === 400 || e?.status === 409) {
            this.showInline(errorMessage);
          } else {
            this.showError(errorMessage);
          }
        }
      });
  }

  editar(c: Compra) {
    this.editando = true;
    this.editId = c.id_compra ?? null;

    // Cargar detalles de la compra
    if (this.editId != null) {
      this.comprasSrv.obtenerPorId(this.editId).subscribe({
        next: (compraDetalle) => {
          // El formulario solo permite un producto, así que tomamos el primero
          const primerDetalle = compraDetalle.detalles?.[0];
          
          if (primerDetalle) {
            // Habilitar temporalmente el campo para poder actualizar su valor
            this.form.controls.costo_unitario.enable();
            this.form.patchValue({
              producto_id: String(primerDetalle.id_producto),
              cantidad: Math.floor(Number(primerDetalle.cantidad_detalle_compra) || 0),
              costo_unitario: Math.floor(Number(primerDetalle.precio_unitario_compra) || 0),
              fecha_compra: compraDetalle['fecha_compra'] ? compraDetalle['fecha_compra'].split('T')[0] : this.today,
              observaciones: compraDetalle['observaciones'] || null
            });
            // Deshabilitar nuevamente después de actualizar
            this.form.controls.costo_unitario.disable();

            // Aplicar máscaras
            this.cantidadMasked = this.withThousands(String(Math.floor(Number(primerDetalle.cantidad_detalle_compra) || 0)).replace(/\D/g, ''));
            this.costoMasked = this.withThousands(String(Math.floor(Number(primerDetalle.precio_unitario_compra) || 0)).replace(/\D/g, ''));
          } else {
            this.showError('La compra no tiene detalles.');
          }
        },
        error: (e) => {
          this.showError(e?.error?.message || 'Error al cargar los detalles de la compra.');
        }
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
    if (this.pendingDeleteId == null) { this.closeConfirm(); return; }
    const id = this.pendingDeleteId;
    this.closeConfirm();

    this.comprasSrv.eliminar(id)
      .pipe(finalize(() => {}))
      .subscribe({
        next: (res) => {
          this.showOk(res?.message || 'Compra eliminada correctamente y stock revertido.');
          this.loadData();
        },
        error: (e) => {
          const errorMessage = e?.error?.message || 'Error al eliminar compra.';
          // Si es un error de validación, mostrarlo inline
          if (e?.status === 400 || e?.status === 409) {
            this.showInline(errorMessage);
          } else {
            this.showError(errorMessage);
          }
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
    // Habilitar temporalmente para resetear
    this.form.controls.costo_unitario.enable();
    this.form.reset({
      producto_id: '',
      cantidad: null,
      costo_unitario: null,
      fecha_compra: this.today,
      observaciones: null
    });
    // Deshabilitar nuevamente después del reset
    this.form.controls.costo_unitario.disable();
    this.cantidadMasked = '';
    this.costoMasked = '';
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
}

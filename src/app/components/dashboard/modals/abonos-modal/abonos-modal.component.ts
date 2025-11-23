import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { Venta } from '../../../../shared/models/venta.model';
import { Abono } from '../../../../shared/models/abono.model';
import { VentasService } from '../../../../shared/services/ventas.service';
import { MetodosPagoService, MetodoPago } from '../../../../shared/services/metodos-pago.service';

@Component({
  selector: 'app-abonos-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './abonos-modal.component.html',
  styleUrls: ['./abonos-modal.component.scss'],
})
export class AbonosModalComponent implements OnInit {
  @Input() venta!: Venta;
  @Output() cerrar = new EventEmitter<boolean>(); // true si se registró un abono

  private fb = inject(FormBuilder);
  private ventasSrv = inject(VentasService);
  private metodosPagoSrv = inject(MetodosPagoService);

  abonos: Abono[] = [];
  metodosPago: MetodoPago[] = [];
  form!: FormGroup;
  loading = false;
  saving = false;
  errorMsg = '';
  okMsg = '';

  ngOnInit(): void {
    this.form = this.fb.group({
      id_metodo_pago: ['', Validators.required],
      monto: ['', [Validators.required, Validators.min(1)]],
      observaciones: [''],
    });

    this.cargarDatos();
  }

  cargarDatos(): void {
    this.loading = true;
    this.errorMsg = '';

    // Cargar historial de abonos y métodos de pago en paralelo
    Promise.all([
      this.ventasSrv.obtenerAbonos(this.venta.id_venta).toPromise(),
      this.metodosPagoSrv.listar().toPromise(),
    ])
      .then(([abonosRes, metodosRes]) => {
        this.abonos = abonosRes?.abonos || [];
        this.metodosPago = metodosRes || [];

        // Actualizar saldo de la venta con datos frescos
        if (abonosRes?.venta) {
          this.venta.saldo_pendiente = abonosRes.venta.saldo_pendiente;
          // Cast seguro del estado
          const nuevoEstado = abonosRes.venta.estado as 'PENDIENTE' | 'PAGADA' | 'CANCELADA';
          if (
            nuevoEstado === 'PENDIENTE' ||
            nuevoEstado === 'PAGADA' ||
            nuevoEstado === 'CANCELADA'
          ) {
            this.venta.estado = nuevoEstado;
          }
        }
      })
      .catch((error) => {
        console.error('Error al cargar datos:', error);
        this.errorMsg = 'Error al cargar el historial de abonos';
      })
      .finally(() => {
        this.loading = false;
      });
  }

  get porcentajePagado(): number {
    if (!this.venta.total || this.venta.total === 0) return 0;
    const pagado = this.venta.total - (this.venta.saldo_pendiente || 0);
    return Math.round((pagado / this.venta.total) * 100);
  }

  get montoPagado(): number {
    return this.venta.total - (this.venta.saldo_pendiente || 0);
  }

  // ═══════════════════════════════════════════════════════════
  // 💰 MÁSCARA DE DINERO
  // ═══════════════════════════════════════════════════════════

  getMasked(value: any): string {
    if (!value && value !== 0) return '';
    const num = Number(String(value).replace(/\D/g, ''));
    return num.toLocaleString('es-CO');
  }

  unmask(value: any): number {
    if (!value) return 0;
    return Number(String(value).replace(/\D/g, ''));
  }

  onInputMonto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/\D/g, '');
    const num = Number(raw);

    // Validar que no exceda el saldo pendiente
    const saldo = this.venta.saldo_pendiente || 0;
    if (num > saldo) {
      input.value = this.getMasked(saldo);
      this.form.patchValue({ monto: saldo.toString() });
    } else {
      input.value = this.getMasked(num);
      this.form.patchValue({ monto: raw });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 💾 GUARDAR ABONO
  // ═══════════════════════════════════════════════════════════

  registrarAbono(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const monto = this.unmask(this.form.value.monto);
    if (monto <= 0) {
      this.errorMsg = 'El monto debe ser mayor a $0';
      return;
    }

    if (monto > (this.venta.saldo_pendiente || 0)) {
      this.errorMsg = 'El monto no puede exceder el saldo pendiente';
      return;
    }

    const body = {
      id_metodo_pago: Number(this.form.value.id_metodo_pago),
      monto,
      observaciones: this.form.value.observaciones?.trim() || null,
    };

    this.saving = true;
    this.errorMsg = '';
    this.okMsg = '';

    this.ventasSrv
      .registrarAbono(this.venta.id_venta, body)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (res) => {
          const nuevoSaldo = res.venta?.saldo_nuevo || 0;
          this.okMsg =
            res.message ||
            `Abono registrado. Saldo restante: $${nuevoSaldo.toLocaleString('es-CO')}`;

          // Esperar 1.5 segundos para que el usuario vea el mensaje
          setTimeout(() => {
            this.cerrar.emit(true); // true = se registró un abono
          }, 1500);
        },
        error: (e) => {
          this.errorMsg = e?.error?.message || 'Error al registrar el abono';
        },
      });
  }

  cerrarModal(): void {
    this.cerrar.emit(false); // false = no se registró abono
  }
}

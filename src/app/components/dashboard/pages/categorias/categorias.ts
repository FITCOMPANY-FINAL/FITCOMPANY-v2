import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CategoriasService } from '../../../../shared/services/categorias.service';
import { Categoria } from '../../../../shared/models/categoria.model';

@Component({
  standalone: true,
  selector: 'app-categorias',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './categorias.html',
  styleUrl: './categorias.scss'
})
export class Categorias implements OnInit {
  private fb = inject(FormBuilder);
  private categoriasSrv = inject(CategoriasService);

  rows: Categoria[] = [];
  loadingList = false;

  saving = false;
  okMsg = '';
  errorMsg = '';

  // Form
  form = this.fb.nonNullable.group({
    nombre_categoria: ['', [Validators.required, Validators.maxLength(100)]],
    descripcion_categoria: ['', [Validators.maxLength(255)]],
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
    this.categoriasSrv.listar().subscribe({
      next: (rows) => { this.rows = rows || []; this.loadingList = false; },
      error: () => { this.rows = []; this.loadingList = false; this.showError('Error cargando categorías'); }
    });
  }

  // --- crear / actualizar ---
  submit() {
    if (this.saving) return;

    // sanitizar
    const nombre = (this.form.value.nombre_categoria || '').trim().replace(/\s+/g, ' ');
    const desc   = (this.form.value.descripcion_categoria || '').trim().replace(/\s+/g, ' ');

    // validaciones (las tuyas)
    if (!nombre) return this.showError('El nombre es obligatorio.');
    const PATRON = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s\-.]+$/;
    if (!PATRON.test(nombre)) return this.showError('El nombre solo puede contener letras, espacios, guiones y puntos.');
    if (nombre.length > 100) return this.showError('El nombre admite máximo 100 caracteres.');
    if (desc.length > 200) return this.showError('La descripción admite máximo 200 caracteres.');

    this.saving = true;
    this.okMsg = '';
    this.errorMsg = '';

    const body = { nombre_categoria: nombre, descripcion_categoria: desc };
    const req$ = (this.editando && this.editId != null)
      ? this.categoriasSrv.actualizar(this.editId, body)
      : this.categoriasSrv.crear(body);

    req$
      .pipe(finalize(() => { this.saving = false; }))
      .subscribe({
        next: (res) => {
          this.showOk(res?.message || (this.editando ? 'Categoría actualizada.' : 'Categoría creada.'));
          this.loadData();
          this.editando = false;
          this.editId = null;
          this.form.reset({ nombre_categoria: '', descripcion_categoria: '' });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        error: (e) => {
          this.showError(e?.error?.message || 'Error al guardar la categoría.');
        }
      });
  }

  // --- edición ---
  editar(c: Categoria) {
    this.editando = true;
    this.editId = c.id_categoria ?? null;
    this.form.patchValue({
      nombre_categoria: c.nombre_categoria ?? '',
      descripcion_categoria: c.descripcion_categoria ?? ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion() {
    this.editando = false;
    this.editId = null;
    this.form.reset({ nombre_categoria: '', descripcion_categoria: '' });
  }

  // --- confirmación estilizada ---
  confirmarEliminar(c: Categoria) {
    this.pendingDeleteId = c.id_categoria ?? null;
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

    this.categoriasSrv.eliminar(id).subscribe({
      next: (res) => {
        this.showOk(res?.message || 'Categoría eliminada correctamente.');
        this.loadData();
      },
      error: (e) => {
        // == detalle 409: igual que en React (lista de productos + sufijo) ==
        if (e?.status === 409 && e?.error) {
          const err = e.error as {
            message?: string;
            requiresUpdateProducts?: boolean;
            productos?: string[];
            totalProductos?: number;
            truncated?: boolean;
          };

          if (err.requiresUpdateProducts) {
            const baseMsg =
              err.message ||
              'No se puede eliminar la categoría porque está en uso por producto(s). Debes editar esos productos y cambiar la categoría antes de eliminarla.';

            const lista = (err.productos || []).map(n => `• ${n}`).join('\n');
            const sufijo =
              err.truncated && err.totalProductos
                ? `\n\n(Se muestran solo algunos; total: ${err.totalProductos})`
                : '';

            this.showError(`${baseMsg}\n\n${lista}${sufijo}`);
            return;
          }
        }

        // otros errores
        this.showError(e?.error?.message || 'Error eliminando la categoría.');
      }
    });
  }
}

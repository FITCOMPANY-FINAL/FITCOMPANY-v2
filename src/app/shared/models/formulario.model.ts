export interface PermisosMod {
  crear: 'S' | 'N';
  leer: 'S' | 'N';
  actualizar: 'S' | 'N';
  eliminar: 'S' | 'N';
}

export interface FormularioMod {
  codigo: number;        // ej. 201, 301, 101...
  titulo: string;        // ej. "Categorías"
  url: string | null;    // ej. "/dashboard/categorias" o null si es padre
  es_padre: 0 | 1;
  orden: number;
  padre: number | null;  // id del padre si aplica
  permisos: PermisosMod; // { crear: 'S', leer: 'S', ... }
}

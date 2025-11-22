export interface PermisosMod {
  crear: 'S' | 'N';
  leer: 'S' | 'N';
  actualizar: 'S' | 'N';
  eliminar: 'S' | 'N';
}

export interface FormularioMod {
  id: number;            // id_formulario del backend
  titulo: string;        // ej. "Categorías"
  url: string | null;    // ej. "/dashboard/categorias" o null si es padre
  es_padre: boolean;     // true si es padre, false si es hijo
  orden: number;
  padre: number | null;  // id del padre si aplica
  permisos: {
    crear: boolean;
    leer: boolean;
    actualizar: boolean;
    eliminar: boolean;
  };
}

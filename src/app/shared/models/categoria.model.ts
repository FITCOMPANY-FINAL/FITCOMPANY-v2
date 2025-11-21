export interface Categoria {
  id_categoria: number;
  nombre_categoria: string;
  descripcion_categoria: string;
  activa?: boolean;
  estado?: 'A' | 'I';
}

export interface Producto {
  id_producto: number;
  nombre_producto: string;
  descripcion_producto?: string;
  precio_unitario: number;
  stock_actual: number;
  stock_minimo: number;
  stock_maximo: number;
  unidad_medida: number;
  nombre_unidad_medida: string;
  categoria: number;
  nombre_categoria: string;
  fecha_creacion?: string;
}

export interface CompraDetalle {
  nombre_producto: string;
  cantidad_detalle_compra: number;
}

export interface Compra {
  id_compra: number;
  fecha_compra: string;
  total: number;
  observaciones?: string | null;
  creado_en?: string;
  nombre_usuario: string;
  email_usuario: string;
  abreviatura_tipo_identificacion: string;
  identificacion_usuario: string;
  detalles?: CompraDetalle[];
}

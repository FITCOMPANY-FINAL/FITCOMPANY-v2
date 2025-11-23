export interface Venta {
  id_venta: number;
  folio?: string;
  fecha: string;
  total: number;
  usuario: string;
  tipo_id?: number;
  // Campos de ventas fiadas
  cliente_desc?: string | null;
  estado?: 'PENDIENTE' | 'PAGADA' | 'CANCELADA';
  saldo_pendiente?: number;
  es_fiado?: boolean;
  observaciones?: string | null;
  // Campos de soft delete
  activo?: boolean;
  eliminado_en?: string | null;
  eliminado_por?: string | null;
}

export interface VentaDetalleItem {
  id_producto: number;
  cantidad: number;
  precio_unitario: number;
  nombre?: string;
}

export interface Venta {
  id_venta: number;
  fecha: string;
  total: number;
  usuario: string;
  tipo_id?: number; // Opcional, viene del backend pero no se usa en el frontend
}

export interface VentaDetalleItem {
  id_producto: number;
  cantidad: number;
  precio_unitario: number;
  nombre?: string;
}

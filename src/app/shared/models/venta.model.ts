export interface Venta {
  id_venta: number;
  fecha: string;
  total: number;
  usuario: string;
}

export interface VentaDetalleItem {
  id_producto: number;
  cantidad: number;
  precio_unitario: number;
  nombre?: string;
}

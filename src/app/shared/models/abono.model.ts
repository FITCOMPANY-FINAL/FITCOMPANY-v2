export interface Abono {
  id_venta_pago: number;
  fecha_pago: string;
  monto: number;
  metodo_pago: string;
  observaciones?: string | null;
}

export interface AbonosResponse {
  ok: boolean;
  total: number;
  abonos: Abono[];
  venta: {
    id_venta: number;
    folio?: string;
    es_fiado: boolean;
    total: number;
    saldo_pendiente: number;
    estado: string;
  };
}

export interface Compra {
  id_compra: number;
  cantidad: number;
  costo_unitario: number;
  costo_total?: number;
  fecha: string;           
  producto: number;         
  usuario: string;
  tipo_id: number;
  producto_nombre: string;
}

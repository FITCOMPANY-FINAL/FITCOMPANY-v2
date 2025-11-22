import { FormularioMod } from './formulario.model';

export interface TokenPayload {
  // Campos del JWT del backend
  tipo_id?: number;
  identificacion?: string;
  nombres?: string;
  apellido1?: string;
  apellido2?: string;
  email?: string;
  id_rol?: number;
  nombre_rol?: string;
  tipo_identificacion?: string;
  formularios: FormularioMod[];
  iat?: number;
  exp?: number;
  // Campos legacy (compatibilidad)
  tipo?: number;
  correo?: string;
  rol?: string;
  nombre?: string;
}

import { FormularioMod } from './formulario.model';

export interface TokenPayload {
  // campos que vienen en tu JWT de login exitoso
  tipo?: number;
  identificacion?: string;
  nombre?: string;
  apellido1?: string;
  apellido2?: string;
  correo?: string;
  rol?: string;
  perfil_id?: number;
  perfil_rol?: number;
  formularios: FormularioMod[];
  iat?: number;
  exp?: number;
}

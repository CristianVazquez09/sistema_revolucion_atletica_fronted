export enum ModalidadPaquete {
  INDIVIDUAL = 'INDIVIDUAL',
  DUO = 'DUO',
  TRIO = 'TRIO',
  SQUAD = 'SQUAD',
}

export function cantidadRequeridaModalidad(modalidad?: ModalidadPaquete | string | null): number {
  switch (modalidad) {
    case ModalidadPaquete.DUO: return 2;
    case ModalidadPaquete.TRIO: return 3;
    case ModalidadPaquete.SQUAD: return 5;
    case ModalidadPaquete.INDIVIDUAL:
    default:
      return 1;
  }
}

export function labelModalidadPaquete(modalidad?: ModalidadPaquete | string | null): string {
  switch (modalidad) {
    case ModalidadPaquete.DUO: return 'DUO (2 personas)';
    case ModalidadPaquete.TRIO: return 'TRIO (3 personas)';
    case ModalidadPaquete.SQUAD: return 'SQUAD (5 personas)';
    case ModalidadPaquete.INDIVIDUAL:
    default:
      return 'INDIVIDUAL (1 persona)';
  }
}

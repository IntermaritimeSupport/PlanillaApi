/**
 * Utilidades de prorrateo de planilla
 *
 * Reglas del sistema:
 * - Quincena 1: días 1–15 del mes
 * - Quincena 2: días 16–fin del mes
 * - Si el empleado ingresó DENTRO del período, se calculan los días trabajados proporcionales.
 * - Si ingresó ANTES del período, trabaja el período completo.
 * - Nunca se generan planillas para períodos ANTERIORES a la fecha de ingreso.
 */

export type ContractType = 'HOURS_48' | 'HOURS_40' | 'HOURS_36' | 'HALF_TIME';

/** Días laborables por quincena según tipo de contrato (Panamá) */
export const CONTRACT_WORKING_DAYS: Record<ContractType, { perQuincena: number; perMonth: number }> = {
  HOURS_48:  { perQuincena: 13, perMonth: 26 }, // 6 días/sem → ~26 días/mes
  HOURS_40:  { perQuincena: 11, perMonth: 22 }, // 5 días/sem → ~22 días/mes
  HOURS_36:  { perQuincena: 10, perMonth: 20 }, // 4.5 días/sem → ~20 días/mes
  HALF_TIME: { perQuincena: 8,  perMonth: 16 }, // Medio tiempo → ~16 días/mes
};

/**
 * Retorna el rango de fechas de una quincena
 * quincena 1 → días 1-15
 * quincena 2 → días 16-último día del mes
 */
export function getQuincenaPeriod(year: number, month: number, quincena: 1 | 2): { start: Date; end: Date } {
  if (quincena === 1) {
    return {
      start: new Date(year, month - 1, 1),
      end:   new Date(year, month - 1, 15),
    };
  } else {
    const lastDay = new Date(year, month, 0).getDate();
    return {
      start: new Date(year, month - 1, 16),
      end:   new Date(year, month - 1, lastDay),
    };
  }
}

export interface ProrateResult {
  workingDays: number;  // días totales del período según contrato
  daysWorked: number;   // días que aplican al empleado (proporcional si aplica)
  isProrrated: boolean; // true si se aplicó prorrateo
  hireDateInPeriod: boolean; // true si hireDate cayó dentro del período
}

/**
 * Calcula los días trabajados para una quincena dado el tipo de contrato y la fecha de ingreso.
 * Si hireDate es POSTERIOR al período → el empleado NO debe aparecer (daysWorked = 0).
 * Si hireDate cae DENTRO del período → prorrateo proporcional.
 * Si hireDate es ANTERIOR al período → período completo.
 */
export function calcProrateForQuincena(
  hireDate: Date,
  year: number,
  month: number,
  quincena: 1 | 2,
  contractType: ContractType,
): ProrateResult {
  const { start, end } = getQuincenaPeriod(year, month, quincena);
  const workingDays = CONTRACT_WORKING_DAYS[contractType]?.perQuincena ?? 13;

  // Normalizar hireDate a medianoche para comparación de fechas
  const hire = new Date(hireDate);
  hire.setHours(0, 0, 0, 0);
  const periodStart = new Date(start);
  periodStart.setHours(0, 0, 0, 0);
  const periodEnd = new Date(end);
  periodEnd.setHours(0, 0, 0, 0);

  // Empleado ingresa DESPUÉS del período → no aplica
  if (hire > periodEnd) {
    return { workingDays, daysWorked: 0, isProrrated: false, hireDateInPeriod: false };
  }

  // Empleado ingresa DENTRO del período → proporcional
  if (hire >= periodStart && hire <= periodEnd) {
    const totalDaysInPeriod = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1;
    const daysFromHire      = Math.round((periodEnd.getTime() - hire.getTime()) / 86400000) + 1;
    // Proporcionar: daysWorked = workingDays * (daysFromHire / totalDaysInPeriod)
    const daysWorked = Math.max(1, Math.round(workingDays * daysFromHire / totalDaysInPeriod));
    return { workingDays, daysWorked, isProrrated: true, hireDateInPeriod: true };
  }

  // Ingresó antes del período → período completo
  return { workingDays, daysWorked: workingDays, isProrrated: false, hireDateInPeriod: false };
}

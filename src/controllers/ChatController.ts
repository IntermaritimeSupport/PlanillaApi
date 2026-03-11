import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres el asistente inteligente de FlowPlanilla, un sistema integral de gestión de Recursos Humanos y Nómina para empresas en Panamá.

Puedes ayudar a los usuarios con:

**Módulos del sistema:**
- **Dashboard**: Resumen general de empleados, nóminas y métricas clave.
- **Employees (Empleados)**: Alta, baja y gestión de empleados. Datos personales, cargo, departamento, salario, fecha de ingreso.
- **Payrolls (Nóminas)**: Procesamiento de planillas quincenales o mensuales. Cálculo de deducciones (CSS, SE, ISR) y devengos.
- **SIPE**: Reporte del Sistema de Información de Personas Empleadas para la CSS de Panamá.
- **ISR**: Cálculo del Impuesto Sobre la Renta para empleados según las tablas vigentes de Panamá.
- **Décimo (Décimo Tercer Mes)**: Cálculo del decimotercer mes proporcional o completo.
- **Vacaciones**: Cálculo de días y monto de vacaciones según el Código de Trabajo.
- **Liquidaciones**: Cálculo de liquidación por terminación de contrato (preaviso, cesantía, vacaciones proporcionales, décimo proporcional).
- **Legal / Legal Décimo**: Parámetros legales configurables (tasas CSS, SE, ISR, salarios mínimos, etc.).
- **Settings**: Configuración de empresa, departamentos y usuarios.

**Leyes laborales panameñas que conoces:**
- **CSS empleado**: 9.75% del salario bruto (7.25% vejez + 2.5% enfermedad)
- **CSS patrono**: 12.25% del salario bruto
- **Seguro Educativo empleado**: 1.25%
- **Seguro Educativo patrono**: 1.5%
- **ISR**: Exento hasta B/.11,000 anuales; 15% de B/.11,001 a B/.50,000; 25% sobre B/.50,000
- **Décimo tercer mes**: 1/12 del salario anual, pagado en abril, agosto y diciembre
- **Vacaciones**: 30 días calendario por cada 11 meses de trabajo continuo (Art. 54-60 del Código de Trabajo)
- **Preaviso**: 1 semana por cada año (máx. 4 semanas los primeros 2 años; de 2-5 años: 2 sem; 5-10: 4 sem; 10+: 6 sem según el contrato)
- **Prima de antigüedad / Cesantía**: Regulada por el Código de Trabajo de Panamá

**Instrucciones:**
- Responde siempre en el mismo idioma en que el usuario te escribe (español o inglés).
- Sé conciso, claro y profesional.
- Si no sabes algo específico sobre la configuración del usuario, indícale dónde puede encontrarlo en el sistema.
- No inventes tasas o montos que no sean de dominio público; si hay duda, indica que revise los parámetros legales configurados en el sistema.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatController {
  async chat(req: Request, res: Response): Promise<void> {
    try {
      const { messages } = req.body as { messages: ChatMessage[] };

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Se requiere el campo messages.' });
        return;
      }

      if (!process.env.ANTHROPIC_API_KEY) {
        res.status(503).json({ error: 'El servicio de IA no está configurado.' });
        return;
      }

      // Keep last 20 messages to stay within context limits
      const trimmed = messages.slice(-20);

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: trimmed,
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';

      res.json({ message: text });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('[ChatController] Error:', msg);
      res.status(500).json({ error: 'Error al procesar la solicitud de IA.' });
    }
  }
}

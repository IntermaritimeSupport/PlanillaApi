import { Request, Response } from 'express'
import Groq from 'groq-sdk'
import { PrismaClient } from '../../generated/prisma/index.js'

const prisma = new PrismaClient()

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── Construye el contexto real de la DB ──────────────────────────────────────
async function buildDbContext(companyId: string): Promise<string> {
  try {
    const [company, employees, payrollRuns, leaves, legalParams] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, ruc: true, email: true, phone: true },
      }),

      prisma.employee.findMany({
        where: { companyId },
        select: {
          firstName: true,
          lastName: true,
          cedula: true,
          position: true,
          department: true,
          salary: true,
          salaryType: true,
          status: true,
          hireDate: true,
        },
        orderBy: { firstName: 'asc' },
      }),

      prisma.payrollRun.findMany({
        where: { companyId },
        orderBy: { periodDate: 'desc' },
        take: 6,
        select: {
          periodDate: true,
          quincena: true,
          status: true,
          totalGross: true,
          totalNet: true,
          totalDeductions: true,
          payrollType: true,
          _count: { select: { payrolls: true } },
        },
      }),

      prisma.leave.findMany({
        where: { companyId },
        orderBy: { startDate: 'desc' },
        take: 20,
        select: {
          leaveType: true,
          startDate: true,
          endDate: true,
          daysRequested: true,
          status: true,
          isPaid: true,
          employee: { select: { firstName: true, lastName: true } },
        },
      }),

      prisma.legalParameter.findMany({
        where: { companyId, status: 'active' },
        select: { key: true, name: true, percentage: true, minRange: true, maxRange: true },
        orderBy: { key: 'asc' },
      }),
    ])

    const lines: string[] = []

    // Empresa
    if (company) {
      lines.push(`## Empresa: ${company.name}`)
      if (company.ruc) lines.push(`RUC: ${company.ruc}`)
    }

    // Resumen empleados
    const active = employees.filter(e => e.status === 'ACTIVE').length
    const inactive = employees.filter(e => e.status !== 'ACTIVE').length
    lines.push(`\n## Empleados (${employees.length} total, ${active} activos, ${inactive} inactivos)`)

    employees.forEach(e => {
      const salario = `B/.${Number(e.salary).toFixed(2)} ${e.salaryType === 'BIWEEKLY' ? 'quincenal' : 'mensual'}`
      const ingreso = new Date(e.hireDate).toLocaleDateString('es-PA')
      lines.push(
        `- ${e.firstName} ${e.lastName} | Cédula: ${e.cedula} | ${e.position}${e.department ? ` / ${e.department}` : ''} | ${salario} | Estado: ${e.status} | Ingresó: ${ingreso}`
      )
    })

    // Nóminas recientes
    if (payrollRuns.length > 0) {
      lines.push(`\n## Últimas nóminas procesadas`)
      payrollRuns.forEach(r => {
        const mes = new Date(r.periodDate).toLocaleDateString('es-PA', { month: 'long', year: 'numeric' })
        lines.push(
          `- ${mes} Q${r.quincena} | Estado: ${r.status} | ${r._count.payrolls} empleados | Bruto: B/.${Number(r.totalGross).toFixed(2)} | Neto: B/.${Number(r.totalNet).toFixed(2)}`
        )
      })
    }

    // Vacaciones/Permisos recientes
    if (leaves.length > 0) {
      lines.push(`\n## Permisos y vacaciones recientes`)
      leaves.forEach(l => {
        const desde = new Date(l.startDate).toLocaleDateString('es-PA')
        const hasta = new Date(l.endDate).toLocaleDateString('es-PA')
        lines.push(
          `- ${l.employee.firstName} ${l.employee.lastName} | ${l.leaveType} | ${desde}–${hasta} (${l.daysRequested}d) | Estado: ${l.status}${l.isPaid ? ' | Pagado' : ''}`
        )
      })
    }

    // Parámetros legales
    if (legalParams.length > 0) {
      lines.push(`\n## Parámetros legales configurados`)
      legalParams.forEach(p => {
        const rango = p.minRange != null ? ` (${p.minRange}–${p.maxRange ?? '∞'})` : ''
        lines.push(`- ${p.name}: ${p.percentage}%${rango}`)
      })
    }

    return lines.join('\n')
  } catch (err) {
    console.error('[ChatController] Error consultando DB:', err)
    return '(No se pudo cargar el contexto de la base de datos)'
  }
}

// ─── System prompt base ───────────────────────────────────────────────────────
const BASE_SYSTEM = `Eres el asistente inteligente de FlowPlanilla, un sistema integral de gestión de Recursos Humanos y Nómina para empresas en Panamá.

**Capacidades:**
- Responder preguntas sobre empleados, nóminas, vacaciones, permisos y liquidaciones de la empresa del usuario.
- Calcular o explicar deducciones: CSS (9.75% emp / 13.25% pat), Seguro Educativo (1.25% emp / 1.5% pat), ISR (exento <B/.11,000; 15% hasta B/.50,000; 25% sobre B/.50,000).
- Explicar módulos: Décimo Tercer Mes, SIPE, ISR, Liquidaciones, Legal.
- Orientar al usuario sobre dónde encontrar información en el sistema.

**Reglas:**
- Usa SIEMPRE los datos reales de la empresa que aparecen en el contexto proporcionado.
- Si el usuario pregunta por un empleado específico, busca su nombre en los datos.
- Si preguntan totales o promedios, calcúlalos con los datos disponibles.
- Responde en el idioma en que el usuario escribe (español por defecto).
- Sé conciso, claro y profesional. No inventes datos que no estén en el contexto.
- Si algo no está en el contexto, dilo claramente e indica dónde buscarlo en el sistema.`

// ─── Controller ──────────────────────────────────────────────────────────────
export class ChatController {
  async chat(req: Request, res: Response): Promise<void> {
    try {
      const { messages, companyId } = req.body as {
        messages: ChatMessage[]
        companyId?: string
      }

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Se requiere el campo messages.' })
        return
      }

      if (!process.env.GROQ_API_KEY) {
        res.status(503).json({ error: 'El servicio de IA no está configurado.' })
        return
      }

      // Contexto real de la DB (si hay companyId)
      let dbContext = ''
      if (companyId) {
        dbContext = await buildDbContext(companyId)
      }

      const systemPrompt = dbContext
        ? `${BASE_SYSTEM}\n\n---\n# DATOS ACTUALES DE LA EMPRESA\n${dbContext}\n---`
        : BASE_SYSTEM

      const client = new Groq({ apiKey: process.env.GROQ_API_KEY })

      // Máximo 20 mensajes para no exceder el contexto
      const trimmed = messages.slice(-20)

      const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1024,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          ...trimmed,
        ],
      })

      const text = completion.choices[0]?.message?.content ?? ''
      res.json({ message: text })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('[ChatController] Error:', msg)
      res.status(500).json({ error: 'Error al procesar la solicitud de IA.' })
    }
  }
}

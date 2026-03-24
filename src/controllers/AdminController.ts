import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { hash } from 'bcryptjs';
import { UserRole } from '../../generated/prisma/index.js';

/**
 * AdminController — exclusivo para GLOBAL_ADMIN.
 * Accede a datos de TODAS las empresas sin filtro de companyId.
 * Las rutas que usan este controller deben estar protegidas con requireRole(['GLOBAL_ADMIN']).
 */

export class AdminController {

  // GET /api/admin/stats
  async getStats(req: Request, res: Response) {
    try {
      const [
        totalCompanies,
        totalUsers,
        totalEmployees,
        activeEmployees,
        totalPayrolls,
        totalDepartments,
      ] = await Promise.all([
        prisma.company.count(),
        prisma.user.count(),
        prisma.employee.count(),
        prisma.employee.count({ where: { status: 'ACTIVE' } }),
        prisma.payroll.count(),
        prisma.department.count(),
      ]);

      return res.json({
        totalCompanies,
        totalUsers,
        totalEmployees,
        activeEmployees,
        inactiveEmployees: totalEmployees - activeEmployees,
        totalPayrolls,
        totalDepartments,
      });
    } catch (error: unknown) {
      return res.status(500).json({
        error: 'Error al obtener estadísticas globales.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // GET /api/admin/companies
  async getCompanies(req: Request, res: Response) {
    try {
      const companies = await prisma.company.findMany({
        include: {
          _count: { select: { employees: true, users: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const result = companies.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        ruc: c.ruc,
        email: c.email,
        phone: c.phone,
        isActive: c.isActive,
        createdAt: c.createdAt,
        _count: { employees: c._count.employees, users: c._count.users },
      }));

      return res.json(result);
    } catch (error: unknown) {
      return res.status(500).json({
        error: 'Error al obtener empresas.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // GET /api/admin/users
  async getUsers(req: Request, res: Response) {
    try {
      const users = await prisma.user.findMany({
        include: {
          companies: {
            include: {
              company: { select: { id: true, name: true, code: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.json(users);
    } catch (error: unknown) {
      return res.status(500).json({
        error: 'Error al obtener usuarios.',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // POST /api/admin/companies — crea empresa y opcionalmente su SUPER_ADMIN
  async createCompany(req: Request, res: Response) {
    try {
      const { name, ruc, email, phone, address, superAdmin } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'El nombre de la empresa es obligatorio.' });
      }

      // Generar código único
      const last = await prisma.company.findFirst({ orderBy: { code: 'desc' } });
      const match = last?.code?.match(/\d+$/);
      const next = match ? parseInt(match[0], 10) + 1 : 1;
      const code = `CO${String(next).padStart(3, '0')}`;

      // Crear empresa
      const company = await prisma.company.create({
        data: { code, name, ruc: ruc || null, email: email || null, phone: phone || null, address: address || null, isActive: true },
      });

      // Si viene superAdmin, crear el usuario y vincularlo
      let superAdminUser = null;
      if (superAdmin?.email && superAdmin?.password && superAdmin?.username) {
        const passwordHash = await hash(superAdmin.password, 10);

        superAdminUser = await prisma.user.upsert({
          where:  { email: superAdmin.email.toLowerCase() },
          update: { role: UserRole.SUPER_ADMIN, isActive: true },
          create: {
            email:    superAdmin.email.toLowerCase(),
            username: superAdmin.username,
            password: passwordHash,
            role:     UserRole.SUPER_ADMIN,
            isActive: true,
          },
        });

        // Vincular a empresa
        await prisma.userCompany.upsert({
          where:  { userId_companyId: { userId: superAdminUser.id, companyId: company.id } },
          update: {},
          create: { userId: superAdminUser.id, companyId: company.id },
        });

        // Perfil de persona
        const lastPerson = await prisma.person.findFirst({ orderBy: { userCode: 'desc' } });
        const matchU = lastPerson?.userCode?.match(/\d+$/);
        const nextU = matchU ? parseInt(matchU[0], 10) + 1 : 1;
        const userCode = `USR${String(nextU).padStart(4, '0')}`;

        const existingPerson = await prisma.person.findUnique({ where: { userId: superAdminUser.id } });
        if (!existingPerson) {
          await prisma.person.create({
            data: {
              userId:       superAdminUser.id,
              firstName:    superAdmin.firstName || superAdmin.username,
              lastName:     superAdmin.lastName  || '',
              fullName:     `${superAdmin.firstName || superAdmin.username} ${superAdmin.lastName || ''}`.trim(),
              contactEmail: superAdmin.email.toLowerCase(),
              userCode,
              companyId:    company.id,
              status:       'Activo',
            },
          });
        }
      }

      return res.status(201).json({
        company,
        superAdmin: superAdminUser ? {
          id:       superAdminUser.id,
          email:    superAdminUser.email,
          username: superAdminUser.username,
          role:     superAdminUser.role,
        } : null,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if ((error as any)?.code === 'P2002') {
        return res.status(409).json({ error: 'Ya existe una empresa o usuario con esos datos.' });
      }
      return res.status(500).json({ error: 'Error al crear la empresa.', details: msg });
    }
  }

  // GET /api/admin/companies/:id
  async getCompany(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const company = await prisma.company.findUnique({
        where: { id },
        include: { _count: { select: { employees: true, users: true } } },
      });
      if (!company) return res.status(404).json({ error: 'Empresa no encontrada.' });
      return res.json(company);
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Error al obtener empresa.', details: error instanceof Error ? error.message : String(error) });
    }
  }

  // PUT /api/admin/companies/:id — editar empresa
  async updateCompany(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, ruc, email, phone, address, maxUsers, maxEmployees, isActive } = req.body;

      const company = await prisma.company.findUnique({ where: { id } });
      if (!company) return res.status(404).json({ error: 'Empresa no encontrada.' });

      const updated = await prisma.company.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(ruc !== undefined && { ruc: ruc || null }),
          ...(email !== undefined && { email: email || null }),
          ...(phone !== undefined && { phone: phone || null }),
          ...(address !== undefined && { address: address || null }),
          ...(maxUsers !== undefined && { maxUsers: Number(maxUsers) }),
          ...(maxEmployees !== undefined && { maxEmployees: Number(maxEmployees) }),
          ...(isActive !== undefined && { isActive }),
        },
      });
      return res.json(updated);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if ((error as any)?.code === 'P2002') return res.status(409).json({ error: 'Ya existe una empresa con ese nombre o RUC.' });
      return res.status(500).json({ error: 'Error al actualizar empresa.', details: msg });
    }
  }

  // GET /api/admin/users/:id
  async getUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          companies: { include: { company: { select: { id: true, name: true, code: true } } } },
          person: true,
        },
      });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
      return res.json(user);
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Error al obtener usuario.', details: error instanceof Error ? error.message : String(error) });
    }
  }

  // PUT /api/admin/users/:id — editar usuario admin
  async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { username, email, password, isActive, role, companyIds } = req.body;

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

      const data: any = {};
      if (username !== undefined) data.username = username;
      if (email !== undefined) data.email = email.toLowerCase();
      if (isActive !== undefined) data.isActive = isActive;
      if (role !== undefined) data.role = role;
      if (password) {
        const { hash } = await import('bcryptjs');
        data.password = await hash(password, 10);
      }

      const updated = await prisma.user.update({ where: { id }, data });

      // Si se pasan companyIds, sincronizar relaciones UserCompany
      if (Array.isArray(companyIds)) {
        await prisma.userCompany.deleteMany({ where: { userId: id } });
        if (companyIds.length > 0) {
          await prisma.userCompany.createMany({
            data: companyIds.map((companyId: string) => ({ userId: id, companyId })),
            skipDuplicates: true,
          });
        }
      }

      return res.json({ id: updated.id, email: updated.email, username: updated.username, role: updated.role, isActive: updated.isActive });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if ((error as any)?.code === 'P2002') return res.status(409).json({ error: 'Ya existe un usuario con ese email o username.' });
      return res.status(500).json({ error: 'Error al actualizar usuario.', details: msg });
    }
  }

  // PATCH /api/admin/companies/:id — activa o desactiva empresa
  async toggleCompany(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const company = await prisma.company.findUnique({ where: { id } });
      if (!company) return res.status(404).json({ error: 'Empresa no encontrada.' });

      const updated = await prisma.company.update({
        where: { id },
        data:  { isActive: !company.isActive },
      });
      return res.json({ id: updated.id, isActive: updated.isActive });
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Error al actualizar empresa.', details: error instanceof Error ? error.message : String(error) });
    }
  }

  // POST /api/admin/companies/:id/super-admin — asigna un SUPER_ADMIN a empresa existente
  async assignSuperAdmin(req: Request, res: Response) {
    try {
      const { id: companyId } = req.params;
      const { email, username, password, firstName, lastName } = req.body;

      if (!email || !username || !password) {
        return res.status(400).json({ error: 'email, username y password son obligatorios.' });
      }

      const company = await prisma.company.findUnique({ where: { id: companyId } });
      if (!company) return res.status(404).json({ error: 'Empresa no encontrada.' });

      const passwordHash = await hash(password, 10);

      const user = await prisma.user.upsert({
        where:  { email: email.toLowerCase() },
        update: { role: UserRole.SUPER_ADMIN, isActive: true },
        create: {
          email:    email.toLowerCase(),
          username,
          password: passwordHash,
          role:     UserRole.SUPER_ADMIN,
          isActive: true,
        },
      });

      await prisma.userCompany.upsert({
        where:  { userId_companyId: { userId: user.id, companyId } },
        update: {},
        create: { userId: user.id, companyId },
      });

      const existingPerson = await prisma.person.findUnique({ where: { userId: user.id } });
      if (!existingPerson) {
        const lastPerson = await prisma.person.findFirst({ orderBy: { userCode: 'desc' } });
        const matchU = lastPerson?.userCode?.match(/\d+$/);
        const nextU = matchU ? parseInt(matchU[0], 10) + 1 : 1;
        await prisma.person.create({
          data: {
            userId:       user.id,
            firstName:    firstName || username,
            lastName:     lastName  || '',
            fullName:     `${firstName || username} ${lastName || ''}`.trim(),
            contactEmail: email.toLowerCase(),
            userCode:     `USR${String(nextU).padStart(4, '0')}`,
            companyId,
            status:       'Activo',
          },
        });
      }

      return res.status(201).json({
        id:       user.id,
        email:    user.email,
        username: user.username,
        role:     user.role,
        companyId,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if ((error as any)?.code === 'P2002') {
        return res.status(409).json({ error: 'Ya existe un usuario con ese email o username.' });
      }
      return res.status(500).json({ error: 'Error al asignar super admin.', details: msg });
    }
  }

  // POST /api/admin/users — crear usuario admin (GLOBAL_ADMIN o SUPER_ADMIN)
  async createUser(req: Request, res: Response) {
    try {
      const { username, email, password, role, isActive, companyIds } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: 'username, email y password son obligatorios.' });
      }

      const allowedRoles = ['GLOBAL_ADMIN', 'SUPER_ADMIN'];
      if (role && !allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Rol no permitido.' });
      }

      const { hash } = await import('bcryptjs');
      const passwordHash = await hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email:    email.toLowerCase(),
          username,
          password: passwordHash,
          role:     (role ?? 'SUPER_ADMIN') as UserRole,
          isActive: isActive ?? true,
        },
      });

      if (Array.isArray(companyIds) && companyIds.length > 0) {
        await prisma.userCompany.createMany({
          data: companyIds.map((companyId: string) => ({ userId: user.id, companyId })),
          skipDuplicates: true,
        });
      }

      // Crear perfil de persona con userCode único
      const allCodes = await prisma.person.findMany({
        select: { userCode: true },
        where: { userCode: { startsWith: 'USR' } },
      });
      const maxNum = allCodes.reduce((max, p) => {
        const n = parseInt(p.userCode?.replace('USR', '') ?? '0', 10);
        return isNaN(n) ? max : Math.max(max, n);
      }, 0);
      await prisma.person.create({
        data: {
          userId:       user.id,
          firstName:    username,
          lastName:     '',
          fullName:     username,
          contactEmail: email.toLowerCase(),
          userCode:     `USR${String(maxNum + 1).padStart(4, '0')}`,
          status:       'Activo',
        },
      });

      return res.status(201).json({ id: user.id, email: user.email, username: user.username, role: user.role });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if ((error as any)?.code === 'P2002') return res.status(409).json({ error: 'Ya existe un usuario con ese email o username.' });
      return res.status(500).json({ error: 'Error al crear usuario.', details: msg });
    }
  }

  // DELETE /api/admin/companies/:id
  async deleteCompany(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const company = await prisma.company.findUnique({ where: { id } });
      if (!company) return res.status(404).json({ error: 'Empresa no encontrada.' });
      await prisma.company.delete({ where: { id } });
      return res.json({ ok: true });
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Error al eliminar empresa.', details: error instanceof Error ? error.message : String(error) });
    }
  }

  // DELETE /api/admin/users/:id
  async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
      await prisma.user.delete({ where: { id } });
      return res.json({ ok: true });
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Error al eliminar usuario.', details: error instanceof Error ? error.message : String(error) });
    }
  }

  // GET /api/admin/licenses — lista de SUPER_ADMINs con su licencia y uso real
  async getLicenses(req: Request, res: Response) {
    try {
      const users = await prisma.user.findMany({
        where: { role: { in: ['SUPER_ADMIN'] } },
        include: {
          license: true,
          companies: {
            include: {
              company: {
                include: { _count: { select: { employees: true, users: true } } },
              },
            },
          },
          person: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const result = users.map((u) => {
        const companyCount = u.companies.length;
        const totalEmployees = u.companies.reduce((s, uc) => s + uc.company._count.employees, 0);
        const totalUsers = u.companies.reduce((s, uc) => s + uc.company._count.users, 0);
        return {
          userId:       u.id,
          username:     u.username,
          email:        u.email,
          fullName:     u.person ? `${u.person.firstName ?? ''} ${u.person.lastName ?? ''}`.trim() : u.username,
          isActive:     u.isActive,
          createdAt:    u.createdAt,
          companyCount,
          totalEmployees,
          totalUsers,
          companies:    u.companies.map(uc => ({ id: uc.company.id, name: uc.company.name, code: uc.company.code, isActive: uc.company.isActive })),
          license:      u.license ?? null,
        };
      });

      return res.json(result);
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Error al obtener licencias.', details: error instanceof Error ? error.message : String(error) });
    }
  }

  // PUT /api/admin/licenses/:userId — crear o actualizar licencia de un SUPER_ADMIN
  async upsertLicense(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { plan, maxCompanies, maxUsers, maxEmployees, startsAt, expiresAt, isActive, notes } = req.body;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

      const expDate = expiresAt ? new Date(expiresAt) : null;
      const licenseActive = isActive !== undefined ? Boolean(isActive) : true;
      const isExpired = expDate ? expDate < new Date() : false;
      // Si la licencia se desactiva o vence → desactivar todas sus empresas
      const shouldDeactivate = !licenseActive || isExpired;

      const companyIds = shouldDeactivate
        ? (await prisma.userCompany.findMany({ where: { userId }, select: { companyId: true } })).map(uc => uc.companyId)
        : [];

      const ops: any[] = [
        prisma.license.upsert({
          where:  { userId },
          update: {
            ...(plan         !== undefined && { plan }),
            ...(maxCompanies !== undefined && { maxCompanies: Number(maxCompanies) }),
            ...(maxUsers     !== undefined && { maxUsers: Number(maxUsers) }),
            ...(maxEmployees !== undefined && { maxEmployees: Number(maxEmployees) }),
            ...(startsAt     !== undefined && { startsAt: new Date(startsAt) }),
            ...(expiresAt    !== undefined && { expiresAt: expDate }),
            ...(isActive     !== undefined && { isActive: licenseActive }),
            ...(notes        !== undefined && { notes: notes || null }),
          },
          create: {
            userId,
            plan:         plan         ?? 'TRIAL',
            maxCompanies: maxCompanies ? Number(maxCompanies) : 1,
            maxUsers:     maxUsers     ? Number(maxUsers)     : 5,
            maxEmployees: maxEmployees ? Number(maxEmployees) : 20,
            startsAt:     startsAt     ? new Date(startsAt)   : new Date(),
            expiresAt:    expDate,
            isActive:     licenseActive,
            notes:        notes || null,
          },
        }),
      ];

      if (companyIds.length > 0) {
        ops.push(
          prisma.company.updateMany({ where: { id: { in: companyIds } }, data: { isActive: false } })
        );
      } else if (licenseActive && !isExpired) {
        // Reactivar empresas si la licencia se reactiva
        ops.push(
          prisma.company.updateMany({
            where: { id: { in: (await prisma.userCompany.findMany({ where: { userId }, select: { companyId: true } })).map(uc => uc.companyId) } },
            data: { isActive: true },
          })
        );
      }

      const [license] = await prisma.$transaction(ops);
      return res.json({ ...license, companiesDeactivated: companyIds.length });
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Error al guardar licencia.', details: error instanceof Error ? error.message : String(error) });
    }
  }

  // POST /api/admin/licenses/check-expired — desactivar usuarios/empresas con licencia vencida
  async checkExpiredLicenses(req: Request, res: Response) {
    try {
      const now = new Date();

      const expired = await prisma.license.findMany({
        where: { isActive: true, expiresAt: { not: null, lt: now } },
        select: { userId: true },
      });

      if (expired.length === 0) return res.json({ deactivated: 0 });

      const userIds = expired.map(l => l.userId);

      // Obtener companyIds de esos usuarios
      const userCompanies = await prisma.userCompany.findMany({
        where: { userId: { in: userIds } },
        select: { companyId: true },
      });
      const companyIds = userCompanies.map(uc => uc.companyId);

      await prisma.$transaction([
        prisma.license.updateMany({ where: { userId: { in: userIds } }, data: { isActive: false } }),
        prisma.user.updateMany({ where: { id: { in: userIds } }, data: { isActive: false } }),
        ...(companyIds.length > 0 ? [prisma.company.updateMany({ where: { id: { in: companyIds } }, data: { isActive: false } })] : []),
      ]);

      return res.json({ deactivated: userIds.length, userIds, companyIds });
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Error al verificar licencias vencidas.', details: error instanceof Error ? error.message : String(error) });
    }
  }

  // POST /api/admin/companies/:id/super-admin-assign — vincular usuario existente a empresa
  async assignExistingUser(req: Request, res: Response) {
    try {
      const { id: companyId } = req.params;
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: 'userId es requerido.' });

      const [company, user] = await Promise.all([
        prisma.company.findUnique({ where: { id: companyId } }),
        prisma.user.findUnique({ where: { id: userId } }),
      ]);
      if (!company) return res.status(404).json({ error: 'Empresa no encontrada.' });
      if (!user)    return res.status(404).json({ error: 'Usuario no encontrado.' });

      await prisma.userCompany.upsert({
        where:  { userId_companyId: { userId, companyId } },
        update: {},
        create: { userId, companyId },
      });

      return res.json({ message: 'Usuario vinculado correctamente.', userId, companyId });
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Error al vincular usuario.', details: error instanceof Error ? error.message : String(error) });
    }
  }

  // GET /api/admin/users/search?email=xxx — buscar usuario por email para asignar
  async searchUserByEmail(req: Request, res: Response) {
    try {
      const { email } = req.query;
      if (!email || typeof email !== 'string') return res.status(400).json({ error: 'email es requerido.' });

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        select: {
          id: true, username: true, email: true, role: true, isActive: true,
          companies: { include: { company: { select: { id: true, name: true, code: true } } } },
        },
      });

      if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
      return res.json(user);
    } catch (error: unknown) {
      return res.status(500).json({ error: 'Error al buscar usuario.', details: error instanceof Error ? error.message : String(error) });
    }
  }
}

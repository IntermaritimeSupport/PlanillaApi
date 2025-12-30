import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { generateNextUserCode } from '../../prisma/seed.js';

// Define el orden jerárquico de roles
const ROLE_HIERARCHY: Record<string, number> = {
  USER: 1,
  ADMIN: 2,
  MODERATOR: 2,
  SUPER_ADMIN: 3,
};

export class UserController {
  // Función auxiliar para validar permisos basados en roles
  private async validateRolePermission(
    requestingUserId: string,
    targetUserId: string,
    action: 'edit' | 'delete'
  ): Promise<{ allowed: boolean; error?: string }> {
    const requestingUser = await prisma.user.findUnique({
      where: { id: requestingUserId },
    });

    if (!requestingUser) {
      return { allowed: false, error: 'Usuario no autenticado.' };
    }

    if (requestingUser.role === 'SUPER_ADMIN') {
      return { allowed: true };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return { allowed: false, error: 'Usuario objetivo no encontrado.' };
    }

    if (requestingUserId === targetUserId && action === 'delete') {
      return { allowed: false, error: 'No puedes eliminar tu propia cuenta.' };
    }

    const requestingRoleLevel = ROLE_HIERARCHY[requestingUser.role] || 0;
    const targetRoleLevel = ROLE_HIERARCHY[targetUser.role] || 0;

    if (requestingRoleLevel <= targetRoleLevel) {
      return {
        allowed: false,
        error: `No tienes permisos para ${action} un usuario del mismo rango o superior.`,
      };
    }

    return { allowed: true };
  }

  // Función para validar que exista al menos un SUPER_ADMIN
  private async validateSuperAdminExists(
    excludeUserId?: string
  ): Promise<boolean> {
    const superAdminCount = await prisma.user.count({
      where: {
        role: 'SUPER_ADMIN',
        ...(excludeUserId && { id: { not: excludeUserId } }),
      },
    });
    return superAdminCount > 0;
  }

  async Create(req: Request, res: Response) {
    const {
      username,
      email,
      password,
      role,
      companyIds, // Array de IDs de compañías
      firstName,
      lastName,
      contactEmail,
      phoneNumber,
      departmentId,
      position,
      userCode,
    } = req.body;

    const requestingUserId = (req as any).userId;

    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Username, email y password son obligatorios.',
      });
    }

    // Validación de compañías asignadas
    if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
      return res.status(400).json({
        error: 'Debe asignar al menos una compañía al usuario.',
      });
    }

    try {
      // Validar permisos solo si se especifica un rol elevado
      if (role && role !== 'USER' && requestingUserId) {
        // La validación de permisos en Create debería usar un 'dummy-id' o validar 
        // solo el rol del usuario que solicita la creación si no está creando un SUPER_ADMIN
        const permissionCheck = await this.validateRolePermission(
          requestingUserId,
          'dummy-id', // ID temporal para chequear solo el permiso de 'edit' o 'create' de rol
          'edit'
        );
        // Si el usuario no es Super Admin, se valida si tiene nivel para crear el rol solicitado
        const requestingUserRoleLevel = ROLE_HIERARCHY[(await prisma.user.findUnique({ where: { id: requestingUserId } }))?.role || 'USER'] || 0;
        const targetRoleLevel = ROLE_HIERARCHY[role] || 0;
        
        if (!permissionCheck.allowed || requestingUserRoleLevel <= targetRoleLevel) {
          return res.status(403).json({
            error: 'No tienes permisos para asignar el rol especificado.',
          });
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUserCode = userCode || await generateNextUserCode();

      // Crear usuario y las relaciones con múltiples compañías (Corrección ya presente)
      const newUser = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          role: role || 'USER',
          companies: {
            create: companyIds.map((companyId: string) => ({
              companyId: companyId,
            })),
          },
          person: {
            create: {
              firstName,
              lastName,
              fullName: `${firstName || ''} ${lastName || ''}`.trim(),
              contactEmail,
              phoneNumber,
              departmentId: departmentId || null,
              position,
              userCode: newUserCode,
            },
          },
        },
        include: {
          person: {
            include: {
              department: true,
            },
          },
          companies: {
            include: {
              company: true, // ✅ Mapea los detalles de la compañía
            },
          },
        },
      });

      return res.status(201).json(newUser);
    } catch (error: any) {
      if (error.code === 'P2002') {
        let errorMessage = 'Username, email o userCode ya existen.';
        if (error.meta?.target) {
          if (error.meta.target.includes('username'))
            errorMessage = 'El username ya existe.';
          if (error.meta.target.includes('email'))
            errorMessage = 'El email ya existe.';
          if (error.meta.target.includes('userCode'))
            errorMessage = 'El userCode ya existe.';
          if (error.meta.target.includes('contactEmail'))
            errorMessage = 'El email de contacto ya existe.';
          // El 'fullName' check debe ser menos estricto o revisar su unicidad
          // if (error.meta.target.includes('fullName'))
          //   errorMessage = 'El nombre completo ya existe.';
        }
        return res.status(409).json({ error: errorMessage });
      }
      console.error('Error creating user:', error);
      return res.status(500).json({
        error: 'Error al crear el usuario.',
        details: error.message,
      });
    }
  }

  async Delete(req: Request, res: Response) {
    const { id } = req.params;
    const requestingUserId = (req as any).userId;

    try {
      if (requestingUserId) {
        const permissionCheck = await this.validateRolePermission(
          requestingUserId,
          id,
          'delete'
        );
        if (!permissionCheck.allowed) {
          return res.status(403).json({ error: permissionCheck.error });
        }
      }

      const userToDelete = await prisma.user.findUnique({
        where: { id },
      });

      if (userToDelete?.role === 'SUPER_ADMIN') {
        const superAdminExists = await this.validateSuperAdminExists(id);
        if (!superAdminExists) {
          return res.status(400).json({
            error:
              'No se puede eliminar al último Super Administrador. Debe existir al menos uno.',
          });
        }
      }
      
      // La eliminación en cascada (CASCADE) debe estar configurada en el schema de Prisma 
      // para eliminar Person y UserCompany, de lo contrario esto podría fallar.
      const deletedUser = await prisma.user.delete({
        where: { id },
      });

      res.status(200).json({
        message: 'Usuario eliminado exitosamente.',
        user: deletedUser,
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }
      console.error('Error deleting user:', error);
      res.status(500).json({
        error: 'Error al eliminar el usuario.',
        details: error.message,
      });
    }
  }

  async Edit(req: Request, res: Response) {
    const { id } = req.params;
    const requestingUserId = (req as any).userId;
    const {
      username,
      email,
      password,
      role,
      isActive,
      companyIds, // Array de IDs de compañías
      firstName,
      lastName,
      contactEmail,
      phoneNumber,
      departmentId,
      position,
      status,
      userCode,
    } = req.body;

    try {
      if (requestingUserId && (role || isActive === false)) {
        const permissionCheck = await this.validateRolePermission(
          requestingUserId,
          id,
          'edit'
        );
        if (!permissionCheck.allowed) {
          return res.status(403).json({ error: permissionCheck.error });
        }
      }

      const userToEdit = await prisma.user.findUnique({
        where: { id },
      });

      // Lógica de validación para el último Super Admin
      if (
        role &&
        role !== 'SUPER_ADMIN' &&
        userToEdit?.role === 'SUPER_ADMIN'
      ) {
        const superAdminExists = await this.validateSuperAdminExists(id);
        if (!superAdminExists) {
          return res.status(400).json({
            error:
              'No se puede cambiar el rol del último Super Administrador. Debe existir al menos uno.',
          });
        }
      }
      
      const userDataToUpdate: any = {};
      if (username !== undefined) userDataToUpdate.username = username;
      if (email !== undefined) userDataToUpdate.email = email;
      if (role !== undefined) userDataToUpdate.role = role;
      if (isActive !== undefined) userDataToUpdate.isActive = isActive;

      if (password && password.trim()) {
        userDataToUpdate.password = await bcrypt.hash(password, 10);
      }

      // Actualizar relaciones con múltiples compañías (Corrección ya presente)
      if (companyIds !== undefined && Array.isArray(companyIds)) {
        // Eliminar todas las relaciones existentes
        await prisma.userCompany.deleteMany({
          where: { userId: id },
        });

        // Crear nuevas relaciones solo si hay compañías
        if (companyIds.length > 0) {
          userDataToUpdate.companies = {
            create: companyIds.map((companyId: string) => ({
              companyId: companyId,
            })),
          };
        }
      }

      // 1. Actualizar datos del Usuario
      const updatedUser = await prisma.user.update({
        where: { id },
        data: userDataToUpdate,
        include: {
          person: {
            include: {
              department: true,
            },
          },
          companies: {
            include: {
              company: true, // ✅ Mapea los detalles de la compañía
            },
          },
        },
      });

      // 2. Actualizar/Crear información personal (upsert)
      if (
        firstName !== undefined ||
        lastName !== undefined ||
        contactEmail !== undefined ||
        phoneNumber !== undefined ||
        departmentId !== undefined ||
        position !== undefined ||
        status !== undefined ||
        userCode !== undefined
      ) {
        const personDataToUpdate: any = {};
        const personDataToCreate: any = { userId: id };
        
        // Cargar los datos actuales de la persona para calcular fullName
        const currentPerson = updatedUser.person;

        if (firstName !== undefined) {
          personDataToUpdate.firstName = firstName;
          personDataToCreate.firstName = firstName;
        }
        if (lastName !== undefined) {
          personDataToUpdate.lastName = lastName;
          personDataToCreate.lastName = lastName;
        }
        if (contactEmail !== undefined) {
          personDataToUpdate.contactEmail = contactEmail;
          personDataToCreate.contactEmail = contactEmail;
        }
        if (phoneNumber !== undefined) {
          personDataToUpdate.phoneNumber = phoneNumber;
          personDataToCreate.phoneNumber = phoneNumber;
        }
        if (position !== undefined) {
          personDataToUpdate.position = position;
          personDataToCreate.position = position;
        }
        if (status !== undefined) {
          personDataToUpdate.status = status;
          personDataToCreate.status = status;
        }
        if (userCode !== undefined) {
          personDataToUpdate.userCode = userCode;
          personDataToCreate.userCode = userCode;
        }
        
        // Calcular FullName basado en los valores nuevos o existentes
        const newFirstName = personDataToUpdate.firstName ?? currentPerson?.firstName ?? '';
        const newLastName = personDataToUpdate.lastName ?? currentPerson?.lastName ?? '';

        const fullName = `${newFirstName} ${newLastName}`.trim();
        personDataToUpdate.fullName = fullName;
        personDataToCreate.fullName = fullName;

        if (departmentId !== undefined) {
          const finalDepartmentId = (departmentId === null || departmentId === '') ? null : departmentId;
          personDataToUpdate.departmentId = finalDepartmentId;
          personDataToCreate.departmentId = finalDepartmentId;
        }

        await prisma.person.upsert({
          where: { userId: id },
          update: personDataToUpdate,
          create: personDataToCreate,
        });

        // Volver a buscar el usuario para incluir la persona actualizada
        const userWithUpdatedPerson = await prisma.user.findUnique({
          where: { id },
          include: {
            person: {
              include: {
                department: true,
              },
            },
            companies: {
              include: {
                company: true, // ✅ Mapea los detalles de la compañía
              },
            },
          },
        });

        return res.status(200).json(userWithUpdatedPerson);
      }

      res.status(200).json(updatedUser);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }
      if (error.code === 'P2002') {
        let errorMessage = 'Username, email o userCode ya existen.';
        if (error.meta?.target) {
          if (error.meta.target.includes('username'))
            errorMessage = 'El username ya existe.';
          if (error.meta.target.includes('email'))
            errorMessage = 'El email ya existe.';
          if (error.meta.target.includes('userCode'))
            errorMessage = 'El userCode ya existe.';
          if (error.meta.target.includes('contactEmail'))
            errorMessage = 'El email de contacto ya existe.';
          // if (error.meta.target.includes('fullName'))
          //   errorMessage = 'El nombre completo ya existe.';
        }
        return res.status(409).json({ error: errorMessage });
      }
      console.error('Error updating user:', error);
      res.status(500).json({
        error: 'Error al actualizar el usuario.',
        details: error.message,
      });
    }
  }

  async get(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          person: {
            include: {
              department: true,
            },
          },
          companies: {
            include: {
              company: true, // ✅ Mapea los detalles de la compañía
            },
          },
          assignedEquipments: true,
          assignedMaintenances: true,
          createdCompanies: true,
          assignedNetworks: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      res.status(200).json(user);
    } catch (error: any) {
      console.error('Error fetching user:', error);
      res.status(500).json({
        error: 'Error al obtener el usuario.',
        details: error.message,
      });
    }
  }

  async getAll(req: Request, res: Response) {
    try {
      const users = await prisma.user.findMany({
        include: {
          person: {
            include: {
              department: true,
            },
          },
          companies: {
            include: {
              company: true, // ✅ Mapea los detalles de la compañía
            },
          },
        },
      });
      res.status(200).json(users);
    } catch (error: any) {
      console.error('Error fetching all users:', error);
      res.status(500).json({
        error: 'Error al obtener los usuarios.',
        details: error.message,
      });
    }
  }

  async getProfile(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          person: {
            include: {
              department: true,
            },
          },
          companies: {
            include: {
              company: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }

      res.status(200).json(user);
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({
        error: 'Error al obtener el perfil del usuario.',
        details: error.message,
      });
    }
  }

  async getAllWithPerson(req: Request, res: Response) {
    try {
      const users = await prisma.user.findMany({
        include: {
          person: {
            include: {
              department: true,
            },
          },
          companies: {
            include: {
              company: true, // ✅ Mapea los detalles de la compañía
            },
          },
        },
      });
      res.status(200).json(users);
    } catch (error: any) {
      console.error('Error fetching users with person data:', error);
      res.status(500).json({
        error: 'Error al obtener los usuarios.',
      });
    }
  }

  async getAllUserByCompanyId(req: Request, res: Response) {
    try {
      const company = await prisma.company.findUnique({
        where: { id: req.params.companyCode }, // Asumiendo que companyCode es el ID
      });
      console.log('Company found:', company?.id);
      if (!company) {
        return res.status(404).json({ error: 'Compañía no encontrada.' });
      }

      const users = await prisma.user.findMany({
        where: {
          companies: {
            some: {
              companyId: company.id,
            },
          },
        },
        include: {
          person: {
            include: {
              department: true,
            },
          },
          companies: {
            include: {
              company: true, // ✅ Mapea los detalles de la compañía
            },
          },
        },
      });

      res.status(200).json(users);
    } catch (error: any) {
      console.error('Error fetching users with person data:', error);
      res.status(500).json({
        error: 'Error al obtener los usuarios.',
      });
    }
  }
}